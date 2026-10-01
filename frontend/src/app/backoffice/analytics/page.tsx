"use client";

import { useEffect, useState } from "react";
import BarChart from "@/components/BarChart";
import Donut from "@/components/Donut";
import { api } from "@/lib/api";

type Analytics = {
  revenueByMonth: Record<string, number>;
  funnel: Record<string, number>;
  pipelineByStage: Record<string, number>;
  topFormations: Array<{ id: string; title: string; learners: number; avgCompletion: number }>;
  quizAverages: Array<{ id: string; title: string; avgScore: number; attempts: number }>;
};

const MONTH_LABELS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  NEW: { label: "Contact", color: "#94a3b8" },
  QUALIFIED: { label: "Qualifié", color: "#0ea5e9" },
  QUOTE: { label: "Devis envoyé", color: "#f59e0b" },
  NEGOTIATION: { label: "Négociation", color: "#8b5cf6" },
  WON: { label: "Gagné", color: "#10b981" },
  LOST: { label: "Perdu", color: "#ef4444" },
};

const eur = (v: number) =>
  v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    api("/stats/commercial")
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

  const revenue = Object.entries(data.revenueByMonth).map(([key, value]) => {
    const [, m] = key.split("-");
    return { label: MONTH_LABELS[Number(m) - 1] ?? key, value };
  });
  const totalWon = Object.values(data.revenueByMonth).reduce((a, b) => a + b, 0);

  const funnelSegments = Object.entries(STAGE_LABELS).map(([k, v]) => ({
    label: v.label,
    value: data.funnel[k] ?? 0,
    color: v.color,
  }));

  const maxFunnel = Math.max(...funnelSegments.map((s) => s.value), 1);

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">Analytics commerciales</h1>
        <p className="mt-1 text-sm text-muted">
          Revenus, conversion et engagement — mis à jour en temps réel.
        </p>
      </div>

      {/* CA sur 6 mois */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Chiffre d&apos;affaires gagné — 6 derniers mois
          </h3>
          <span className="text-xl font-bold text-emerald-500">{eur(totalWon)}</span>
        </div>
        <BarChart
          data={revenue}
          format={(v) => `${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}k€`}
          color="#10b981"
          height={200}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Entonnoir */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Entonnoir du pipeline
          </h3>
          <div className="space-y-2.5">
            {funnelSegments.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-fg-soft">{s.label}</span>
                  <span className="font-semibold text-fg">{s.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(s.value / maxFunnel) * 100}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              CA prévisionnel par étape
            </p>
            <Donut
              size={110}
              thickness={14}
              segments={funnelSegments.filter((s) => s.value > 0)}
              centerLabel={eur(
                Object.values(data.pipelineByStage).reduce((a, b) => a + b, 0)
              ).replace("€", "").trim()}
              centerSub="€ en jeu"
            />
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
                      className="h-full rounded-full bg-emerald-500"
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
                    { label: "", value: q.avgScore, color: q.avgScore >= 70 ? "#10b981" : "#f59e0b" },
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
