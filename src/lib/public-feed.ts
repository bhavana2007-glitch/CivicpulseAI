import type { Complaint, ComplaintStatus } from "./types";

/**
 * Derives a coarse ward/area label from GPS coordinates.
 * Intentionally low-resolution so no exact citizen address is exposed.
 */
export function wardOf(c: Pick<Complaint, "lat" | "lng">): string {
  const a = Math.round(c.lat * 50);
  const b = Math.round(c.lng * 50);
  const n = (Math.abs(a * 31 + b * 17) % 24) + 1;
  return `Ward ${String(n).padStart(2, "0")}`;
}

/** Coarse neighbourhood grid cell, e.g. "Sector 18.52 / 73.86". */
export function areaOf(c: Pick<Complaint, "lat" | "lng">): string {
  return `Sector ${c.lat.toFixed(2)} / ${c.lng.toFixed(2)}`;
}

/** Public-safe projection of a complaint — strips all citizen identity fields. */
export interface PublicComplaint {
  id: string;
  category: Complaint["category"];
  description: string;
  status: ComplaintStatus;
  priority: Complaint["priority"];
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
  ward: string;
  area: string;
}

export function toPublic(c: Complaint): PublicComplaint {
  return {
    id: c.id,
    category: c.category,
    description: c.description,
    status: c.status,
    priority: c.priority,
    imageUrl: c.imageUrl,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    ward: wardOf(c),
    area: areaOf(c),
  };
}

export const PRIORITY_STYLE: Record<Complaint["priority"], string> = {
  low: "bg-moss/15 text-moss border-moss/30",
  medium: "bg-amber/20 text-navy border-amber/40",
  high: "bg-orange-500/15 text-orange-700 border-orange-500/40",
  critical: "bg-destructive/15 text-destructive border-destructive/40",
};
