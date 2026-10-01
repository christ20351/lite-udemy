"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const ICONS: Record<string, string> = {
  SESSION_RESCHEDULED: "📅",
  FORMATION_ASSIGNED: "🎓",
  NEW_ENROLLMENT: "✍️",
};

function ilYA(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[] | null>(null);
  const [unread, setUnread] = useState(0);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await api("/me/notifications");
      setItems(d.notifications);
      setUnread(d.unread);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // rafraîchit toutes les 30 s
    return () => clearInterval(t);
  }, [load]);

  // ferme le panneau au clic extérieur
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function openNotif(n: Notif) {
    if (!n.read) {
      try {
        await api(`/me/notifications/${n.id}/read`, { method: "PATCH" });
        setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
        setUnread((u) => Math.max(u - 1, 0));
      } catch {}
    }
    setOpen(false);
    if (n.link && n.link.startsWith("/")) router.push(n.link);
  }

  async function markAll() {
    try {
      await api("/me/notifications/read-all", { method: "POST" });
      setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
      setUnread(0);
    } catch {}
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        {/* cloche */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-96 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-fg">Notifications</p>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs text-primary hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-96 divide-y divide-line overflow-y-auto">
            {items === null && (
              <p className="px-4 py-6 text-center text-xs text-faint animate-pulse">Chargement…</p>
            )}
            {items?.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotif(n)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
                  n.read ? "" : "bg-primary/[0.06]"
                }`}
              >
                <span className="mt-0.5 text-lg leading-none">
                  {ICONS[n.type] ?? "🔔"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read ? "text-fg-soft" : "font-semibold text-fg"}`}>
                    {n.title}
                  </span>
                  {n.body && (
                    <span className="mt-0.5 block text-xs text-muted line-clamp-2">{n.body}</span>
                  )}
                  <span className="mt-1 block text-[11px] text-faint">{ilYA(n.createdAt)}</span>
                </span>
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                )}
              </button>
            ))}
            {items?.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-faint">
                Aucune notification pour le moment.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
