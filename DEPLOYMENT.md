# Deploying CivicPulse AI outside Lovable (GitHub → Vercel)

## Why the deployed app kept predicting "Others"

The AI classification runs in the server function `src/lib/classify.functions.ts`.
It authenticated **only** through `LOVABLE_API_KEY`, which is a Lovable-managed
secret injected into the Lovable runtime. It is **not** part of the exported
repository and is **not** present on Vercel, so on the deployed build the
handler hit its `if (!key) return fallback` branch on every request and always
returned the fallback classification. Nothing was wrong with the prompt, the
model, or the parser — the request never reached Gemini.

Two secondary bugs made that fallback look like a classification bug:

1. The fallback used `category: "Others"` with `DEPARTMENTS.Others`, which does
   not exist in the department map (`undefined` at runtime).
2. The fallback result was indistinguishable from a real AI answer in the UI.

## What changed

- `classify.functions.ts` now resolves a key at request time from, in order:
  `LOVABLE_API_KEY` → `GEMINI_API_KEY` → `GOOGLE_GENERATIVE_AI_API_KEY` →
  `GOOGLE_API_KEY`. With a Gemini key it calls the Google Generative Language
  API (`gemini-2.5-pro`, overridable via `GEMINI_MODEL`) directly with the same
  system prompt and JSON contract, so preview and production behave identically.
- The response now carries `provider` (`lovable` | `gemini` | `none`) and a
  human-readable `error`, so a misconfigured deployment is visible instead of
  silently degrading.
- Unparseable model output is reported as an error instead of being coerced.
- Fallback no longer claims "Others": it returns `Road Damage` with
  `confidence: 0` and `uncertain: true`, which makes the UI require the citizen
  to pick one of the ten approved categories manually. This is the only
  fallback path, and it never invents a category.
- `departmentFor()` replaces direct `DEPARTMENTS[...]` indexing everywhere.

Category normalization is unchanged and already never downgrades a valid answer
to "Others" — only the ten approved categories are returned.

## Vercel setup checklist

1. **Environment variables** (Project → Settings → Environment Variables, for
   Production *and* Preview):
   - `GEMINI_API_KEY` — from Google AI Studio. Required.
   - Optional: `GEMINI_MODEL` (defaults to `gemini-2.5-pro`).
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

Upload a pothole photo and check the report card. If classification falls back,
the server logs (Vercel → Deployment → Functions) print the exact cause, e.g.
`classifyImage: no AI key configured` or `gemini 403: ...`.
