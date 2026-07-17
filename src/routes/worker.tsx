import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { DashShell } from "@/components/DashShell";
import { StatusStepper } from "@/components/StatusStepper";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeComplaints,
  updateComplaint,
  uploadImage,
} from "@/lib/complaints";
import type { Complaint, ComplaintStatus } from "@/lib/types";

export const Route = createFileRoute("/worker")({
  component: () => (
    <RoleGuard role="worker">
      <WorkerDashboard />
    </RoleGuard>
  ),
});

const NEXT: Partial<Record<ComplaintStatus, ComplaintStatus>> = {
  assigned: "en_route",
  en_route: "in_progress",
  in_progress: "completed",
};
const LABEL: Partial<Record<ComplaintStatus, string>> = {
  assigned: "Accept & En Route",
  en_route: "Start Work",
  in_progress: "Mark Completed",
};

function WorkerDashboard() {
  const { user, profile } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  useEffect(() => {
    if (!user) return;
    // Show any complaint whose assignedWorkerName matches (mock),
    // or assignedWorkerId matches this uid.
    return subscribeComplaints(
      (all) => {
        setComplaints(
          all.filter(
            (c) =>
              c.assignedWorkerId === user.uid ||
              c.assignedWorkerName === profile?.name,
          ),
        );
      },
      { role: "authority", uid: user.uid }, // fetch all, filter locally
    );
  }, [user, profile?.name]);

  const active = complaints.filter((c) => c.status !== "completed");
  const done = complaints.filter((c) => c.status === "completed");

  return (
    <DashShell role="worker">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold uppercase text-navy">
          Field Ops
        </h1>
        <p className="text-sm text-muted-foreground">
          Assigned complaints, navigation, proof-of-completion.
        </p>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MiniStat label="Active" v={active.length} c="text-amber" />
        <MiniStat label="Completed" v={done.length} c="text-moss" />
        <MiniStat label="Total assigned" v={complaints.length} c="text-navy" />
      </div>

      <div className="space-y-4">
        {complaints.length === 0 && (
          <div className="bento text-center">
            <p className="text-sm text-muted-foreground">
              No tasks assigned yet. Assignments from the Authority terminal
              will appear here in real time.
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase text-muted-foreground">
              (Demo: an Authority must assign you a complaint. In demo mode,
              use the same display name across the Authority mock worker list.)
            </p>
          </div>
        )}
        {active.map((c) => (
          <WorkerTaskCard key={c.id} c={c} />
        ))}
        {done.length > 0 && (
          <details className="bento">
            <summary className="cursor-pointer font-display text-sm font-bold uppercase text-navy">
              Completed ({done.length})
            </summary>
            <div className="mt-3 space-y-2">
              {done.map((c) => (
                <WorkerTaskCard key={c.id} c={c} />
              ))}
            </div>
          </details>
        )}
      </div>
    </DashShell>
  );
}

function MiniStat({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <div className="bento">
      <div className="font-mono text-[10px] uppercase text-muted-foreground">
        {label}
      </div>
      <div className={`font-display text-3xl font-bold ${c}`}>{v}</div>
    </div>
  );
}

function WorkerTaskCard({ c }: { c: Complaint }) {
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<string | null>(c.proofUrl ?? null);
  const nextStatus = NEXT[c.status];

  async function advance() {
    if (!nextStatus) return;
    setBusy(true);
    const patch: Partial<Complaint> = { status: nextStatus };
    if (nextStatus === "completed" && proof && proof !== c.proofUrl) {
      patch.proofUrl = await uploadImage(
        `proofs/${c.id}_${Date.now()}.jpg`,
        proof,
      );
    }
    await updateComplaint(c.id, patch);
    setBusy(false);
  }

  function onFile(f: File) {
    const r = new FileReader();
    r.onload = () => setProof(r.result as string);
    r.readAsDataURL(f);
  }

  return (
    <div className="bento">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          {c.imageUrl && (
            <img
              src={c.imageUrl}
              alt=""
              className="h-24 w-24 rounded object-cover"
            />
          )}
          <div>
            <div className="font-mono text-[10px] uppercase text-muted-foreground">
              TASK #{c.id.slice(-6)} · {c.department}
            </div>
            <div className="font-display text-lg font-bold text-navy">
              {c.category}
            </div>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              {c.description}
            </p>
            <div className="mt-2 font-mono text-[10px] text-moss">
              📍 {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-navy px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-navy hover:bg-navy/5"
          >
            🧭 Navigate
          </a>
          {c.status === "in_progress" && (
            <label className="cursor-pointer rounded-md border border-amber bg-amber/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-navy hover:bg-amber/20">
              📸 Upload proof
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
          )}
          {nextStatus && (
            <button
              onClick={advance}
              disabled={busy || (nextStatus === "completed" && !proof)}
              className="rounded-md bg-moss px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-cream hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "…" : LABEL[c.status]}
            </button>
          )}
        </div>
      </div>
      {proof && (
        <div className="mt-3">
          <div className="font-mono text-[10px] uppercase text-moss">
            Proof photo
          </div>
          <img
            src={proof}
            alt="Proof"
            className="mt-1 h-32 rounded object-cover"
          />
        </div>
      )}
      <div className="mt-3">
        <StatusStepper status={c.status} />
      </div>
    </div>
  );
}
