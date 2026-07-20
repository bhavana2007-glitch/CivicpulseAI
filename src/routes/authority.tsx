import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RoleGuard } from "@/components/RoleGuard";
import { DashShell } from "@/components/DashShell";
import { StatusStepper } from "@/components/StatusStepper";
import { ComplaintMap } from "@/components/ComplaintMap";
import { useAuth } from "@/lib/auth-context";
import {
  listUsersByRole,
  subscribeComplaints,
  updateComplaint,
} from "@/lib/complaints";
import type { Complaint, UserProfile } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

export const Route = createFileRoute("/authority")({
  component: () => (
    <RoleGuard role="authority">
      <AuthorityDashboard />
    </RoleGuard>
  ),
});

// Demo worker pool (used only if no real workers have registered yet)
const DEMO_WORKERS = [
  { uid: "w_ravi", name: "Ravi K.", lat: 18.5204, lng: 73.8567 },
  { uid: "w_asha", name: "Asha M.", lat: 18.535, lng: 73.847 },
  { uid: "w_pratik", name: "Pratik S.", lat: 18.51, lng: 73.865 },
  { uid: "w_neha", name: "Neha D.", lat: 18.525, lng: 73.88 },
];

type WorkerOpt = { uid: string; name: string; lat: number; lng: number; real?: boolean };

function AuthorityDashboard() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [workers, setWorkers] = useState<WorkerOpt[]>(DEMO_WORKERS);

  useEffect(() => {
    if (!user) return;
    return subscribeComplaints(setComplaints, {
      role: "authority",
      uid: user.uid,
    });
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const real = await listUsersByRole("worker" as UserProfile["role"]);
      if (cancelled) return;
      const realOpts: WorkerOpt[] = real.map((u, i) => ({
        uid: u.uid,
        name: u.name,
        lat: DEMO_WORKERS[i % DEMO_WORKERS.length].lat,
        lng: DEMO_WORKERS[i % DEMO_WORKERS.length].lng,
        real: true,
      }));
      setWorkers(realOpts.length ? [...realOpts, ...DEMO_WORKERS] : DEMO_WORKERS);
    }
    load();
    const t = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);


  const stats = useMemo(() => {
    const byStatus = complaints.reduce<Record<string, number>>((a, c) => {
      a[c.status] = (a[c.status] ?? 0) + 1;
      return a;
    }, {});
    const byCategory = complaints.reduce<Record<string, number>>((a, c) => {
      a[c.category] = (a[c.category] ?? 0) + 1;
      return a;
    }, {});
    return {
      total: complaints.length,
      open: complaints.filter((c) => c.status !== "completed").length,
      critical: complaints.filter((c) => c.priority === "critical").length,
      completed: byStatus.completed ?? 0,
      chart: Object.entries(byCategory).map(([name, count]) => ({
        name,
        count,
      })),
    };
  }, [complaints]);

  const filtered = complaints.filter(
    (c) => filter === "all" || c.status === filter,
  );

  return (
    <DashShell role="authority">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase text-navy">
            Authority Command
          </h1>
          <p className="text-sm text-muted-foreground">
            Triage, assign workers, monitor progress.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Open" value={stats.open} accent="amber" />
        <Stat label="Critical" value={stats.critical} accent="destructive" />
        <Stat label="Resolved" value={stats.completed} accent="moss" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="bento">
          <h2 className="mb-3 font-display text-lg font-bold uppercase text-navy">
            Complaints by Category
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
                  allowDecimals={false}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#f5b643" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bento">
          <h2 className="mb-3 font-display text-lg font-bold uppercase text-navy">
            Ward Heatmap
          </h2>
          <ComplaintMap complaints={complaints} height={256} />
        </div>
      </div>

      <div className="bento mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold uppercase text-navy">
            Complaint Queue
          </h2>
          <div className="flex flex-wrap gap-1">
            {[
              "all",
              "submitted",
              "verified",
              "assigned",
              "en_route",
              "in_progress",
              "completed",
            ].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  filter === f
                    ? "bg-navy text-cream"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {f === "all" ? "All" : STATUS_LABEL[f as Complaint["status"]]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
              No complaints match this filter.
            </p>
          )}
          {filtered.map((c) => (
            <AuthorityRow key={c.id} c={c} workers={workers} />
          ))}
        </div>
      </div>
    </DashShell>
  );
}

