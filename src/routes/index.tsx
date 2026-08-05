import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { firebaseConfigured } from "@/lib/firebase";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  const ticker = t("landing.ticker", { returnObjects: true }) as string[];
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
                {t("common.appName")}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber">
                {t("common.tagline")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <Link
              to="/feed"
              className="flex items-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-amber transition-colors hover:bg-amber/20"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-moss" />
              {t("common.liveFeed")}
            </Link>
            <div className="hidden font-mono text-[11px] uppercase tracking-widest text-cream/70 sm:block">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </div>
          </div>

        </div>
        {/* Ticker */}
        <div className="overflow-hidden border-t border-amber/30 bg-navy/95 py-2">
          <div className="ticker flex whitespace-nowrap font-mono text-xs text-amber">
            {[...ticker, ...ticker].map((s, i) => (
              <span key={i} className="mx-8">
                {s}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-12 text-center">
          <div className="mb-3 inline-block rounded-full border border-moss/40 bg-moss/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-moss">
            {t("landing.badge")}
          </div>
          <h1 className="font-display text-5xl font-bold uppercase tracking-tight text-navy md:text-6xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            {t("landing.heroSubtitle")}
          </p>
        </div>

        {!firebaseConfigured && (
          <div className="mx-auto mb-8 max-w-3xl rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 font-mono text-xs text-navy">
            <strong>{t("landing.demoMode")}</strong> {t("landing.demoModeText")}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <RoleCard
            emoji="👤"
            title={t("roles.citizen")}
            tagline={t("landing.citizenTagline")}
            role="citizen"
            accent="moss"
            features={t("landing.citizenFeatures", { returnObjects: true }) as string[]}
          />
          <RoleCard
            emoji="🏛"
            title={t("roles.authority")}
            tagline={t("landing.authorityTagline")}
            role="authority"
            accent="amber"
            features={t("landing.authorityFeatures", { returnObjects: true }) as string[]}
          />
          <RoleCard
            emoji="👷"
            title={t("landing.workerTitle")}
            tagline={t("landing.workerTagline")}
            role="worker"
            accent="navy"
            features={t("landing.workerFeatures", { returnObjects: true }) as string[]}
          />
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-4">
          {[
            { k: t("landing.statCategories"), v: "10", d: t("landing.statCategoriesDesc") },
            { k: t("landing.statStatuses"), v: "6", d: t("landing.statStatusesDesc") },
            { k: t("landing.statRoles"), v: "3", d: t("landing.statRolesDesc") },
            { k: t("landing.statRealtime"), v: "∞", d: t("landing.statRealtimeDesc") },
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
        {t("common.footer")}
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
  const { t } = useTranslation();
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
          {t("common.terminal")} {role.slice(0, 3).toUpperCase()}
        </div>
      </div>
      <h2 className="font-display text-2xl font-bold uppercase text-navy">
        {t("landing.loginCta", { role: title })}
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
          {t("common.login")}
        </Link>
        <Link
          to="/auth/$role/register"
          params={{ role }}
          className="flex-1 rounded-md border border-navy/30 px-4 py-2.5 text-center font-mono text-xs font-semibold uppercase tracking-wider text-navy transition-colors hover:bg-navy/5"
        >
          {t("common.register")}
        </Link>
      </div>
    </div>
  );
}
