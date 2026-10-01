"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, GraduationCap, UserPlus, Users } from "lucide-react";
import Donut, { type DonutSegment } from "@/components/Donut";
import { api } from "@/lib/api";

type Stats = {
  learnersTotal: number;
  formations: { total: number; byStatus: Record<string, number>; byMode: Record<string, number> };
  lessons: { total: number; withVideo: number };
  enrollments: { total: number; last30d: number };
  activeLearners30d: number;
  sessions: { upcoming: number; past: number; participantsTotal: number; participantsAttended: number };
  completedLessons: number;
  recentEnrollments: Array<{
    id: string;
    grantedAt: string;
    selfEnrolled: boolean;
    learner: { id: string; name: string };
    formation: { id: string; title: string };
    grantedByName: string | null;
  }>;
  recentFormations: Array<{
    id: string; title: string; status: string; mode: string; createdAt: string;
    _count: { sections: number; enrollments: number };
  }>;
};

// Palette monochrome : une seule teinte (indigo), déclinée en intensités,
// plus un neutre pour "le reste".
const C = {
  indigo: "#6366f1",
  indigoStrong: "#4f46e5",
  indigoSoft: "#818cf8",
  indigoLight: "#a5b4fc",
  neutral: "#94a3b8",
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
    { label: "Publiées", value: publiee, color: C.indigo },
    { label: "Brouillons", value: brouillon, color: C.neutral },
  ];

  const modeSegments: DonutSegment[] = [
    { label: "En ligne", value: stats.formations.byMode.ONLINE ?? 0, color: C.indigo },
    { label: "Présentiel", value: stats.formations.byMode.ONSITE ?? 0, color: C.indigoSoft },
    { label: "Hybride", value: stats.formations.byMode.HYBRID ?? 0, color: C.indigoLight },
  ];

  const engagementSegments: DonutSegment[] = [
    { label: "Apprenants actifs (30 j)", value: stats.activeLearners30d, color: C.indigo },
    {
      label: "Inactifs",
      value: Math.max(stats.learnersTotal - stats.activeLearners30d, 0),
      color: C.neutral,
    },
  ];

  const presenceSegments: DonutSegment[] = [
    { label: "Présents", value: stats.sessions.participantsAttended, color: C.indigo },
    {
      label: "Non pointés",
      value: Math.max(stats.sessions.participantsTotal - stats.sessions.participantsAttended, 0),
      color: C.neutral,
    },
  ];

  const contenuSegments: DonutSegment[] = [
    { label: "Leçons avec vidéo", value: stats.lessons.withVideo, color: C.indigo },
    { label: "Leçons texte", value: stats.lessons.total - stats.lessons.withVideo, color: C.indigoLight },
  ];

  const cards = [
    { label: "Apprenants", value: stats.learnersTotal, href: "/backoffice/apprenants", Icon: Users },
    { label: "Formations", value: stats.formations.total, href: "/backoffice/formations", Icon: BookOpen },
    { label: "Inscriptions (30 j)", value: stats.enrollments.last30d, href: "/backoffice/progression", Icon: UserPlus },
    { label: "Sessions à venir", value: stats.sessions.upcoming, href: "/backoffice/sessions", Icon: CalendarDays },
  ];

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted">
          Vue d&apos;ensemble de l&apos;activité pédagogique.
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
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25">
              <c.Icon className="h-[18px] w-[18px]" />
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
            Engagement des apprenants
          </h3>
          <Donut segments={engagementSegments} centerLabel={stats.activeLearners30d} centerSub={`/${stats.learnersTotal} actifs 30 j`} />
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
        <div className="card p-5 flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted mb-4">
            Inscriptions totales
          </p>
          <p className="text-4xl font-bold text-fg">{stats.enrollments.total}</p>
          <p className="mt-1 text-sm text-muted">
            dont {stats.enrollments.last30d} sur les 30 derniers jours
          </p>
        </div>
      </div>

      {/* Activité */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Dernières inscriptions
          </h3>
          <div className="space-y-3">
            {stats.recentEnrollments.map((e) => (
              <Link
                key={e.id}
                href={`/backoffice/apprenants/${e.learner.id}`}
                className="flex items-start gap-3 rounded-lg p-2 -m-2 transition-colors hover:bg-surface-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <GraduationCap className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">
                    {e.learner.name} → {e.formation.title}
                  </p>
                  <p className="text-xs text-faint">
                    {e.selfEnrolled
                      ? "Auto-inscription"
                      : `Inscrit par ${e.grantedByName ?? "l'équipe"}`}{" "}
                    ·{" "}
                    {new Date(e.grantedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </Link>
            ))}
            {stats.recentEnrollments.length === 0 && (
              <p className="text-sm text-faint">Aucune inscription pour le moment.</p>
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
                    {f._count.enrollments} apprenant{f._count.enrollments > 1 ? "s" : ""}
                  </p>
                </div>
                <span
                  className={`chip shrink-0 ${
                    f.status === "PUBLISHED"
                      ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      : "bg-surface-2 text-muted"
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
