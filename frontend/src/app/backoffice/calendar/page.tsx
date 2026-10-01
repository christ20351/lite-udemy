"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type SessionItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  capacity: number;
  modality: "PRESENTIEL" | "ONLINE";
  meetingUrl: string | null;
  formation: { id: string; title: string };
  trainer: { id: string; name: string } | null;
  participants: Array<{ id: string; userId: string; attended: boolean }>;
};

const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function fmtHeure(d: string) {
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [selected, setSelected] = useState<SessionItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api("/sessions");
      setSessions(d.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Grille du mois : lundi en premier
  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startOffset = (first.getDay() + 6) % 7; // lundi = 0
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(cursor.year, cursor.month, d) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionItem[]>();
    for (const s of sessions ?? []) {
      const d = new Date(s.startAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [sessions]);

  // Conflits : même formateur sur des créneaux qui se chevauchent
  const conflicts = useMemo(() => {
    const set = new Set<string>();
    const byTrainer = new Map<string, SessionItem[]>();
    for (const s of sessions ?? []) {
      if (!s.trainer) continue;
      byTrainer.set(s.trainer.id, [...(byTrainer.get(s.trainer.id) ?? []), s]);
    }
    for (const list of byTrainer.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = new Date(list[i].startAt).getTime();
          const b = new Date(list[j].startAt).getTime();
          const aEnd = new Date(list[i].endAt).getTime();
          const bEnd = new Date(list[j].endAt).getTime();
          if (a < bEnd && b < aEnd) {
            set.add(list[i].id);
            set.add(list[j].id);
          }
        }
      }
    }
    return set;
  }, [sessions]);

  const today = new Date();
  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-fg">Calendrier des sessions</h1>
          <p className="mt-1 text-sm text-muted">
            🏫 Présentiel · 🌐 En ligne — les conflits formateur sont signalés en rouge.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/backoffice/sessions" className="btn-ghost">
            Vue liste / création
          </Link>
          <button
            onClick={() =>
              setCursor(({ year, month }) =>
                month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
              )
            }
            className="btn-ghost px-3"
            aria-label="Mois précédent"
          >
            ←
          </button>
          <span className="min-w-44 text-center text-sm font-semibold text-fg">
            {MONTHS[cursor.month]} {cursor.year}
          </span>
          <button
            onClick={() =>
              setCursor(({ year, month }) =>
                month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
              )
            }
            className="btn-ghost px-3"
            aria-label="Mois suivant"
          >
            →
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="card mt-6 overflow-hidden p-4">
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((d) => (
            <p key={d} className="pb-2 text-center text-xs font-semibold uppercase tracking-wide text-faint">
              {d}
            </p>
          ))}
          {grid.map(({ date }, i) => {
            if (!date) return <div key={i} className="min-h-24 rounded-lg bg-surface-2/40" />;
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const daySessions = sessionsByDay.get(key) ?? [];
            return (
              <div
                key={i}
                className={`min-h-24 rounded-lg border p-1.5 ${
                  isToday(date) ? "border-primary bg-primary/5" : "border-line bg-surface"
                }`}
              >
                <p
                  className={`mb-1 px-0.5 text-xs font-semibold ${
                    isToday(date) ? "text-primary" : "text-faint"
                  }`}
                >
                  {date.getDate()}
                </p>
                <div className="space-y-1">
                  {daySessions.map((s) => {
                    const conflict = conflicts.has(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelected(s)}
                        className={`w-full rounded-md px-1.5 py-1 text-left text-[10px] leading-tight transition-colors ${
                          conflict
                            ? "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25"
                            : s.modality === "ONLINE"
                              ? "bg-indigo-500/15 text-indigo-600 hover:bg-indigo-500/25 dark:text-indigo-400"
                              : "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400"
                        }`}
                      >
                        <span className="block truncate font-semibold">
                          {s.modality === "ONLINE" ? "🌐" : "🏫"} {s.title}
                        </span>
                        <span className="block text-[9px] opacity-75">
                          {fmtHeure(s.startAt)}
                          {conflict ? " · ⚠️ conflit" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Détail de session */}
      {selected && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="card w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted">
                  {selected.formation.title}
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-fg">{selected.title}</h3>
              </div>
              <span
                className={`chip ${
                  selected.modality === "ONLINE"
                    ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                }`}
              >
                {selected.modality === "ONLINE" ? "🌐 En ligne" : "🏫 Présentiel"}
              </span>
            </div>

            <div className="mt-4 space-y-1.5 text-sm text-fg-soft">
              <p>
                📅 {fmtDay(selected.startAt)} · {fmtHeure(selected.startAt)} →{" "}
                {fmtHeure(selected.endAt)}
              </p>
              {selected.modality === "ONLINE" ? (
                <p>🌐 {selected.meetingUrl ?? "Lien visio à communiquer"}</p>
              ) : (
                <p>📍 {selected.location ?? "Lieu à définir"}</p>
              )}
              <p>
                👤 {selected.trainer?.name ?? "Formateur à assigner"} ·{" "}
                {selected.participants.length}/{selected.capacity} inscrits
              </p>
            </div>

            {conflicts.has(selected.id) && (
              <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                ⚠️ Conflit : ce formateur est déjà booké sur un autre créneau qui se
                chevauche.
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <Link href="/backoffice/sessions" className="btn-primary flex-1">
                Gérer les participants
              </Link>
              <button onClick={() => setSelected(null)} className="btn-ghost">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
