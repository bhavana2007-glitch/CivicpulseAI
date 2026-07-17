import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";
import { AuthShell, Field } from "./auth.$role.login";

const VALID: Role[] = ["citizen", "authority", "worker"];

export const Route = createFileRoute("/auth/$role/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { role } = Route.useParams();
  const nav = useNavigate();
  const { register, firebaseReady } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!VALID.includes(role as Role)) {
    return (
      <AuthShell title="Invalid role">
        <Link to="/" className="text-sm underline">
          Return home
        </Link>
      </AuthShell>
    );
  }
  const r = role as Role;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await register(email, password, name, r);
      setOk(
        "Account created. Verification email sent — please verify before logging in.",
      );
      setTimeout(() => nav({ to: "/auth/$role/login", params: { role: r } }), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      if (msg.startsWith("MOCK_UNVERIFIED:")) {
        setOk(msg.replace("MOCK_UNVERIFIED:", ""));
        setTimeout(
          () => nav({ to: "/auth/$role/login", params: { role: r } }),
          1500,
        );
      } else setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={`${cap(r)} Registration`}>
      <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Terminal · {r.toUpperCase()} · New Account
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full Name" value={name} onChange={setName} required />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label="Password (min 6 chars)"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        {err && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {err}
          </div>
        )}
        {ok && (
          <div className="rounded-md border border-moss/40 bg-moss/10 px-3 py-2 text-xs text-moss">
            {ok}
          </div>
        )}
        <button
          disabled={busy}
          className="w-full rounded-md bg-navy px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-cream hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create Account"}
        </button>
      </form>
      <div className="mt-6 flex items-center justify-between text-xs">
        <Link
          to="/auth/$role/login"
          params={{ role: r }}
          className="text-navy underline"
        >
          Have an account? Sign in
        </Link>
        <Link to="/" className="text-muted-foreground">
          ← Home
        </Link>
      </div>
      {!firebaseReady && (
        <p className="mt-4 rounded bg-amber/10 p-2 font-mono text-[10px] text-navy">
          Demo mode — no Firebase config. Users stored locally in-browser.
        </p>
      )}
    </AuthShell>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
