import { createFileRoute, Link } from "@tanstack/react-router";
import { CATEGORIES as CATEGORY_LIST } from "@/lib/categories";
import { useEffect, useMemo, useState } from "react";
import { StatusStepper } from "@/components/StatusStepper";
import { subscribePublicComplaints } from "@/lib/complaints";
import { PRIORITY_STYLE, toPublic, type PublicComplaint } from "@/lib/public-feed";
import { STATUS_LABEL, type Category, type ComplaintStatus } from "@/lib/types";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Live Civic Feed — CivicPulse AI Transparency" },
      {
        name: "description",
        content:
          "Public transparency feed of civic complaints: category, ward, live status timeline and resolution statistics — updated in real time.",
      },
      { property: "og:title", content: "Live Civic Feed — CivicPulse AI" },
      {
        property: "og:description",
        content:
          "Track civic complaints across wards in real time: status timelines, AI priority and resolution rate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicFeed,
});

const CATEGORIES: (Category | "all")[] = ["all", ...CATEGORY_LIST];

const STATUSES: (ComplaintStatus | "all")[] = [
  "all",
  "submitted",
  "verified",
  "assigned",
  "en_route",
  "in_progress",
  "completed",
];

function PublicFeed() {
  const [items, setItems] = useState<PublicComplaint[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [status, setStatus] = useState<ComplaintStatus | "all">("all");

  useEffect(() => {
    return subscribePublicComplaints((list) => setItems(list.map(toPublic)));
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const resolved = items.filter((c) => c.status === "completed").length;
    return {
      total,
      active: total - resolved,
      resolved,
      rate: total ? Math.round((resolved / total) * 100) : 0,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(
      (c) =>
        (category === "all" || c.category === category) &&
        (status === "all" || c.status === status) &&
        (!term ||
          c.ward.toLowerCase().includes(term) ||
          c.area.toLowerCase().includes(term)),
    );
  }, [items, q, category, status]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-navy/20 bg-navy text-cream">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-amber font-display text-lg font-bold text-navy">
              CP
            </div>
            <div>
              <div className="font-display text-xl font-bold uppercase tracking-widest">
                CivicPulse
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber">
                Public Transparency Feed
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-cream/70">
            <span className="h-2 w-2 animate-pulse rounded-full bg-moss" />
            Live · no login required
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="font-display text-4xl font-bold uppercase text-navy">
          Live Civic Feed
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every civic complaint filed in the city, updated in real time.
          Personal details of reporters are never published.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Stat label="Total Complaints" value={String(stats.total)} />
          <Stat label="Active" value={String(stats.active)} tone="text-amber" />
          <Stat
            label="Resolved"
            value={String(stats.resolved)}
            tone="text-moss"
          />
          <Stat label="Resolution Rate" value={`${stats.rate}%`} tone="text-moss" />
        </div>

        <div className="bento mt-6 flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by ward or area…"
            className="min-w-[200px] flex-1 rounded border border-input bg-background px-3 py-2 font-mono text-xs uppercase tracking-wider outline-none transition-colors focus:border-navy"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "all")}
            className="rounded border border-input bg-background px-2 py-2 font-mono text-[10px] uppercase"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All categories" : c}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as ComplaintStatus | "all")
            }
            className="rounded border border-input bg-background px-2 py-2 font-mono text-[10px] uppercase"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {filtered.length} shown
          </span>
        </div>

        <div className="mt-6 space-y-3">
          {filtered.length === 0 && (
            <p className="rounded border border-dashed p-10 text-center text-sm text-muted-foreground">
              No public complaints match these filters yet.
            </p>
          )}
          {filtered.map((c) => (
            <FeedCard key={c.id} c={c} />
          ))}
        </div>
      </main>

      <footer className="mt-16 border-t border-border bg-navy py-6 text-center font-mono text-[11px] uppercase tracking-widest text-cream/60">
        CivicPulse AI · Built for civic transparency
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-navy",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="bento transition-transform hover:-translate-y-0.5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-display text-4xl font-bold ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function FeedCard({ c }: { c: PublicComplaint }) {
  const resolved = c.status === "completed";
  return (
    <article className="bento animate-in fade-in transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex flex-wrap items-start gap-4">
        {c.imageUrl && (
          <img
            src={c.imageUrl}
            alt={`${c.category} reported in ${c.ward}`}
            loading="lazy"
            className="h-20 w-20 rounded-lg object-cover"
          />
        )}
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold uppercase text-navy">
              {c.category}
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${PRIORITY_STYLE[c.priority]}`}
            >
              AI · {c.priority}
            </span>
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                resolved
                  ? "bg-moss/20 text-moss"
                  : "bg-amber/20 text-navy"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${resolved ? "bg-moss" : "animate-pulse bg-amber"}`}
              />
              {STATUS_LABEL[c.status]}
            </span>
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-moss">
            📍 {c.ward} · {c.area} ·{" "}
            <span className="text-muted-foreground">
              {new Date(c.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {c.description}
          </p>
          <div className="mt-3">
            <StatusStepper status={c.status} />
          </div>
        </div>
      </div>
    </article>
  );
}
