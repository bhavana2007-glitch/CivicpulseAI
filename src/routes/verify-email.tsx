import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { user, resendVerification, refreshUser, logout } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);

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
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="bento">
          <div className="mb-4 text-5xl">✉️</div>
          <h1 className="font-display text-2xl font-bold uppercase text-navy">
            Verify your email
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We sent a verification link to{" "}
            <strong>{user?.email ?? "your inbox"}</strong>. Please verify your
            email before accessing your dashboard.
          </p>
          {msg && (
            <div className="mt-4 rounded-md border border-moss/40 bg-moss/10 px-3 py-2 text-xs text-moss">
              {msg}
            </div>
          )}
          <div className="mt-6 space-y-2">
            <button
              onClick={async () => {
                await resendVerification();
                setMsg("Verification email resent.");
              }}
              className="w-full rounded-md bg-amber px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-navy"
            >
              Resend verification email
            </button>
            <button
              onClick={async () => {
                await refreshUser();
                setMsg("Session refreshed — try navigating to your dashboard.");
              }}
              className="w-full rounded-md border border-navy px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-navy"
            >
              I've verified — refresh
            </button>
            <button
              onClick={() => logout()}
              className="w-full font-mono text-[10px] uppercase tracking-widest text-muted-foreground underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
