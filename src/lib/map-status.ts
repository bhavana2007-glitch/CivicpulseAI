import type { ComplaintStatus } from "./types";

export { STATUS_LABEL } from "./types";

/** Marker colours grouped into the four public-facing status buckets. */
export function statusColor(status: ComplaintStatus): string {
  switch (status) {
    case "submitted":
    case "verified":
      return "#c94a4a"; // Reported
    case "assigned":
      return "#f5b643"; // Assigned
    case "en_route":
    case "in_progress":
      return "#e07a3f"; // In Progress
    case "completed":
      return "#4a7c59"; // Resolved
    default:
      return "#1b2a41";
  }
}

export const STATUS_LEGEND: { label: string; color: string }[] = [
  { label: "Reported", color: "#c94a4a" },
  { label: "Assigned", color: "#f5b643" },
  { label: "In Progress", color: "#e07a3f" },
  { label: "Resolved", color: "#4a7c59" },
];

export const STATUS_FILTERS: {
  key: string;
  label: string;
  match: ComplaintStatus[];
}[] = [
  { key: "all", label: "All", match: [] },
  { key: "reported", label: "Reported", match: ["submitted", "verified"] },
  { key: "assigned", label: "Assigned", match: ["assigned"] },
  {
    key: "in_progress",
    label: "In Progress",
    match: ["en_route", "in_progress"],
  },
  { key: "resolved", label: "Resolved", match: ["completed"] },
];
