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
import type { Category, Priority } from "./types";

const Input = z.object({ imageDataUrl: z.string().min(16) });

export interface ClassificationResult {
  category: Category;
  description: string;
  priority: Priority;
  department: string;
  confidence: number;
  isValid: boolean;
  source: "ai" | "fallback";
  /** Populated only when classification failed. */
  error?: string;
}

const SYSTEM_PROMPT = `You are an AI-powered civic issue classifier.
Analyze the uploaded image carefully.
Choose EXACTLY ONE category from the following list:
${CATEGORIES.map((c) => `- ${c}`).join("\n")}

Never invent new categories. Never guess unrelated issues.
If the image contains multiple issues, choose the MOST SEVERE civic issue.
If confidence is below 70%, return "Others".

Classification examples:
- Flooded street / standing water on road -> Water Logging
- Large pothole / hole in road surface -> Pothole
- Overflowing garbage bin / trash pile -> Garbage Overflow
- Broken, damaged or unlit streetlight pole -> Broken Streetlight
- Water leaking or spraying from a pipeline -> Water Leak
- Blocked, clogged or open drain / manhole -> Drainage Issue
- Tree fallen across a road or footpath -> Fallen Tree
- Cracked, broken or eroded road surface (no distinct hole) -> Road Damage
- Downed power line / dark area / damaged transformer -> Power Outage
- Anything not clearly matching the list -> Others

priority must be one of: low, medium, high, critical (based on public safety risk).
description must be 1-2 factual sentences about what is visible and the action needed.
confidence is a number from 0 to 100.

Return ONLY valid JSON, no markdown fences:
{"category":"","confidence":0,"priority":"","description":""}`;

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
      isValid: true,
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
            model: "google/gemini-3.6-flash",
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
      let category = normalizeCategory(raw["category"]);
      // Confidence-based validation: below threshold -> Others.
      if (confidence < CONFIDENCE_THRESHOLD) category = "Others";

      const description =
        typeof raw["description"] === "string" && raw["description"].trim()
          ? (raw["description"] as string).trim()
          : fallback.description;

      return {
        category,
        description,
        priority: normalizePriority(raw["priority"]),
        department: DEPARTMENTS[category],
        confidence,
        isValid: true,
        source: "ai",
      };
    } catch (err) {
      console.error("classifyImage failed", err);
      return { ...fallback, error: String(err).slice(0, 200) };
    }
  });
