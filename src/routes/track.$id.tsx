import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StatusStepper } from "@/components/StatusStepper";
import { subscribeComplaint } from "@/lib/complaints";
import { areaOf, wardOf } from "@/lib/public-feed";
import { STATUS_LABEL, type Complaint } from "@/lib/types";

export const Route = createFileRoute("/track/$id")({
  head: () => ({
    meta: [
      { title: "Track Complaint — CivicPulse AI" },
      {
        name: "description",
        content:
          "Follow a civic complaint through verification, assignment, repair and resolution in real time.",
      },
      { property: "og:title", content: "Track Complaint — CivicPulse AI" },
      {
        property: "og:description",
        content:
          "Live status timeline for a reported civic issue on CivicPulse AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { id } = Route.useParams();
  const [c, setC] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    return subscribeComplaint(id, (next) => {
      setC(next);
      setLoading(false);
    });
  }, [id]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-navy/20 bg-navy text-cream">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded bg-amber font-display text-sm font-bold text-navy">
              CP
            </span>
            <span className="font-display text-sm font-bold uppercase tracking-widest">
              CivicPulse
            </span>
          </Link>
          <Link
            to="/feed"
            className="rounded border border-cream/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest hover:bg-cream/10"
          >
            Live Civic Feed
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="font-display text-3xl font-bold uppercase text-navy">
          Complaint Tracking
        </h1>
        <p className="mb-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Reference #{id.slice(-6)}
        </p>

        {loading && (
          <div className="bento text-center text-sm text-muted-foreground">
            Loading complaint…
          </div>
        )}

        {!loading && !c && (
          <div className="bento text-center">
            <p className="text-sm text-muted-foreground">
              This complaint could not be found.
            </p>
          </div>
        )}

        {c && (
          <div className="bento space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-display text-2xl font-bold text-navy">
                  {c.category}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {wardOf(c)} · {areaOf(c)} ·{" "}
                  {new Date(c.createdAt).toLocaleString()}
                </div>
              </div>
              <span className="rounded-full bg-amber/20 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-navy">
                {STATUS_LABEL[c.status]}
              </span>
            </div>

            {c.imageUrl && (
              <img
                src={c.imageUrl}
                alt={`${c.category} report`}
                className="h-56 w-full rounded-lg object-cover"
              />
            )}

            <p className="text-sm text-muted-foreground">{c.description}</p>

            <div className="flex flex-wrap gap-1.5 font-mono text-[10px] uppercase tracking-wider">
              <span className="rounded bg-navy/10 px-2 py-0.5 text-navy">
                Priority: {c.priority}
              </span>
              {c.department && (
                <span className="rounded bg-moss/15 px-2 py-0.5 text-moss">
                  {c.department}
                </span>
              )}
            </div>

            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Status timeline
              </div>
              <StatusStepper status={c.status} />
            </div>

            {c.status === "rejected" && (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                This complaint was rejected after review.
              </div>
            )}

            {c.proofUrl && (
              <div>
                <div className="font-mono text-[10px] uppercase text-moss">
                  ✓ Proof of completion
                </div>
                <img
                  src={c.proofUrl}
                  alt="Proof of completion"
                  className="mt-1 h-40 rounded object-cover"
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
