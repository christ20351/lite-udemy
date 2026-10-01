"use client";

import { useEffect, useState } from "react";
import BarChart from "@/components/BarChart";
import Donut from "@/components/Donut";
import { api } from "@/lib/api";

type Analytics = {
  enrollmentsByMonth: Record<string, number>;
  selfEnrolled: number;
  grantedEnrollments: number;
  activeLearners30d: number;
  topFormations: Array<{ id: string; title: string; learners: number; avgCompletion: number }>;
  quizAverages: Array<{ id: string; title: string; avgScore: number; attempts: number }>;
};

const MONTH_LABELS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    api("/stats/pedagogique")
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-muted animate-pulse">Chargement des analytics…</p>
      </div>
    );
  }

  const monthly = Object.entries(data.enrollmentsByMonth).map(([key, value]) => {
    const [, m] = key.split("-");
    return { label: MONTH_LABELS[Number(m) - 1] ?? key, value };
  });
  const totalEnrollments = Object.values(data.enrollmentsByMonth).reduce((a, b) => a + b, 0);

  const originSegments = [
    { label: "Auto-inscriptions", value: data.selfEnrolled, color: "#4f46e5" },
    { label: "Inscrits par l'équipe", value: data.grantedEnrollments, color: "#818cf8" },
  ];

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">Analytics pédagogiques</h1>
        <p className="mt-1 text-sm text-muted">
          Inscriptions, progression et réussite — mis à jour en temps réel.
        </p>
      </div>

      {/* Inscriptions sur 6 mois */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Inscriptions — 6 derniers mois
          </h3>
          <span className="text-xl font-bold text-primary">{totalEnrollments}</span>
        </div>
        <BarChart data={monthly} color="#4f46e5" height={200} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Origine des inscriptions + engagement */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Origine des inscriptions
          </h3>
          <Donut
            size={130}
            segments={originSegments}
            centerLabel={String(data.selfEnrolled + data.grantedEnrollments)}
            centerSub="inscriptions"
          />
          <div className="mt-5 space-y-2 border-t border-line pt-4">
            {originSegments.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-fg-soft">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold text-fg">{s.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
              <span className="text-fg-soft">Apprenants actifs (30 j)</span>
              <span className="font-semibold text-primary">{data.activeLearners30d}</span>
            </div>
          </div>
        </div>

        {/* Top formations */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Top formations
          </h3>
          <div className="space-y-4">
            {data.topFormations.map((f, i) => (
              <div key={f.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-fg">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium">{f.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-faint">
                    {f.learners} apprenant{f.learners > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${f.avgCompletion}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs font-medium text-muted">
                    {f.avgCompletion}%
                  </span>
                </div>
              </div>
            ))}
            {data.topFormations.length === 0 && (
              <p className="text-sm text-faint">Aucune formation publiée.</p>
            )}
          </div>
        </div>

        {/* Quiz */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Scores moyens aux quiz
          </h3>
          <div className="space-y-4">
            {data.quizAverages.map((q) => (
              <div key={q.id} className="flex items-center gap-4">
                <Donut
                  size={70}
                  thickness={9}
                  segments={[
                    { label: "", value: q.avgScore, color: q.avgScore >= 70 ? "#4f46e5" : "#818cf8" },
                    { label: "", value: 100 - q.avgScore, color: "#94a3b8" },
                  ]}
                  centerLabel={`${q.avgScore}%`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{q.title}</p>
                  <p className="text-xs text-faint">
                    {q.attempts} tentative{q.attempts > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ))}
            {data.quizAverages.length === 0 && (
              <p className="text-sm text-faint">
                Aucun quiz passé pour le moment. Créez des quiz dans l&apos;éditeur de leçons.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