function Stat({
  label,
  value,
  accent = "navy",
}: {
  label: string;
  value: number;
  accent?: "navy" | "amber" | "moss" | "destructive";
}) {
  const color = {
    navy: "text-navy",
    amber: "text-amber",
    moss: "text-moss",
    destructive: "text-destructive",
  }[accent];
  return (
    <div className="bento">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-display text-4xl font-bold ${color}`}>
        {value}
      </div>
    </div>
  );
}

function AuthorityRow({ c, workers }: { c: Complaint; workers: WorkerOpt[] }) {
  const [busy, setBusy] = useState(false);
  const nearest = useMemo(() => {
    return [...workers]
      .map((w) => ({
        w,
        d: (w.lat - c.lat) ** 2 + (w.lng - c.lng) ** 2,
      }))
      .sort((a, b) => a.d - b.d)[0].w;
  }, [c.lat, c.lng, workers]);

  async function assign(workerId: string, workerName: string) {
    setBusy(true);
    await updateComplaint(c.id, {
      status: "assigned",
      assignedWorkerId: workerId,
      assignedWorkerName: workerName,
    });
    setBusy(false);
  }

  async function close() {
    setBusy(true);
    await updateComplaint(c.id, { status: "completed" });
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          {c.imageUrl && (
            <img
              src={c.imageUrl}
              alt=""
              className="h-16 w-16 rounded object-cover"
            />
          )}
          <div>
            <div className="font-mono text-[10px] uppercase text-muted-foreground">
              #{c.id.slice(-6)} · {c.department} ·{" "}
              {new Date(c.createdAt).toLocaleString()}
            </div>
            <div className="font-display text-sm font-bold text-navy">
              {c.category}{" "}
              <span className="ml-2 rounded-full bg-amber/20 px-2 py-0.5 font-mono text-[9px] uppercase">
                {c.priority}
              </span>
            </div>
            <div className="mt-1 max-w-xl text-xs text-muted-foreground">
              {c.description}
            </div>
            <div className="mt-1 font-mono text-[10px] text-moss">
              👤 {c.citizenName} · 📍 {c.lat.toFixed(3)}, {c.lng.toFixed(3)}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {!c.assignedWorkerId && (
            <>
              <div className="font-mono text-[10px] uppercase text-muted-foreground">
                AI suggests: <strong>{nearest.name}</strong>
              </div>
              <select
                onChange={(e) => {
                  const w = workers.find((x) => x.uid === e.target.value);
                  if (w) assign(w.uid, w.name);
                }}
                disabled={busy}
                defaultValue=""
                className="rounded border border-input bg-background px-2 py-1.5 font-mono text-[10px] uppercase"
              >
                <option value="" disabled>
                  Assign worker…
                </option>
                {workers.map((w) => (
                  <option key={w.uid} value={w.uid}>
                    {w.name}
                    {w.real ? " • live" : ""}
                    {w.uid === nearest.uid ? " ★ nearest" : ""}
                  </option>
                ))}
              </select>
            </>
          )}
          {c.assignedWorkerId && c.status !== "completed" && (
            <>
              <div className="font-mono text-[10px] uppercase text-moss">
                Assigned: {c.assignedWorkerName}
              </div>
              <button
                onClick={close}
                disabled={busy}
                className="rounded bg-moss px-3 py-1.5 font-mono text-[10px] uppercase text-cream hover:opacity-90"
              >
                Close complaint
              </button>
            </>
          )}
          {c.status === "completed" && (
            <div className="rounded bg-moss/20 px-2 py-1 font-mono text-[10px] uppercase text-moss">
              ✓ Resolved
            </div>
          )}
        </div>
      </div>
      <div className="mt-3">
        <StatusStepper status={c.status} />
      </div>
    </div>
  );
}
