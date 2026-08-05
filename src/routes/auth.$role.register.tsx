import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { useLabels } from "@/lib/i18n/labels";
import type { Role } from "@/lib/types";
import { AuthShell, Field } from "./auth.$role.login";

const VALID: Role[] = ["citizen", "authority", "worker"];

export const Route = createFileRoute("/auth/$role/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { role } = Route.useParams();
  const nav = useNavigate();
  const { t } = useTranslation();
  const { role: roleName } = useLabels();
  const { register, firebaseReady } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!VALID.includes(role as Role)) {
    return (
      <AuthShell title={t("auth.invalidRole")}>
        <Link to="/" className="text-sm underline">
          {t("auth.returnHome")}
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
      setOk(t("auth.accountCreated"));
      setTimeout(() => nav({ to: "/auth/$role/login", params: { role: r } }), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("auth.registrationFailed");
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
    <AuthShell title={t("auth.registerTitle", { role: roleName(r) })}>
      <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {t("common.terminal")} · {roleName(r)} · {t("auth.newAccount")}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("auth.fullName")} value={name} onChange={setName} required />
        <Field
          label={t("auth.email")}
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label={t("auth.passwordHint")}
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
          {busy ? t("auth.creating") : t("auth.createAccount")}
        </button>
      </form>
      <div className="mt-6 flex items-center justify-between text-xs">
        <Link
          to="/auth/$role/login"
          params={{ role: r }}
          className="text-navy underline"
        >
          {t("auth.haveAccount")}
        </Link>
        <Link to="/" className="text-muted-foreground">
          {t("common.back")}
        </Link>
      </div>
      {!firebaseReady && (
        <p className="mt-4 rounded bg-amber/10 p-2 font-mono text-[10px] text-navy">
          {t("auth.demoRegister")}
        </p>
      )}
    </AuthShell>
  );
}
