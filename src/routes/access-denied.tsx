import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/access-denied")({
  validateSearch: z.object({
    attempted: z.enum(["citizen", "authority", "worker"]).optional(),
  }),
  component: AccessDenied,
});

function AccessDenied() {
  const { profile } = useAuth();
  const { attempted } = Route.useSearch();
  const back = profile ? (`/${profile.role}` as const) : "/";
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="bento max-w-md text-center">
        <div className="mb-3 text-5xl">🚫</div>
        <h1 className="font-display text-2xl font-bold uppercase text-destructive">
          Access Denied
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You attempted to access the <strong>{attempted}</strong> dashboard,
          but your account role is{" "}
          <strong>{profile?.role ?? "unknown"}</strong>.
        </p>
        <Link
          to={back}
          className="mt-6 inline-block rounded-md bg-navy px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-cream"
        >
          Return to my dashboard
        </Link>
      </div>
    </div>
  );
}
