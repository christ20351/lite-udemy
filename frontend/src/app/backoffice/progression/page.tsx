"use client";

import { useCallback, useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

type Card = {
  enrollmentId: string;
  user: { id: string; name: string; email: string };
  formation: { id: string; title: string };
  grantedAt: string;
  selfEnrolled: boolean;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  bucket: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
};

const COLUMNS = {
  NOT_STARTED: { label: "Non commencé", color: "#94a3b8" },
  IN_PROGRESS: { label: "En cours", color: "#818cf8" },
  DONE: { label: "Terminé", color: "#4f46e5" },
} as const;

export default function ProgressionPage() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [formations, setFormations] = useState<Array<{ id: string; title: string }>>([]);
  const [formationId, setFormationId] = useState("");

  const load = useCallback(async (f: string) => {
    try {
      const d = await api(
        `/learners/progression/kanban${f ? `?formationId=${encodeURIComponent(f)}` : ""}`
      );
      setCards(d.cards);
    } catch {
      setCards([]);
    }
  }, []);

  useEffect(() => {
    load(formationId);
  }, [load, formationId]);

  useEffect(() => {
    api("/formations")
      .then((d) => setFormations(d.formations))
      .catch(() => {});
  }, []);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-fg">Progression des apprenants</h1>
          <p className="mt-1 text-sm text-muted">
            Une carte par inscription, positionnée selon la progression réelle.
          </p>
        </div>
        <select
          value={formationId}
          onChange={(e) => setFormationId(e.target.value)}
          className="input max-w-xs"
        >
          <option value="">Toutes les formations</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
      </div>

      {cards === null ? (
        <p className="mt-8 text-muted animate-pulse">Chargement…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(COLUMNS).map(([bucket, meta]) => {
            const list = cards.filter((c) => c.bucket === bucket);
            return (
              <div
                key={bucket}
                className="rounded-2xl border border-line bg-surface-2/50 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                    {meta.label}
                  </p>
                  <span className="text-xs font-semibold text-fg">{list.length}</span>
                </div>

                <div className="space-y-2">
                  {list.map((c) => (
                    <Link
                      key={c.enrollmentId}
                      href={`/backoffice/apprenants/${c.user.id}`}
                      className="card block p-3 hover:border-primary/40"
                    >
                      <p className="text-sm font-semibold text-fg">{c.user.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-faint">
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        <span className="truncate">{c.formation.title}</span>
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${c.percent}%`, backgroundColor: meta.color }}
                          />
                        </div>
                        <span className="text-xs font-medium text-muted">
                          {c.completedLessons}/{c.totalLessons}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-faint">
                        {c.selfEnrolled
                          ? "Auto-inscription"
                          : "Inscription par l'équipe"}{" "}
                        ·{" "}
                        {new Date(c.grantedAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </Link>
                  ))}
                  {list.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line px-2 py-4 text-center text-xs text-faint">
                      Aucun apprenant
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
