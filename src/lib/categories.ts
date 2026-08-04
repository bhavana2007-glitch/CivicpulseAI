import type { Category, Priority } from "./types";

/** The ONLY categories the system accepts. */
export const CATEGORIES: Category[] = [
  "Pothole",
  "Water Logging",
  "Water Leak",
  "Drainage Issue",
  "Garbage Overflow",
  "Broken Streetlight",
  "Power Outage",
  "Fallen Tree",
  "Road Damage",
  "Others",
];

export const DEPARTMENTS: Record<Category, string> = {
  Pothole: "Public Works",
  "Water Logging": "Storm Water / Drainage",
  "Water Leak": "Water Supply",
  "Drainage Issue": "Storm Water / Drainage",
  "Garbage Overflow": "Sanitation",
  "Broken Streetlight": "Electrical",
  "Power Outage": "Electrical",
  "Fallen Tree": "Garden / Disaster Cell",
  "Road Damage": "Public Works",
  Others: "General Grievance",
};

const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

/** Strict validation: anything outside the approved list becomes "Others". */
export function normalizeCategory(raw: unknown): Category {
  if (typeof raw !== "string") return "Others";
  const v = raw.trim().toLowerCase();
  const exact = CATEGORIES.find((c) => c.toLowerCase() === v);
  return exact ?? "Others";
}

export function normalizePriority(raw: unknown): Priority {
  if (typeof raw !== "string") return "medium";
  const v = raw.trim().toLowerCase() as Priority;
  return PRIORITIES.includes(v) ? v : "medium";
}

export function normalizeConfidence(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  // Accept both 0-1 and 0-100 scales.
  const v = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, v));
}

export const CONFIDENCE_THRESHOLD = 0.7;
