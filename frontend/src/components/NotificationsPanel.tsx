"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

/**
 * Panneau de notifications internes (ex : nouvelle formation assignée).
 * Affiché sur la page d'accueil du formateur — rafraîchi toutes les 30 s.
 */
export default function NotificationsPanel() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api("/me/notifications");
      setNotifications(d.notifications);
      setUnread(d.unread);
      // Panneau déplié par défaut tant qu'il y a des non-lues
      setOpen((prev) => (prev ? true : d.unread > 0 ? true : prev));
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function markRead(id: string, link: string | null) {
    try {
      await api(`/me/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      /* déjà lue ou supprimée : on continue */
    }
    await load();
    if (link) router.push(link);
  }

  async function markAllRead() {
    await api("/me/notifications/read-all", { method: "POST" }).catch(() => {});
    await load();
  }

  if (notifications === null || notifications.length === 0) return null;

  return (
    <section
      className={`mt-6 overflow-hidden rounded-xl border ${
        unread > 0 ? "border-indigo-500/50 bg-indigo-500/10" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 text-sm font-bold text-fg"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white">
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
                {unread}
              </span>
            )}
          </span>
          Notifications
          {unread > 0 && (
            <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              {unread} nouvelle{unread > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-faint">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
        </button>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {open && (
        <div className="divide-y divide-line border-t border-line">
          {notifications.slice(0, 8).map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id, n.link)}
              className={`flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2 ${
                n.read ? "opacity-60" : ""
              }`}
            >
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  n.read ? "bg-slate-400" : "bg-indigo-600"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-fg">{n.title}</span>
                {n.body && (
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">{n.body}</span>
                )}
                <span className="mt-1 block text-[11px] text-faint">
                  {new Date(n.createdAt).toLocaleString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {n.link && " · cliquez pour ouvrir la formation"}
                </span>
              </span>
              {!n.read && (
                <span className="chip shrink-0 bg-indigo-500/15 text-[10px] text-indigo-600 dark:text-indigo-400">
                  Nouveau
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
