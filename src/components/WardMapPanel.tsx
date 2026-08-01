import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { Complaint, Category } from "@/lib/types";
import { STATUS_FILTERS, STATUS_LEGEND } from "@/lib/map-status";

const WardMap = lazy(() => import("./WardMap"));

const CATEGORIES: (Category | "all")[] = [
  "all",
  "Pothole",
  "Garbage",
  "Water Leak",
  "Streetlight",
  "Parking",
  "Other",
];

export function WardMapPanel({ complaints }: { complaints: Complaint[] }) {
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visible = useMemo(() => {
    const f = STATUS_FILTERS.find((s) => s.key === status);
    return complaints.filter((c) => {
      const statusOk = !f || f.key === "all" || f.match.includes(c.status);
      const catOk = category === "all" || c.category === category;
      return statusOk && catOk && Number.isFinite(c.lat) && Number.isFinite(c.lng);
    });
  }, [complaints, status, category]);

  return (
    <div className="bento">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold uppercase text-navy">
          Interactive Ward Map
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {visible.length} of {complaints.length} shown
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              status === f.key
                ? "bg-navy text-cream"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {f.label}
          </button>
        ))}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | "all")}
          className="ml-auto rounded border border-input bg-background px-2 py-1 font-mono text-[10px] uppercase"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>
      </div>

      <Suspense
        fallback={
          <div
            className="grid place-items-center rounded-xl bg-muted font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            style={{ height: 420 }}
          >
            Loading map…
          </div>
        }
      >
        {mounted && <WardMap complaints={visible} height={420} />}
      </Suspense>

      <div className="mt-3 flex flex-wrap gap-4">
        {STATUS_LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: l.color }}
            />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
