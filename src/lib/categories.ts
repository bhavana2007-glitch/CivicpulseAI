import type { Category, Priority, Severity } from "./types";

/** The ONLY approved civic issue categories. */
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
  "Illegal Dumping",
];

export const DEPARTMENTS: Partial<Record<Category, string>> = {
  Pothole: "Public Works",
  "Water Logging": "Storm Water / Drainage",
  "Water Leak": "Water Supply",
  "Drainage Issue": "Storm Water / Drainage",
  "Garbage Overflow": "Sanitation",
  "Broken Streetlight": "Electrical",
  "Power Outage": "Electrical",
  "Fallen Tree": "Garden / Disaster Cell",
  "Road Damage": "Public Works",
  "Illegal Dumping": "Sanitation",
};

/** Safe department lookup — never returns undefined. */
export function departmentFor(category: Category): string {
  return DEPARTMENTS[category] ?? "General Administration";
}


const PRIORITIES: Priority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

/**
 * Converts AI output into one of the approved categories.
 * Handles small variations in Gemini responses.
 */
export function normalizeCategory(raw: unknown): Category | null {
  if (typeof raw !== "string") {
    return null;
  }

  const value = raw
    .trim()
    .toLowerCase();

  const aliases: Record<string, Category> = {
    "pothole": "Pothole",
    "road hole": "Pothole",
    "hole in road": "Pothole",

    "road damage": "Road Damage",
    "damaged road": "Road Damage",
    "cracked road": "Road Damage",

    "water logging": "Water Logging",
    "waterlogged": "Water Logging",
    "flooded road": "Water Logging",
    "standing water": "Water Logging",

    "water leak": "Water Leak",
    "water leakage": "Water Leak",
    "pipe leak": "Water Leak",

    "drainage issue": "Drainage Issue",
    "blocked drain": "Drainage Issue",
    "sewage overflow": "Drainage Issue",

    "garbage overflow": "Garbage Overflow",
    "overflowing garbage": "Garbage Overflow",
    "trash overflow": "Garbage Overflow",

    "illegal dumping": "Illegal Dumping",
    "waste dumping": "Illegal Dumping",

    "broken streetlight": "Broken Streetlight",
    "broken street light": "Broken Streetlight",
    "street light issue": "Broken Streetlight",

    "power outage": "Power Outage",
    "electricity problem": "Power Outage",
    "fallen wire": "Power Outage",

    "fallen tree": "Fallen Tree",
    "tree fallen": "Fallen Tree",
  };

  // Exact match
  if (aliases[value]) {
    return aliases[value];
  }

  return null;
}


export function normalizePriority(raw: unknown): Priority {
  if (typeof raw !== "string") {
    return "medium";
  }

  const value = raw
    .trim()
    .toLowerCase() as Priority;

  return PRIORITIES.includes(value)
    ? value
    : "medium";
}


export function normalizeConfidence(raw: unknown): number {
  const number =
    typeof raw === "number"
      ? raw
      : Number(raw);

  if (!Number.isFinite(number)) {
    return 0;
  }

  // Supports both 0-1 and 0-100 responses
  const confidence =
    number > 1
      ? number / 100
      : number;

  return Math.max(
    0,
    Math.min(1, confidence)
  );
}


export const CONFIDENCE_THRESHOLD = 0.6;


const SEVERITIES: Severity[] = [
  "Low",
  "Medium",
  "High",
];


export function normalizeSeverity(
  raw: unknown
): Severity {

  if (typeof raw !== "string") {
    return "Medium";
  }

  const value =
    raw.trim().toLowerCase();

  return (
    SEVERITIES.find(
      (s) =>
        s.toLowerCase() === value
    ) ?? "Medium"
  );
}


/** Converts severity into internal priority. */
export function severityToPriority(
  severity: Severity
): Priority {

  if (severity === "High") {
    return "high";
  }

  if (severity === "Low") {
    return "low";
  }

  return "medium";
}