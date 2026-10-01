"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Bell, BellRing, CheckCheck } from "lucide-react";

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
 * Onglet Notifications de l'espace équipe : toutes les notifications de
 * l'application destinées au compte connecté (assignation de formation,
 * contenu prêt à relire, …). Clic = marquée lue + ouverture de la cible.
 */
export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await api("/me/notifications");
      setNotifications(d.notifications);
      setUnread(d.unread);
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function open(n: Notification) {
    if (!n.read) {
      await api(`/me/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => {});
    }
    await load();
    if (n.link) router.push(n.link);
  }

  async function markAllRead() {
    await api("/me/notifications/read-all", { method: "POST" }).catch(() => {});
    await load();
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="icon-tile">
            <Bell className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted text-sm mt-0.5">
              {unread > 0
                ? `${unread} non lu${unread > 1 ? "e" : ""}s`
                : "Tout est à jour"}
            </p>
          </div>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="card mt-6 divide-y divide-line overflow-hidden">
        {notifications?.map((n) => (
          <button
            key={n.id}
            onClick={() => open(n)}
            className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2 ${
              n.read ? "opacity-60" : ""
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                n.read
                  ? "bg-surface-2 text-muted"
                  : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
              }`}
            >
              <BellRing className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-fg">{n.title}</span>
                {!n.read && (
                  <span className="chip shrink-0 bg-indigo-500/15 text-[10px] text-indigo-600 dark:text-indigo-400">
                    Nouveau
                  </span>
                )}
              </span>
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
                {n.link && " · cliquez pour ouvrir"}
              </span>
            </span>
          </button>
        ))}

        {notifications?.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-faint">
            Aucune notification pour le moment.
          </p>
        )}
        {notifications === null && (
          <p className="px-5 py-10 text-center text-sm text-muted animate-pulse">
            Chargement…
          </p>
        )}
      </div>
    </div>
  );
}
