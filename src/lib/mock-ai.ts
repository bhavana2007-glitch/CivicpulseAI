import type { Category, Complaint, Priority } from "./types";

const CATEGORIES: Category[] = [
  "Pothole",
  "Garbage",
  "Water Leak",
  "Streetlight",
  "Parking",
  "Other",
];

const DEPARTMENTS: Record<Category, string> = {
  Pothole: "Public Works",
  Garbage: "Sanitation",
  "Water Leak": "Water Supply",
  Streetlight: "Electrical",
  Parking: "Traffic Police",
  Other: "General Grievance",
};

// Deterministic hash so same image bytes -> same classification (duplicate detection).
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface AIAnalysis {
  category: Category;
  description: string;
  priority: Priority;
  department: string;
  confidence: number;
  isValid: boolean;
  imageHash: string;
}

export async function analyzeImage(dataUrl: string): Promise<AIAnalysis> {
  await new Promise((r) => setTimeout(r, 900));
  const h = hash(dataUrl.slice(0, 512));
  const category = CATEGORIES[h % CATEGORIES.length];
  const priority: Priority = (
    ["low", "medium", "high", "critical"] as Priority[]
  )[h % 4];
  const templates: Record<Category, string> = {
    Pothole:
      "Large pothole detected on the road surface, posing a risk to vehicles and two-wheelers. Immediate patching recommended.",
    Garbage:
      "Overflowing garbage accumulation detected at the location. Sanitation pickup required to prevent health hazards.",
    "Water Leak":
      "Active water leakage identified from the municipal supply line. Water loss and pooling observed.",
    Streetlight:
      "Non-functional streetlight detected. Area appears unlit, raising public safety concerns after dark.",
    Parking:
      "Unauthorized parking / vehicle obstruction detected. Traffic movement is impaired in the affected lane.",
    Other:
      "Civic infrastructure issue detected. Requires municipal inspection and remediation.",
  };
  return {
    category,
    description: templates[category],
    priority,
    department: DEPARTMENTS[category],
    confidence: 0.72 + (h % 25) / 100,
    isValid: true,
    imageHash: String(h),
  };
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
