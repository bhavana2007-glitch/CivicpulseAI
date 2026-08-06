import type { Complaint, Priority } from "./types";
import { DEPARTMENTS } from "./categories";
import { classifyImage } from "./classify.functions";
import type { ClassificationResult } from "./classify.functions";

export type { ClassificationResult };

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface AIAnalysis extends ClassificationResult {
  /** Stable per-image hash used only for duplicate detection. */
  imageHash: string;
}

/**
 * Real vision classification through the AI gateway.
 * The returned category is already strictly validated server-side —
 * no frontend remapping is applied anywhere.
 */
export async function analyzeImage(dataUrl: string): Promise<AIAnalysis> {
  const imageHash = String(hash(dataUrl.slice(0, 2048)));
  try {
    const result = await classifyImage({ data: { imageDataUrl: dataUrl } });
    return { ...result, imageHash };
  } catch (err) {
    console.error("analyzeImage failed", err);
    return {
      category: "Others",
      description:
        "Civic issue reported. Automatic classification was unavailable, requires manual municipal review.",
      priority: "medium" as Priority,
      department: DEPARTMENTS.Others,
      confidence: 0,
      severity: "Medium" as const,
      isValid: true,
      uncertain: true,
      source: "fallback",
      imageHash,
    };
  }
}

export function findDuplicate(
  hashValue: string,
  lat: number,
  lng: number,
  existing: Complaint[],
): Complaint | null {
  return (
    existing.find(
      (c) =>
        Math.abs(c.lat - lat) < 0.001 &&
        Math.abs(c.lng - lng) < 0.001 &&
        c.status !== "completed",
    ) ?? null
  );
}

// Haversine-ish (planar) — good enough for nearest-worker mock.
export function nearestWorker<T extends { lat: number; lng: number }>(
  target: { lat: number; lng: number },
  workers: T[],
): T | null {
  if (!workers.length) return null;
  return workers
    .map((w) => ({
      w,
      d: (w.lat - target.lat) ** 2 + (w.lng - target.lng) ** 2,
    }))
    .sort((a, b) => a.d - b.d)[0].w;
}
