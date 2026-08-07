import {
  CATEGORIES,
  CONFIDENCE_THRESHOLD,
  departmentFor,
  normalizeCategory,
  normalizeConfidence,
  normalizeSeverity,
  severityToPriority,
} from "./categories";
import type { ClassificationResult } from "./classify.functions";

const MODEL = "gemini-2.5-pro";
const TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `You are a municipal infrastructure image analyst. Inspect the actual pixels carefully before deciding.

Choose exactly one category from this closed list:
${CATEGORIES.map((category) => `- ${category}`).join("\n")}

Analysis procedure:
1. Identify the main physical object, surface, and visible failure.
2. Check each category against the visual evidence.
3. Distinguish close cases using these rules:
   - Pothole: a distinct cavity, crater, or hole in a road surface.
   - Road Damage: cracks, erosion, broken paving, subsidence, or deformation without a distinct hole.
   - Water Logging: standing floodwater covering a road or public area.
   - Water Leak: water visibly escaping from a pipe, valve, tap, or water main.
   - Drainage Issue: a blocked/open/overflowing drain or manhole, or visible sewage overflow.
   - Garbage Overflow: waste overflowing from a bin, dumpster, or designated collection point.
   - Illegal Dumping: dumped waste, rubble, or debris where no bin or collection point is present.
   - Broken Streetlight: a visibly damaged, fallen, leaning, vandalized, or nonfunctional streetlight.
   - Power Outage: visible electrical infrastructure failure such as downed lines or a damaged transformer. Do not infer an outage from an ordinary night scene.
   - Fallen Tree: a fallen tree or major branch obstructing a road, path, or property.
4. If several issues are visible, select the one posing the greatest immediate public risk.
5. Confidence must reflect visible evidence. Do not guess from filenames or metadata.

Return only a JSON object with category, confidence (integer 0-100), severity (Low, Medium, or High), and a one-to-two sentence factual description.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    category: { type: "STRING", enum: CATEGORIES },
    confidence: { type: "INTEGER", minimum: 0, maximum: 100 },
    severity: { type: "STRING", enum: ["Low", "Medium", "High"] },
    description: { type: "STRING" },
  },
  required: ["category", "confidence", "severity", "description"],
};

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match?.[1] || !match[2]) throw new Error("Invalid image data. Upload a JPEG, PNG, WebP, or GIF image.");
  return { mimeType: match[1], data: match[2].replace(/\s/g, "") };
}

function parseJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value: unknown = JSON.parse(cleaned);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function failure(reason: string, provider: ClassificationResult["provider"]): ClassificationResult {
  console.error("[classification] fallback used", { provider, reason });
  return {
    category: null,
    description: "Automatic classification failed. Select the correct category manually.",
    priority: "medium",
    department: "General Administration",
    confidence: 0,
    severity: "Medium",
    isValid: false,
    uncertain: true,
    source: "fallback",
    provider,
    error: reason,
  };
}

async function requestGemini(apiKey: string, imageDataUrl: string): Promise<string> {
  const { mimeType, data } = parseDataUrl(imageDataUrl);
  console.info("[classification] Gemini request started", { model: MODEL, mimeType, imageBytesApprox: Math.floor(data.length * 0.75) });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [
        { text: "Analyze this uploaded civic-issue image using the required procedure." },
        { inlineData: { mimeType, data } },
      ] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    }),
  });
  console.info("[classification] Gemini request status", { status: response.status, ok: response.ok });
  const body = await response.text();
  if (!response.ok) {
    console.error("[classification] Gemini API error", { status: response.status, body: body.slice(0, 500) });
    throw new Error(`Gemini request failed with status ${response.status}`);
  }
  const payload = JSON.parse(body) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] };
  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  console.info("[classification] Gemini response", { finishReason: candidate?.finishReason ?? "unknown", text: text.slice(0, 1_000) });
  if (!text.trim()) throw new Error("Gemini returned an empty response");
  return text;
}

async function requestLovableGemini(apiKey: string, imageDataUrl: string): Promise<string> {
  console.info("[classification] Gemini gateway request started", { model: MODEL });
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: `google/${MODEL}`,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: [
          { type: "text", text: "Analyze this uploaded civic-issue image. Return only the required JSON object." },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ] },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });
  console.info("[classification] Gemini gateway request status", { status: response.status, ok: response.ok });
  const body = await response.text();
  if (!response.ok) {
    console.error("[classification] Gemini gateway error", { status: response.status, body: body.slice(0, 500) });
    throw new Error(`Gemini gateway request failed with status ${response.status}`);
  }
  const payload = JSON.parse(body) as { choices?: { message?: { content?: string } }[] };
  const text = payload.choices?.[0]?.message?.content ?? "";
  console.info("[classification] Gemini response", { text: text.slice(0, 1_000) });
  if (!text.trim()) throw new Error("Gemini returned an empty response");
  return text;
}

export async function classifyImageOnServer(imageDataUrl: string): Promise<ClassificationResult> {
  const geminiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_GENERATIVE_AI_API_KEY"] || process.env["GOOGLE_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const provider: ClassificationResult["provider"] = geminiKey ? "gemini" : lovableKey ? "lovable" : "none";
  console.info("[classification] API key detection", {
    geminiKeyDetected: Boolean(geminiKey),
    lovableKeyDetected: Boolean(lovableKey),
    selectedProvider: provider,
  });
  if (!geminiKey && !lovableKey) return failure("No server-side Gemini credential is configured", "none");

  try {
    const text = geminiKey ? await requestGemini(geminiKey, imageDataUrl) : await requestLovableGemini(lovableKey as string, imageDataUrl);
    const raw = parseJson(text);
    console.info("[classification] parsed JSON", raw ?? { valid: false });
    if (!raw) return failure("Gemini returned invalid JSON", provider);
    const category = normalizeCategory(raw["category"]);
    if (!category) return failure(`Gemini returned an unsupported category: ${String(raw["category"])}`, provider);
    const confidence = normalizeConfidence(raw["confidence"]);
    const severity = normalizeSeverity(raw["severity"]);
    const description = typeof raw["description"] === "string" ? raw["description"].trim() : "";
    if (!description || confidence <= 0) return failure("Gemini response failed field validation", provider);
    console.info("[classification] final selected category", { category, confidence, severity, fallbackUsed: false });
    return {
      category,
      description,
      priority: severityToPriority(severity),
      department: departmentFor(category),
      confidence,
      severity,
      isValid: true,
      uncertain: confidence < CONFIDENCE_THRESHOLD,
      source: "ai",
      provider,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error), provider);
  }
}