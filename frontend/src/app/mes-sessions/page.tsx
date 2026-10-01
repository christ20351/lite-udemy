"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, MapPin } from "lucide-react";
import PortalHeader from "@/components/PortalHeader";
import { api } from "@/lib/api";
import { isEquipe, useAuth } from "@/lib/auth";

type MySession = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  attended: boolean;
  formationTitle: string;
  trainer: string | null;
};

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Tuile de date à dégradé (jour en gros + mois). */
function DateTile({ d }: { d: string }) {
  const date = new Date(d);
  return (
    <div
      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-lg shadow-indigo-500/30"
      style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
    >
      <span className="text-2xl font-black leading-none">{date.getDate()}</span>
      <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wide opacity-90">
        {MOIS[date.getMonth()]}
      </span>
    </div>
  );
}

export default function MesSessionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<MySession[] | null>(null);

  useEffect(() => {
    if (!loading && (!user || isEquipe(user.role))) {
      router.replace("/backoffice");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === "APPRENANT") {
      api("/me/sessions")
        .then((d) => setSessions(d.sessions))
        .catch(() => setSessions([]));
    }
  }, [user]);

  const upcoming = (sessions ?? []).filter(
    (s) => new Date(s.endAt).getTime() > Date.now()
  );
  const past = (sessions ?? []).filter(
    (s) => new Date(s.endAt).getTime() <= Date.now()
  );

  return (
    <main className="flex-1">
      <PortalHeader />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center gap-3">
          <span className="icon-tile">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-fg">Mes sessions</h1>
            <p className="text-sm text-muted">
              Présentielles et visio — inscrites par votre équipe.
            </p>
          </div>
        </div>

        {sessions === null ? (
          <p className="mt-8 text-muted animate-pulse">Chargement…</p>
        ) : (
          <>
            <h2 className="mt-8 flex items-center gap-2.5 text-sm font-bold uppercase tracking-wide text-muted">
              <span className="accent-bar" aria-hidden />
              À venir
            </h2>
            <div className="mt-4 space-y-3">
              {upcoming.map((s) => (
                <div
                  key={s.id}
                  className="card flex items-center gap-4 p-4 transition-all hover:-translate-y-px hover:shadow-lg"
                >
                  <DateTile d={s.startAt} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-fg">{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {s.formationTitle} ·{" "}
                      <span className="font-semibold text-fg-soft">
                        {new Date(s.startAt).toLocaleString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-faint">
                      {s.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-primary" /> {s.location}
                        </span>
                      ) : (
                        <span>🌐 Visio</span>
                      )}
                      {s.trainer && <span>👤 {s.trainer}</span>}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Inscrit <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
              ))}
              {upcoming.length === 0 && (
                <div className="card border-dashed p-8 text-center">
                  <p className="text-sm text-muted">
                    Aucune session à venir. Elles apparaîtront ici quand votre
                    équipe vous inscrira.
                  </p>
                </div>
              )}
            </div>

            {past.length > 0 && (
              <>
                <h2 className="mt-10 flex items-center gap-2.5 text-sm font-bold uppercase tracking-wide text-muted">
                  <span className="accent-bar !bg-none !bg-surface-2" aria-hidden />
                  Passées
                </h2>
                <div className="mt-4 space-y-2.5">
                  {past.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-line bg-surface-2/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm font-semibold text-fg-soft">{s.title}</p>
                        {s.attended ? (
                          <span className="chip bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" /> Présence confirmée
                          </span>
                        ) : (
                          <span className="chip bg-surface text-muted">Absent</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-faint">
                        {new Date(s.startAt).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}{" "}
                        · {s.formationTitle}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
