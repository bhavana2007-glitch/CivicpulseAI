import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CATEGORIES,
  CONFIDENCE_THRESHOLD,
  DEPARTMENTS,
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
  /** Populated only when classification failed. */
  error?: string;
}

const SYSTEM_PROMPT = `You are an expert municipal civic-issue image classifier.
You MUST classify the image into EXACTLY ONE of these categories:
${CATEGORIES.map((c) => `- ${c}`).join("\n")}

MANDATORY PROCEDURE — follow it every time:
1. Describe to yourself what physical objects and surfaces are visible.
2. Compare the image against EVERY category in the list above, one by one.
3. Pick the single best match. Only if NO category matches with at least 60%
   confidence may you answer "Others".

Category definitions (be decisive, these are common and obvious):
- Pothole: any hole, cavity, crater or broken patch in a road/street surface,
  including water-filled potholes. A visible hole in asphalt is ALWAYS "Pothole",
  never "Others".
- Road Damage: cracked, crumbling, eroded, subsided or broken road/footpath
  surface WITHOUT a distinct hole (alligator cracks, uneven patches).
- Water Logging: standing/stagnant water flooding a road, street or public area.
  A flooded or submerged road is ALWAYS "Water Logging", never "Others".
- Water Leak: water spraying, gushing or dripping from a pipe, tap, valve or
  main; wet patch traced to a pipeline.
- Drainage Issue: blocked/clogged/overflowing drain, open or missing manhole,
  sewage on the street.
- Garbage Overflow: overflowing bin, dumpster or heaped trash at a collection point.
- Illegal Dumping: waste, debris, construction rubble or trash dumped in an
  unauthorised place with no bin present.
- Broken Streetlight: damaged, leaning, unlit or vandalised street light pole/fixture.
- Power Outage: downed power line, damaged transformer/pole, dark neighbourhood.
- Fallen Tree: tree or large branch fallen onto a road, footpath or property.
- Others: ONLY when nothing above matches with >= 60% confidence.

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

export const classifyImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ClassificationResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    const fallback: ClassificationResult = {
      category: "Others",
      description:
        "Civic issue reported. Automatic classification was unavailable, requires manual municipal review.",
      priority: "medium",
      department: DEPARTMENTS.Others,
      confidence: 0,
      severity: "Medium",
      isValid: true,
      uncertain: true,
      source: "fallback",
    };
    if (!key) return { ...fallback, error: "missing LOVABLE_API_KEY" };

    try {
      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
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
                  {
                    type: "image_url",
                    image_url: { url: data.imageDataUrl },
                  },
                ],
              },
            ],
          }),
        },
      );
      if (!res.ok) {
        const body = await res.text();
        console.error("AI gateway error", res.status, body.slice(0, 300));
        return { ...fallback, error: `gateway ${res.status}` };
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content ?? "";

      const raw = parseJson(text);
      const confidence = normalizeConfidence(raw["confidence"]);
      const category = normalizeCategory(raw["category"]);
      const severity = normalizeSeverity(raw["severity"]);
      // Below the threshold we keep the AI guess but flag it for manual confirmation.
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
        department: DEPARTMENTS[category],
        confidence,
        severity,
        isValid: true,
        uncertain,
        source: "ai",
      };
    } catch (err) {
      console.error("classifyImage failed", err);
      return { ...fallback, error: String(err).slice(0, 200) };
    }
  });
