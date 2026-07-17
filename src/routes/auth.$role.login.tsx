import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";

const VALID: Role[] = ["citizen", "authority", "worker"];

export const Route = createFileRoute("/auth/$role/login")({
  component: LoginPage,
});

function LoginPage() {
  const { role } = Route.useParams();
  const nav = useNavigate();
  const { login, resendVerification, firebaseReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);

  if (!VALID.includes(role as Role)) {
    return (
      <AuthShell title="Invalid role">
        <p className="text-sm text-muted-foreground">
          Unknown role: <code>{role}</code>
        </p>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          Return home
        </Link>
      </AuthShell>
    );
  }

  const r = role as Role;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password, r);
      nav({ to: `/${r}` as "/citizen" | "/authority" | "/worker" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed";
      setErr(msg);
      if (msg.toLowerCase().includes("verify")) setNeedsVerify(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={`${cap(r)} Login`}>
      <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Terminal · {r.toUpperCase()} · Secure Sign-In
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        {err && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {err}
            {needsVerify && (
              <button
                type="button"
                onClick={async () => {
                  await resendVerification();
                  setErr("Verification email resent. Check your inbox.");
                }}
                className="ml-2 underline"
              >
                Resend verification email
              </button>
            )}
          </div>
        )}
        <button
          disabled={busy}
          className="w-full rounded-md bg-navy px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <div className="mt-6 flex items-center justify-between text-xs">
        <Link
          to="/auth/$role/register"
          params={{ role: r }}
          className="text-navy underline"
        >
          Create account
        </Link>
        <Link to="/" className="text-muted-foreground">
          ← Home
        </Link>
      </div>
      {!firebaseReady && (
        <p className="mt-4 rounded bg-amber/10 p-2 font-mono text-[10px] text-navy">
          Demo mode — no Firebase config. Register, then click "Resend
          verification" to auto-verify.
        </p>
      )}
    </AuthShell>
  );
}

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-navy/20 bg-navy px-6 py-4 text-cream">
        <Link
          to="/"
          className="font-display text-lg font-bold uppercase tracking-widest"
        >
          ← CivicPulse
        </Link>
      </header>
      <div className="mx-auto flex max-w-md flex-col px-6 py-12">
        <div className="bento">
          <h1 className="font-display text-2xl font-bold uppercase text-navy">
            {title}
          </h1>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30"
      />
    </label>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
