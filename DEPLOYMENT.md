# Deploying CivicPulse AI outside Lovable (GitHub → Vercel)

## Exact cause of the production-only fixed-category result

The exported deployment had two independent silent coercions. A missing or
unusable server credential made the server return a fallback, while both the
server fallback and browser catch handler labeled that fallback as `Road
Damage`. In addition, `normalizeCategory()` converted every missing,
unrecognized, or malformed model category to `Road Damage`. An API, deployment,
or parsing failure therefore looked exactly like a successful AI prediction.

Two secondary bugs made that fallback look like a classification bug:

1. The fallback used `category: "Others"` with `DEPARTMENTS.Others`, which does
   not exist in the department map (`undefined` at runtime).
2. The fallback result was indistinguishable from a real AI answer in the UI.

## What changed

- Production prefers `GEMINI_API_KEY` and calls Gemini 2.5 Pro directly. Lovable
  Preview uses its managed Gemini gateway only when no direct Gemini credential
  exists. Both paths use the same prompt and category contract.
- Direct Gemini calls enforce JSON response MIME type and a response schema.
- Invalid JSON, missing fields, unsupported categories, timeouts, and API errors
  return no category and force manual selection. They are never relabeled as a
  real prediction.
- The response now carries `provider` (`lovable` | `gemini` | `none`) and a
  human-readable `error`, so a misconfigured deployment is visible instead of
  silently degrading.
- Unparseable model output is reported as an error instead of being coerced.
- Fallback has no category. The UI displays the failure reason and requires the
  citizen to select one of the ten approved categories manually.
- `departmentFor()` replaces direct `DEPARTMENTS[...]` indexing everywhere.

Category normalization is unchanged and already never downgrades a valid answer
to "Others" — only the ten approved categories are returned.

## Vercel setup checklist

1. **Environment variables** (Project → Settings → Environment Variables, for
   Production *and* Preview):
   - `GEMINI_API_KEY` — from Google AI Studio. Required.
   - `VITE_FIREBASE_*` — your Firebase web config, if you use real Firebase.
   - Do **not** copy `LOVABLE_API_KEY`; it only works inside Lovable.
   - Never prefix the Gemini key with `VITE_` — it must stay server-side.
2. **Build output target.** This app builds through Nitro with Cloudflare as
   the default target. For Vercel set `NITRO_PRESET=vercel` as an environment
   variable (build command stays `npm run build`), so server functions deploy
   as Vercel functions rather than a Worker bundle.
3. **Redeploy after every push.** If the deployed site shows old classification
   behaviour, it is serving a cached build: confirm the Vercel deployment
   commit SHA matches your latest GitHub commit, and redeploy with
   "Use existing Build Cache" disabled.

## Verifying it works in production

Upload several known images and inspect Vercel → Deployment → Functions. Every
request logs key presence (booleans only), Gemini request status, model response,
parsed JSON, final category, and any fallback reason. API keys are never logged.
