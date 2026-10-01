"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Donut, { type DonutSegment } from "@/components/Donut";
import { api } from "@/lib/api";

type Stats = {
  clients: { total: number; byStatus: Record<string, number> };
  contactsTotal: number;
  formations: { total: number; byStatus: Record<string, number>; byMode: Record<string, number> };
  lessons: { total: number; withVideo: number };
  subscriptions: { byStatus: Record<string, number>; seatsTotal: number };
  accessesTotal: number;
  sessions: { upcoming: number; past: number; participantsTotal: number; participantsAttended: number };
  completedLessons: number;
  recentInteractions: Array<{
    id: string; type: string; content: string; createdAt: string;
    client: { id: string; name: string }; author: { name: string } | null;
  }>;
  recentFormations: Array<{
    id: string; title: string; status: string; mode: string; createdAt: string;
    _count: { sections: number; accesses: number };
  }>;
};

const C = {
  indigo: "#6366f1",
  violet: "#8b5cf6",
  sky: "#0ea5e9",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  slate: "#94a3b8",
};

const CLIENT_STATUS: Record<string, { label: string; color: string }> = {
  LEAD: { label: "Leads", color: C.slate },
  PROSPECT: { label: "Prospects", color: C.amber },
  CLIENT: { label: "Clients", color: C.emerald },
  INACTIVE: { label: "Inactifs", color: C.red },
};

const INTERACTION_ICON: Record<string, string> = {
  CALL: "📞",
  EMAIL: "✉️",
  MEETING: "🤝",
  NOTE: "📝",
};

export default function BackofficeHome() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api("/stats/dashboard")
      .then((d) => setStats(d))
      .catch(() => setStats(null));
  }, []);

  if (!stats) {
    return (
      <div className="p-8">
        <p className="text-muted animate-pulse">Chargement du tableau de bord…</p>
      </div>
    );
  }

  // Donuts
  const publiee = stats.formations.byStatus.PUBLISHED ?? 0;
  const brouillon = stats.formations.byStatus.DRAFT ?? 0;
  const statutSegments: DonutSegment[] = [
    { label: "Publiées", value: publiee, color: C.emerald },
    { label: "Brouillons", value: brouillon, color: C.amber },
  ];

  const modeSegments: DonutSegment[] = [
    { label: "En ligne", value: stats.formations.byMode.ONLINE ?? 0, color: C.indigo },
    { label: "Présentiel", value: stats.formations.byMode.ONSITE ?? 0, color: C.violet },
    { label: "Hybride", value: stats.formations.byMode.HYBRID ?? 0, color: C.sky },
  ];

  const seats = stats.subscriptions.seatsTotal;
  const attributionSegments: DonutSegment[] = [
    { label: "Accès attribués", value: stats.accessesTotal, color: C.emerald },
    { label: "Places libres", value: Math.max(seats - stats.accessesTotal, 0), color: C.slate },
  ];

  const presenceSegments: DonutSegment[] = [
    { label: "Présents", value: stats.sessions.participantsAttended, color: C.emerald },
    {
      label: "Non pointés",
      value: Math.max(stats.sessions.participantsTotal - stats.sessions.participantsAttended, 0),
      color: C.slate,
    },
  ];

  const contenuSegments: DonutSegment[] = [
    { label: "Leçons avec vidéo", value: stats.lessons.withVideo, color: C.violet },
    { label: "Leçons texte", value: stats.lessons.total - stats.lessons.withVideo, color: C.sky },
  ];

  const clientSegments: DonutSegment[] = Object.entries(CLIENT_STATUS).map(([k, v]) => ({
    label: v.label,
    value: stats.clients.byStatus[k] ?? 0,
    color: v.color,
  }));

  const cards = [
    { label: "Clients", value: stats.clients.total, href: "/backoffice/clients", grad: "from-indigo-500 to-indigo-600", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
    { label: "Contacts apprenants", value: stats.contactsTotal, href: "/backoffice/contacts", grad: "from-sky-500 to-sky-600", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
    { label: "Formations", value: stats.formations.total, href: "/backoffice/formations", grad: "from-violet-500 to-violet-600", icon: "M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" },
    { label: "Sessions à venir", value: stats.sessions.upcoming, href: "/backoffice/sessions", grad: "from-amber-500 to-orange-500", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" },
  ];

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted">
          Vue d&apos;ensemble de l&apos;activité de l&apos;organisme.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="card group p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${c.grad} text-white shadow-md`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={c.icon} />
              </svg>
            </div>
            <p className="text-3xl font-bold text-fg">{c.value}</p>
            <p className="mt-1 text-sm text-muted transition-colors group-hover:text-primary">{c.label}</p>
          </Link>
        ))}
      </div>

      {/* Donuts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Formations par statut
          </h3>
          <Donut segments={statutSegments} centerLabel={stats.formations.total} centerSub="formations" />
        </div>
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Répartition par mode
          </h3>
          <Donut segments={modeSegments} centerLabel={stats.formations.total} centerSub="modes" />
        </div>
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Places souscrites → accès
          </h3>
          <Donut segments={attributionSegments} centerLabel={stats.accessesTotal} centerSub={`/${seats} places`} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Contenu du catalogue
          </h3>
          <Donut segments={contenuSegments} centerLabel={stats.lessons.total} centerSub="leçons" />
        </div>
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Présences en session
          </h3>
          <Donut segments={presenceSegments} centerLabel={stats.completedLessons} centerSub="leçons terminées" />
        </div>
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Clients par statut
          </h3>
          <Donut segments={clientSegments} centerLabel={stats.clients.total} centerSub="clients" />
        </div>
      </div>

      {/* Activité */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Dernières interactions CRM
          </h3>
          <div className="space-y-3">
            {stats.recentInteractions.map((i) => (
              <Link
                key={i.id}
                href={`/backoffice/clients/${i.client.id}`}
                className="flex items-start gap-3 rounded-lg p-2 -m-2 transition-colors hover:bg-surface-2"
              >
                <span className="text-lg leading-none">{INTERACTION_ICON[i.type] ?? "📝"}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{i.content}</p>
                  <p className="text-xs text-faint">
                    {i.client.name} · {i.author?.name ?? "—"} ·{" "}
                    {new Date(i.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </Link>
            ))}
            {stats.recentInteractions.length === 0 && (
              <p className="text-sm text-faint">Aucune interaction enregistrée.</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Dernières formations
          </h3>
          <div className="space-y-3">
            {stats.recentFormations.map((f) => (
              <Link
                key={f.id}
                href={`/backoffice/formations/${f.id}`}
                className="flex items-center justify-between gap-3 rounded-lg p-2 -m-2 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{f.title}</p>
                  <p className="text-xs text-faint">
                    {f._count.sections} section{f._count.sections > 1 ? "s" : ""} ·{" "}
                    {f._count.accesses} apprenant{f._count.accesses > 1 ? "s" : ""}
                  </p>
                </div>
                <span
                  className={`chip shrink-0 ${
                    f.status === "PUBLISHED"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {f.status === "PUBLISHED" ? "Publiée" : "Brouillon"}
                </span>
              </Link>
            ))}
            {stats.recentFormations.length === 0 && (
              <p className="text-sm text-faint">Aucune formation.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
