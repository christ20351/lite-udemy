"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { CalendarDays, CircleAlert, Globe, MapPin, School, TriangleAlert, UserRound, Users } from "lucide-react";

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
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function fmtHeure(d: string) {
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Carte session = bloc plein saturé, texte blanc : impossible à rater.
 *  Ramp indigo par intensité : indigo-600 = visio · indigo-400 = présentiel · slate-700 = conflit formateur. */
function sessionChip(conflict: boolean, online: boolean) {
  if (conflict) return "bg-slate-700 text-white";
  return online ? "bg-indigo-600 text-white" : "bg-indigo-400 text-white";
}

/** Bande de couleur pour les cartes « Prochaines sessions ». */
function sessionBand(conflict: boolean, online: boolean) {
  if (conflict) return "bg-slate-700";
  return online ? "bg-indigo-600" : "bg-indigo-400";
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [selected, setSelected] = useState<SessionItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragSession, setDragSession] = useState<SessionItem | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

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

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  /** Report par glisser-déposer : conserve l'heure et la durée,
   *  notifie automatiquement inscrits + formateurs (côté API). */
  async function reschedule(session: SessionItem, newDate: Date) {
    const start = new Date(session.startAt);
    const end = new Date(session.endAt);
    const duration = end.getTime() - start.getTime();
    const newStart = new Date(
      newDate.getFullYear(), newDate.getMonth(), newDate.getDate(),
      start.getHours(), start.getMinutes(), 0, 0
    );
    if (newStart.getTime() === start.getTime()) return;
    try {
      const d = await api(`/sessions/${session.id}/reschedule`, {
        method: "POST",
        body: { startAt: newStart.toISOString() },
      });
      const dayStr = newStart.toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long",
      });
      setToast({
        ok: true,
        text:
          d.notified > 0
            ? `Session reportée au ${dayStr} — ${d.notified} personne${d.notified > 1 ? "s" : ""} notifiée${d.notified > 1 ? "s" : ""} (apprenants + formateurs).`
            : `Session déplacée au ${dayStr}.`,
      });
      await load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erreur lors du report" });
      await load();
    }
  }

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

  // Prochaines sessions (toutes infos visibles sans clic)
  const upcoming = useMemo(
    () =>
      (sessions ?? [])
        .filter((s) => new Date(s.endAt).getTime() >= Date.now())
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [sessions]
  );

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
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-400 px-2.5 py-1 text-white">
              <School className="h-3.5 w-3.5" aria-hidden />
              Présentiel
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-2.5 py-1 text-white">
              <Globe className="h-3.5 w-3.5" aria-hidden />
              Visio
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700 px-2.5 py-1 text-white">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
              Conflit formateur
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-fg-soft">
              ✥ Glissez une session sur un autre jour pour la reporter
              (inscrits et formateurs notifiés)
            </span>
          </div>
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
        <div className="notice-box mt-4">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {toast && (
        <div
          className={`fixed right-6 top-20 z-30 max-w-md rounded-xl border px-4 py-3 text-sm shadow-xl ${
            toast.ok
              ? "border-emerald-500/40 bg-surface text-fg-soft"
              : "border-red-500/40 bg-surface text-red-600 dark:text-red-400"
          }`}
        >
          {toast.ok ? "✅ " : "⚠️ "}
          {toast.text}
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
            const hasSessions = daySessions.length > 0;
            const isDropTarget = dragSession !== null && dragOverDay === key;
            return (
              <div
                key={i}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverDay(key);
                }}
                onDragLeave={() => setDragOverDay((k) => (k === key ? null : k))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverDay(null);
                  if (dragSession) reschedule(dragSession, date);
                  setDragSession(null);
                }}
                className={`rounded-lg border p-1.5 transition-colors ${
                  hasSessions ? "min-h-36" : "min-h-24"
                } ${
                  isDropTarget
                    ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/40"
                    : isToday(date)
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : hasSessions
                        ? "border-primary/40 bg-primary/[0.04]"
                        : "border-line bg-surface"
                }`}
              >
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <p
                    className={`text-xs font-bold ${
                      isToday(date) ? "text-primary" : hasSessions ? "text-fg-soft" : "text-faint"
                    }`}
                  >
                    {date.getDate()}
                  </p>
                  {daySessions.length > 1 && (
                    <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                      {daySessions.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {daySessions.map((s) => {
                    const conflict = conflicts.has(s.id);
                    const online = s.modality === "ONLINE";
                    const full = s.participants.length >= s.capacity;
                    return (
                      <button
                        key={s.id}
                        draggable
                        onDragStart={(e) => {
                          setDragSession(s);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDragSession(null)}
                        onClick={() => setSelected(s)}
                        title={`${s.title} — ${fmtDay(s.startAt)}, ${fmtHeure(s.startAt)} → ${fmtHeure(s.endAt)} · ${
                          online ? s.meetingUrl ?? "Visio" : s.location ?? "Lieu à définir"
                        } · ${s.trainer?.name ?? "Formateur à assigner"} · ${
                          s.participants.length
                        }/${s.capacity} inscrits`}
                        className={`w-full cursor-grab rounded-lg px-2 py-1.5 text-left leading-tight shadow-md transition hover:-translate-y-px hover:shadow-lg active:cursor-grabbing ${
                          dragSession?.id === s.id ? "opacity-40" : ""
                        } ${sessionChip(
                          conflict,
                          online
                        )}`}
                      >
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide opacity-90">
                          {online ? (
                            <Globe className="h-3 w-3 shrink-0" aria-hidden />
                          ) : (
                            <School className="h-3 w-3 shrink-0" aria-hidden />
                          )}
                          {fmtHeure(s.startAt)} → {fmtHeure(s.endAt)}
                          {conflict && (
                            <span className="ml-auto" title="Conflit formateur">
                              <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs font-bold">
                          {s.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-semibold opacity-90">
                          {online ? (
                            <>
                              <Globe className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden />
                              Visio
                            </>
                          ) : (
                            <>
                              <MapPin className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden />
                              {s.location ?? "Lieu à définir"}
                            </>
                          )}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-[10px] font-bold">
                          <span className="flex min-w-0 items-center gap-1 opacity-95">
                            <UserRound className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{s.trainer?.name ?? "—"}</span>
                          </span>
                          <span
                            className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px ${
                              full ? "bg-black/40" : "bg-white/25"
                            }`}
                          >
                            <Users className="h-3 w-3" aria-hidden />
                            {s.participants.length}/{s.capacity}
                          </span>
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

      {/* ── Rappels : prochaines sessions, lisibles sans clic ─────────── */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-fg">Prochaines sessions</h2>
          <p className="text-xs font-semibold text-muted">{upcoming.length} à venir</p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {upcoming.map((s) => {
            const conflict = conflicts.has(s.id);
            const online = s.modality === "ONLINE";
            const fillPct = Math.min(
              100,
              Math.round((s.participants.length / Math.max(s.capacity, 1)) * 100)
            );
            return (
              <div key={s.id} className="card overflow-hidden">
                <div className={`h-2 w-full ${sessionBand(conflict, online)}`} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-muted">
                        {s.formation.title}
                      </p>
                      <h3 className="mt-0.5 truncate font-bold text-fg">{s.title}</h3>
                    </div>
                    <span className={`chip inline-flex shrink-0 items-center gap-1 ${sessionChip(conflict, online)}`}>
                      {online ? (
                        <>
                          <Globe className="h-3.5 w-3.5" aria-hidden />
                          Visio
                        </>
                      ) : (
                        <>
                          <School className="h-3.5 w-3.5" aria-hidden />
                          Présentiel
                        </>
                      )}
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-fg-soft">
                    <p className="col-span-2">
                      <CalendarDays className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden />
                      <span className="font-semibold capitalize">{fmtDay(s.startAt)}</span> ·{" "}
                      {fmtHeure(s.startAt)} → {fmtHeure(s.endAt)}
                    </p>
                    <p className="truncate col-span-2">
                      {online ? (
                        <>
                          <Globe className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden />
                          {s.meetingUrl ?? "Lien visio à communiquer"}
                        </>
                      ) : (
                        <>
                          <MapPin className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden />
                          {s.location ?? "Lieu à définir"}
                        </>
                      )}
                    </p>
                    <p className="truncate">
                      <UserRound className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden />
                      {s.trainer?.name ?? "Formateur à assigner"}
                    </p>
                    <p className="text-right font-semibold text-fg">
                      <Users className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden />
                      {s.participants.length}/{s.capacity} inscrits
                    </p>
                  </div>

                  <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${
                        fillPct >= 100 ? "bg-indigo-600" : fillPct >= 75 ? "bg-indigo-400" : "bg-indigo-300"
                      }`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>

                  {conflict && (
                    <p className="notice-box mt-2.5 text-xs font-semibold">
                      <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        Conflit : ce formateur est déjà booké sur un créneau qui se chevauche.
                      </span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {upcoming.length === 0 && sessions !== null && (
            <p className="text-sm text-faint">Aucune session planifiée pour le moment.</p>
          )}
        </div>
      </section>

      {/* Détail de session (clic depuis la grille) */}
      {selected && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="card w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-5 ${sessionChip(conflicts.has(selected.id), selected.modality === "ONLINE")}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
                {selected.formation.title}
              </p>
              <h3 className="mt-0.5 text-xl font-bold">{selected.title}</h3>
            </div>

            <div className="p-5">
              <div className="space-y-1.5 text-sm text-fg-soft">
                <p>
                  <CalendarDays className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden />
                  <span className="font-semibold capitalize">{fmtDay(selected.startAt)}</span> ·{" "}
                  {fmtHeure(selected.startAt)} → {fmtHeure(selected.endAt)}
                </p>
                {selected.modality === "ONLINE" ? (
                  <p>
                    <Globe className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden />
                    {selected.meetingUrl ?? "Lien visio à communiquer"}
                  </p>
                ) : (
                  <p>
                    <MapPin className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden />
                    {selected.location ?? "Lieu à définir"}
                  </p>
                )}
                <p>
                  <UserRound className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden />
                  {selected.trainer?.name ?? "Formateur à assigner"} ·{" "}
                  {selected.participants.length}/{selected.capacity} inscrits
                </p>
              </div>

              {conflicts.has(selected.id) && (
                <p className="notice-box mt-3 text-xs">
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    Conflit : ce formateur est déjà booké sur un autre créneau qui se
                    chevauche.
                  </span>
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
        </div>
      )}
    </div>
  );
}
