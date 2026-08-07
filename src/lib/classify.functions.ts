import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { classifyImageOnServer } from "./classify.server";
import type { Category, Priority, Severity } from "./types";

export interface ClassificationResult {
  category: Category | null;
  description: string;
  priority: Priority;
  department: string;
  confidence: number;
  severity: Severity;
  isValid: boolean;
  /** True when confidence is low or automatic classification failed. */
  uncertain: boolean;
  source: "ai" | "fallback";
  /** Which backend answered: Lovable's Gemini gateway, direct Gemini, or none. */
  provider?: "lovable" | "gemini" | "none";
  /** Populated only when classification failed. */
  error?: string;
}

export const classifyImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ imageDataUrl: z.string().min(16) }).parse(data),
  )
  .handler(async ({ data }): Promise<ClassificationResult> =>
    classifyImageOnServer(data.imageDataUrl),
  );