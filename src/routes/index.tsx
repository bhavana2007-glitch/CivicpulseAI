import { Link, createFileRoute } from "@tanstack/react-router";
import { firebaseConfigured } from "@/lib/firebase";

export const Route = createFileRoute("/")({
  component: Landing,
});

const TICKER = [
  "▲ WARD 7 — 4 potholes resolved in 24h",
  "● WARD 12 — garbage overflow flagged critical",
  "◆ WARD 3 — water leak in progress, worker en route",
  "■ WARD 21 — streetlight repaired · 42 min turnaround",
  "▲ WARD 9 — new complaint verified by AI",
  "● WARD 5 — parking violation dispatched to traffic dept",
];

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Signage header */}
      <header className="border-b border-navy/20 bg-navy text-cream">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-amber text-navy font-display text-lg font-bold">
              CP
            </div>
            <div>
              <div className="font-display text-xl font-bold uppercase tracking-widest">
                CivicPulse
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber">
                AI · Civic Terminal · v1.0
              </div>
            </div>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-cream/70">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </div>
        </div>
        {/* Ticker */}
        <div className="overflow-hidden border-t border-amber/30 bg-navy/95 py-2">
          <div className="ticker flex whitespace-nowrap font-mono text-xs text-amber">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="mx-8">
                {t}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-12 text-center">
          <div className="mb-3 inline-block rounded-full border border-moss/40 bg-moss/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-moss">
            AI-Powered · Real-Time · Role-Based
          </div>
          <h1 className="font-display text-5xl font-bold uppercase tracking-tight text-navy md:text-6xl">
            Report. Verify. Resolve.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            An intelligent civic issue reporting platform for citizens,
            authorities and field workers — with AI image classification, GPS
            triage and end-to-end resolution tracking.
          </p>
        </div>

        {!firebaseConfigured && (
          <div className="mx-auto mb-8 max-w-3xl rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 font-mono text-xs text-navy">
            <strong>DEMO MODE:</strong> Firebase env vars not set — running with
            in-browser mock auth & storage. Add{" "}
            <code>VITE_FIREBASE_*</code> vars and rebuild for real Firebase.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <RoleCard
            emoji="👤"
            title="Citizen"
            tagline="Report & track civic issues"
            role="citizen"
            accent="moss"
            features={[
              "Capture issue photo",
              "AI auto-classification",
              "Real-time status",
              "Complaint history",
            ]}
          />
          <RoleCard
            emoji="🏛"
            title="Authority"
            tagline="Triage, assign, monitor"
            role="authority"
            accent="amber"
            features={[
              "Live complaint queue",
              "Interactive ward map",
              "AI priority routing",
              "Analytics dashboard",
            ]}
          />
          <RoleCard
            emoji="👷"
            title="Field Worker"
            tagline="Resolve on the ground"
            role="worker"
            accent="navy"
            features={[
              "Assigned tasks feed",
              "GPS navigation",
              "Progress updates",
              "Proof-of-completion",
            ]}
          />
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-4">
          {[
            { k: "Categories", v: "6", d: "AI-detected issue types" },
            { k: "Statuses", v: "6", d: "FSM-tracked stages" },
            { k: "Roles", v: "3", d: "With separate dashboards" },
            { k: "Real-time", v: "∞", d: "Firestore listeners" },
          ].map((s) => (
            <div key={s.k} className="bento">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.k}
              </div>
              <div className="mt-1 font-display text-3xl font-bold text-navy">
                {s.v}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{s.d}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="mt-16 border-t border-border bg-navy py-6 text-center font-mono text-[11px] uppercase tracking-widest text-cream/60">
        CivicPulse AI · Built for civic transparency
      </footer>
    </div>
  );
}

function RoleCard({
  emoji,
  title,
  tagline,
  role,
  accent,
  features,
}: {
  emoji: string;
  title: string;
  tagline: string;
  role: "citizen" | "authority" | "worker";
  accent: "moss" | "amber" | "navy";
  features: string[];
}) {
  const accentBg = {
    moss: "bg-moss",
    amber: "bg-amber",
    navy: "bg-navy",
  }[accent];
  const accentFg = accent === "amber" ? "text-navy" : "text-cream";
  return (
    <div className="bento group flex flex-col transition-transform hover:-translate-y-1 hover:shadow-xl">
      <div className="mb-4 flex items-start justify-between">
        <div className="text-4xl">{emoji}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Terminal {role.slice(0, 3).toUpperCase()}
        </div>
      </div>
      <h2 className="font-display text-2xl font-bold uppercase text-navy">
        {title} Login
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
      <ul className="my-5 flex-1 space-y-1.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-moss" />
            {f}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Link
          to="/auth/$role/login"
          params={{ role }}
          className={`flex-1 rounded-md ${accentBg} ${accentFg} px-4 py-2.5 text-center font-mono text-xs font-semibold uppercase tracking-wider transition-opacity hover:opacity-90`}
        >
          Login
        </Link>
        <Link
          to="/auth/$role/register"
          params={{ role }}
          className="flex-1 rounded-md border border-navy/30 px-4 py-2.5 text-center font-mono text-xs font-semibold uppercase tracking-wider text-navy transition-colors hover:bg-navy/5"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
