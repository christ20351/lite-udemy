"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type LearnerDetail = {
  learner: { id: string; name: string; email: string; createdAt: string };
  formations: Array<{
    id: string;
    title: string;
    mode: string;
    grantedAt: string;
    grantedByName: string | null;
    selfEnrolled: boolean;
    totalLessons: number;
    completedLessons: number;
    percent: number;
  }>;
  quizAttempts: Array<{
    id: string;
    score: number;
    total: number;
    createdAt: string;
    lessonTitle: string;
    formationTitle: string;
  }>;
  sessions: Array<{
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    attended: boolean;
    formationTitle: string;
  }>;
};

const MODE_LABELS = { ONLINE: "En ligne", ONSITE: "Présentiel", HYBRID: "Hybride" } as const;

export default function ApprenantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<LearnerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api(`/learners/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="p-8">
        <Link href="/backoffice/apprenants" className="text-sm text-primary hover:underline">
          ← Tous les apprenants
        </Link>
        <p className="notice-box mt-4">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-8">
        <p className="text-muted animate-pulse">Chargement…</p>
      </div>
    );
  }

  const { learner, formations, quizAttempts, sessions } = data;
  const globalPercent = formations.length
    ? Math.round(formations.reduce((a, f) => a + f.percent, 0) / formations.length)
    : 0;

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/backoffice/apprenants" className="text-sm text-primary hover:underline">
        ← Tous les apprenants
      </Link>

      <div className="mt-3 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">{learner.name}</h1>
          <p className="text-sm text-muted mt-0.5">
            {learner.email} · apprenant depuis le{" "}
            {new Date(learner.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="card px-5 py-4 text-center">
          <p className="text-3xl font-bold text-fg">{globalPercent}%</p>
          <p className="text-xs text-muted mt-1">progression moyenne</p>
        </div>
      </div>

      {/* Formations suivies */}
      <section className="mt-8">
        <h2 className="font-semibold">Formations suivies</h2>
        <div className="mt-3 space-y-3">
          {formations.map((f) => (
            <div key={f.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-fg">{f.title}</p>
                  <p className="text-xs text-faint mt-0.5">
                    {MODE_LABELS[f.mode as keyof typeof MODE_LABELS] ?? f.mode} ·{" "}
                    {f.selfEnrolled
                      ? "auto-inscription"
                      : `inscrit par ${f.grantedByName ?? "l'équipe"}`}{" "}
                    le {new Date(f.grantedAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <p className="text-sm font-semibold text-fg shrink-0">
                  {f.completedLessons}/{f.totalLessons} leçons
                </p>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${
                      f.percent === 100 ? "bg-indigo-600" : "bg-indigo-500"
                    }`}
                    style={{ width: `${f.percent}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-medium text-muted">
                  {f.percent}%
                </span>
              </div>
            </div>
          ))}
          {formations.length === 0 && (
            <p className="text-sm text-faint">Aucune inscription à une formation.</p>
          )}
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Quiz */}
        <section>
          <h2 className="font-semibold">Résultats aux quiz</h2>
          <div className="mt-3 card divide-y divide-line overflow-hidden">
            {quizAttempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{a.lessonTitle}</p>
                  <p className="text-xs text-faint">{a.formationTitle}</p>
                </div>
                <span
                  className={`chip shrink-0 ${
                    a.score / a.total >= 0.7
                      ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {a.score}/{a.total}
                </span>
              </div>
            ))}
            {quizAttempts.length === 0 && (
              <p className="px-4 py-4 text-sm text-faint">Aucun quiz passé.</p>
            )}
          </div>
        </section>

        {/* Sessions */}
        <section>
          <h2 className="font-semibold">Sessions</h2>
          <div className="mt-3 card divide-y divide-line overflow-hidden">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{s.title}</p>
                  <p className="text-xs text-faint">
                    {s.formationTitle} ·{" "}
                    {new Date(s.startAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={`chip shrink-0 ${
                    s.attended
                      ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {s.attended ? "Présent" : "Non pointé"}
                </span>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="px-4 py-4 text-sm text-faint">Aucune session.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
