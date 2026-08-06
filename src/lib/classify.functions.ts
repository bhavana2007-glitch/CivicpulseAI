import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CATEGORIES,
  CONFIDENCE_THRESHOLD,
  departmentFor,
  normalizeCategory,
  normalizeConfidence,
  normalizePriority,
} from "./categories";
import { normalizeSeverity, severityToPriority } from "./categories";
import type { Category, Priority, Severity } from "./types";

const Input = z.object({ imageDataUrl: z.string().min(16) });

export interface ClassificationResult {
  category: Category;
  description: string;
  priority: Priority;
  department: string;
  confidence: number;
  severity: Severity;
  isValid: boolean;
  /** True when confidence is below the threshold and the user must confirm. */
  uncertain: boolean;
  source: "ai" | "fallback";
  /** Which backend answered: lovable gateway, direct Gemini, or none. */
  provider?: "lovable" | "gemini" | "none";
  /** Populated only when classification failed. */
  error?: string;
}

const SYSTEM_PROMPT = `You are an expert municipal civic-issue image classifier.
You MUST classify the image into EXACTLY ONE of these categories:
${CATEGORIES.map((c) => `- ${c}`).join("\n")}

MANDATORY PROCEDURE — follow it every time:
1. Describe to yourself what physical objects and surfaces are visible.
2. Compare the image against EVERY category in the list above, one by one.
3. Pick the single best match. You must always pick one of the listed
   categories — there is no "Others" option.

Category definitions (be decisive, these are common and obvious):
- Pothole: any hole, cavity, crater or broken patch in a road/street surface,
  including water-filled potholes.
- Road Damage: cracked, crumbling, eroded, subsided or broken road/footpath
  surface WITHOUT a distinct hole (alligator cracks, uneven patches).
- Water Logging: standing/stagnant water flooding a road, street or public area.
- Water Leak: water spraying, gushing or dripping from a pipe, tap, valve or main.
- Drainage Issue: blocked/clogged/overflowing drain, open or missing manhole,
  sewage on the street.
- Garbage Overflow: overflowing bin, dumpster or heaped trash at a collection point.
- Illegal Dumping: waste, debris, construction rubble or trash dumped in an
  unauthorised place with no bin present.
- Broken Streetlight: damaged, leaning, unlit or vandalised street light pole/fixture.
- Power Outage: downed power line, damaged transformer/pole, dark neighbourhood.
- Fallen Tree: tree or large branch fallen onto a road, footpath or property.

Never invent categories. If multiple issues appear, pick the MOST SEVERE one.

Return fields:
- category: exactly one string from the list.
- confidence: integer 0-100, your true confidence in the chosen category.
- severity: "Low", "Medium" or "High" based on public-safety risk.
- description: 1-2 factual sentences describing what is visible and the action needed.

Return ONLY valid JSON, no markdown fences:
{"category":"","confidence":0,"severity":"","description":""}`;

function parseJson(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        /* fallthrough */
      }
    }
    return {};
  }
}

/** Splits a data URL into mime type + raw base64 for the direct Gemini API. */
function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: "image/jpeg", data: dataUrl.replace(/^data:.*,/, "") };
}

/** Lovable AI Gateway (used inside Lovable preview/hosting). */
async function classifyViaLovable(
  key: string,
  imageDataUrl: string,
): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Classify this civic issue image. Return only the JSON object.",
            },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`lovable gateway ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Direct Google Gemini API — used on self-hosted deploys (Vercel etc.). */
async function classifyViaGemini(
  key: string,
  imageDataUrl: string,
): Promise<string> {
  const { mimeType, data } = splitDataUrl(imageDataUrl);
  const model = process.env["GEMINI_MODEL"] || "gemini-2.5-pro";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Classify this civic issue image. Return only the JSON object.",
              },
              { inlineData: { mimeType, data } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`gemini ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

export const classifyImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ClassificationResult> => {
    // Read env inside the handler — required on every serverless runtime.
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const geminiKey =
      process.env["GEMINI_API_KEY"] ||
      process.env["GOOGLE_GENERATIVE_AI_API_KEY"] ||
      process.env["GOOGLE_API_KEY"];

    // Fallback never claims a wrong category: it stays uncertain so the UI
    // forces the citizen to pick one of the approved categories manually.
    const fallback: ClassificationResult = {
      category: "Road Damage",
      description:
        "Civic issue reported. Automatic classification was unavailable, requires manual selection and municipal review.",
      priority: "medium",
      department: departmentFor("Road Damage"),
      confidence: 0,
      severity: "Medium",
      isValid: true,
      uncertain: true,
      source: "fallback",
      provider: "none",
    };

    if (!lovableKey && !geminiKey) {
      console.error(
        "classifyImage: no AI key configured (LOVABLE_API_KEY or GEMINI_API_KEY)",
      );
      return {
        ...fallback,
        error:
          "No AI key configured on the server. Set GEMINI_API_KEY (or LOVABLE_API_KEY) in your deployment environment variables.",
      };
    }

    const provider: "lovable" | "gemini" = lovableKey ? "lovable" : "gemini";

    try {
      const text = lovableKey
        ? await classifyViaLovable(lovableKey, data.imageDataUrl)
        : await classifyViaGemini(geminiKey!, data.imageDataUrl);

      const raw = parseJson(text);
      if (!raw["category"]) {
        console.error(
          "classifyImage: unparseable model output",
          text.slice(0, 300),
        );
        return {
          ...fallback,
          provider,
          error: "AI response could not be parsed",
        };
      }

      const confidence = normalizeConfidence(raw["confidence"]);
      const category = normalizeCategory(raw["category"]);
      const severity = normalizeSeverity(raw["severity"]);
      const uncertain = confidence < CONFIDENCE_THRESHOLD;

      const description =
        typeof raw["description"] === "string" && raw["description"].trim()
          ? (raw["description"] as string).trim()
          : fallback.description;

      return {
        category,
        description,
        priority: raw["priority"]
          ? normalizePriority(raw["priority"])
          : severityToPriority(severity),
        department: departmentFor(category),
        confidence,
        severity,
        isValid: true,
        uncertain,
        source: "ai",
        provider,
      };
    } catch (err) {
      console.error("classifyImage failed", err);
      return { ...fallback, provider, error: String(err).slice(0, 300) };
    }
  });
