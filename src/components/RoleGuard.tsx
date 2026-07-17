import { Navigate, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";

export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  void router;

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="font-mono text-sm text-muted-foreground">
          LOADING SESSION…
        </div>
      </div>
    );

  if (!user || !profile) {
    return <Navigate to="/auth/$role/login" params={{ role }} />;
  }
  if (profile.role !== role) {
    return <Navigate to="/access-denied" search={{ attempted: role }} />;
  }
  if (!user.emailVerified) {
    return <Navigate to="/verify-email" />;
  }
  return <>{children}</>;
}
