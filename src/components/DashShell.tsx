import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useAuth } from "@/lib/auth-context";
import { useLabels } from "@/lib/i18n/labels";
import type { Role } from "@/lib/types";


export function DashShell({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { profile, logout } = useAuth();
  const { t } = useTranslation();
  const { role: roleName } = useLabels();
  const accent = {
    citizen: "bg-moss",
    authority: "bg-amber",
    worker: "bg-navy",
  }[role];
  const accentFg = role === "authority" ? "text-navy" : "text-cream";
  return (
    <div className="min-h-screen">
      <header className="border-b border-navy/20 bg-navy text-cream">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid h-8 w-8 place-items-center rounded bg-amber font-display text-sm font-bold text-navy"
            >
              CP
            </Link>
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-widest">
                {t("common.appName")}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-amber">
                {t("common.terminal")} · {roleName(role)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <NotificationBell />
            <div className="hidden text-right md:block">
              <div className="font-mono text-[10px] uppercase tracking-widest text-cream/60">
                {profile ? roleName(profile.role) : ""}
              </div>
              <div className="text-sm">{profile?.name ?? profile?.email}</div>
            </div>
            <div

              className={`grid h-9 w-9 place-items-center rounded-full ${accent} ${accentFg} font-display font-bold`}
            >
              {(profile?.name ?? profile?.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <button
              onClick={() => logout()}
              className="rounded border border-cream/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest hover:bg-cream/10"
            >
              {t("common.signOut")}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
