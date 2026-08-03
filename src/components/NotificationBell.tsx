import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from "@/lib/notifications";
import { STATUS_LABEL, type AppNotification } from "@/lib/types";

const EVENT_DOT: Record<AppNotification["event"], string> = {
  submitted: "bg-navy",
  verified: "bg-moss",
  assigned: "bg-amber",
  in_progress: "bg-orange-400",
  resolved: "bg-moss",
  rejected: "bg-destructive",
};

function timeAgo(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeNotifications(user.uid, (list) => {
      const fresh = list.some((n) => !seen.current.has(n.id));
      const first = seen.current.size === 0;
      list.forEach((n) => seen.current.add(n.id));
      setItems(list);
      if (fresh && !first) {
        setPulse(true);
        setTimeout(() => setPulse(false), 1200);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unread = useMemo(() => items.filter((n) => !n.read), [items]);

  async function openNotification(n: AppNotification) {
    setOpen(false);
    if (!n.read) await markNotificationRead(n.id);
    navigate({ to: "/track/$id", params: { id: n.complaintId } });
  }

  if (!user) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className={`relative grid h-9 w-9 place-items-center rounded-full border border-cream/30 text-cream transition-colors hover:bg-cream/10 ${
          pulse ? "animate-bell-ring" : ""
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4.5 w-4.5"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-amber px-1 font-mono text-[10px] font-bold text-navy shadow animate-badge-pop">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,22rem)] origin-top-right overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-panel-in">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="font-display text-sm font-bold uppercase text-navy">
              Notifications
            </span>
            {unread.length > 0 && (
              <button
                onClick={() =>
                  markAllNotificationsRead(
                    user.uid,
                    unread.map((n) => n.id),
                  )
                }
                className="font-mono text-[10px] uppercase tracking-wider text-moss hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {items.length === 0 && (
              <p className="p-6 text-center text-xs text-muted-foreground">
                No notifications yet.
              </p>
            )}
            {items.map((n, i) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                className={`flex w-full animate-notif-in items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${
                  n.read ? "opacity-70" : "bg-amber/5"
                }`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${EVENT_DOT[n.event]} ${
                    n.read ? "opacity-40" : "animate-pulse"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-xs font-bold uppercase text-navy">
                      {n.title}
                    </span>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {n.message}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1 font-mono text-[9px] uppercase tracking-wider">
                    <span className="rounded bg-navy/10 px-1.5 py-0.5 text-navy">
                      #{n.complaintId.slice(-6)}
                    </span>
                    <span className="rounded bg-moss/15 px-1.5 py-0.5 text-moss">
                      {n.category}
                    </span>
                    <span className="rounded bg-amber/20 px-1.5 py-0.5 text-navy">
                      {STATUS_LABEL[n.status]}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
