import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  CATEGORIES,
  CONFIDENCE_THRESHOLD,
  DEPARTMENTS,
  normalizeCategory,
  normalizeConfidence,
  normalizePriority,
  normalizeSeverity,
  severityToPriority,
} from "./categories";

import type {
  Category,
  Priority,
  Severity,
} from "./types";


const Input = z.object({
  imageDataUrl: z.string().min(16),
});


export interface ClassificationResult {
  category: Category;
  description: string;
  priority: Priority;
  department: string;
  confidence: number;
  severity: Severity;
  isValid: boolean;
  uncertain: boolean;
  source: "ai" | "fallback";
  error?: string;
}


const SYSTEM_PROMPT = ` 
You are an expert municipal civic issue image classifier.

Classify the image into EXACTLY ONE category.

Available categories:

${CATEGORIES.map((c) => `- ${c}`).join("\n")}


Follow this procedure:

1. Identify visible objects, surfaces and damage.
2. Compare against every category.
3. Select the strongest matching category.
4. Never invent categories.


Category rules:

Pothole:
Visible hole, cavity, crater or broken patch in road surface.

Road Damage:
Cracks, damaged asphalt, broken road surface without a clear hole.

Water Logging:
Standing water or flooding on road/public area.

Water Leak:
Water coming from pipe, tap, valve or pipeline.

Drainage Issue:
Blocked drain, sewage overflow, missing/open manhole.

Garbage Overflow:
Overflowing garbage bin or trash collection point.

Illegal Dumping:
Waste dumped in an unauthorized location.

Broken Streetlight:
Damaged or non-working street light.

Power Outage:
Damaged electrical equipment, transformer or fallen power lines.

Fallen Tree:
Tree or large branch fallen on road/property.


Return ONLY JSON:

{
 "category":"",
 "confidence":0,
 "severity":"",
 "description":"",
 "priority":""
}

confidence must be between 0 and 100.

severity:
Low, Medium or High.

description:
One or two factual sentences describing the visible issue and required action.
`;
function parseJson(text: string): Record<string, unknown> {
  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/gi, "");

  const cleaned = withoutThinking
    .trim()
    .replace(/^`json/i, "")
    .replace(/^`/i, "")
    .replace(/\`\`\`$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/{[\s\S]*}/);

    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return {};
      }
    }

    return {};
  }
}


function extractBase64(imageDataUrl: string) {
  const parts = imageDataUrl.split(",");

  return {
    mimeType:
      parts[0]?.match(/data:(.*);base64/)?.[1] ??
      "image/jpeg",

    data:
      parts[1] ?? imageDataUrl,
  };
}


export const classifyImage = createServerFn({
  method: "POST",
})
.inputValidator((data: unknown) => Input.parse(data))
.handler(async ({ data }): Promise<ClassificationResult> => {

  const key = process.env.GROQ_API_KEY;


  const fallback: ClassificationResult = {
    category: "Road Damage",
    description:
      "Civic issue detected but automatic classification failed. Manual verification required.",
    priority: "medium",
    department: DEPARTMENTS["Road Damage"],
    confidence: 0,
    severity: "Medium",
    isValid: true,
    uncertain: true,
    source: "fallback",
  };


  if (!key) {
    return {
      ...fallback,
      error: "Missing GROQ_API_KEY",
    };
  }


  try {

    const image = extractBase64(data.imageDataUrl);
    const dataUrl = `data:${image.mimeType};base64,${image.data}`;


    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },

        body: JSON.stringify({
          model: "qwen/qwen3.6-27b",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: SYSTEM_PROMPT },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      }
    );


    if (!response.ok) {

      const errorText = await response.text();

      console.error(
        "Groq API error:",
        response.status,
        errorText.slice(0,300)
      );


      return {
        ...fallback,
        error: `Groq API ${response.status}`,
      };

    }


    const json = await response.json();


    const text =
      json?.choices?.[0]
        ?.message
        ?.content ?? "";


    const raw = parseJson(text);


    const category =
      normalizeCategory(raw.category);


    const confidence =
      normalizeConfidence(raw.confidence);


    const severity =
      normalizeSeverity(raw.severity);


    const priority =
      raw.priority
        ? normalizePriority(raw.priority)
        : severityToPriority(severity);


    const description =
      typeof raw.description === "string" &&
      raw.description.trim()
        ? raw.description.trim()
        : fallback.description;


    const uncertain =
      confidence < CONFIDENCE_THRESHOLD;

      return{
      category,
      description,
      priority,
      department:
        DEPARTMENTS[category] ??
        DEPARTMENTS["Road Damage"],
      confidence,
      severity,
      isValid: true,
      uncertain,
      source: "ai",
    };


  } catch (error) {

    console.error(
      "classifyImage failed:",
      error
    );


    return {
      ...fallback,
      error:
        String(error).slice(0, 200),
    };
  }

});
