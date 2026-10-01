"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, CircleAlert, Play, Trophy, Users } from "lucide-react";
import PortalHeader from "@/components/PortalHeader";
import GradientCover from "@/components/GradientCover";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type OverviewLesson = {
  id: string;
  title: string;
  duration: number | null;
  isPreview: boolean;
  completed: boolean;
};
type OverviewSection = {
  id: string;
  title: string;
  position: number;
  lessons: OverviewLesson[];
};
type Overview = {
  formation: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    mode: string;
  };
  sections: OverviewSection[];
  mySessions: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    location: string | null;
    trainer: string | null;
    registered: boolean;
  }[];
};

export default function FormationOverviewPage() {
  const params = useParams<{ slug: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api(`/me/formations/${params.slug}`)
      .then((d) => setData(d))
      .catch((e) => setError(e.message));
  }, [user, params.slug]);

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="notice-box justify-center">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </p>
          <Link href="/mes-formations" className="mt-3 inline-block text-sm text-primary hover:underline">
            ← Mes formations
          </Link>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted animate-pulse">Chargement…</p>
      </main>
    );
  }

  const allLessons = data.sections.flatMap((s) => s.lessons);
  const nextLesson = allLessons.find((l) => !l.completed) ?? allLessons[0];
  const done = allLessons.filter((l) => l.completed).length;
  const percent = allLessons.length ? Math.round((done / allLessons.length) * 100) : 0;

  return (
    <main className="flex-1">
      <PortalHeader />

      {/* ── Bannière dégradée ─────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <GradientCover title={data.formation.title} showInitials={false} />
        </div>
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, var(--bg) 2%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 pb-14 pt-14">
          <p className="text-xs font-bold uppercase tracking-widest text-white/75">
            Formation
          </p>
          <h1 className="mt-1 max-w-2xl text-4xl font-black leading-tight tracking-tight text-white drop-shadow-lg">
            {data.formation.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 line-clamp-2">
            {data.formation.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            {nextLesson && (
              <Link
                href={`/apprendre/${data.formation.slug}/${nextLesson.id}`}
                className="btn-gradient !text-base"
              >
                <Play className="h-5 w-5 fill-current" />
                {done > 0
                  ? `Continuer — ${percent} %`
                  : "Commencer la formation"}
              </Link>
            )}
            <span className="chip bg-black/35 text-white backdrop-blur">
              {allLessons.length} leçon{allLessons.length > 1 ? "s" : ""}
            </span>
            {percent === 100 && (
              <span className="chip bg-emerald-500 font-bold text-white shadow">
                <Trophy className="h-3.5 w-3.5" /> Terminée
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 pb-12">
        {/* Progression */}
        {allLessons.length > 0 && (
          <div className="card -mt-8 relative p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-fg">
                Votre progression : {done}/{allLessons.length} leçons
              </span>
              <span className="gradient-text text-xl font-black">{percent}%</span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${percent}%`,
                  background: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899)",
                }}
              />
            </div>
          </div>
        )}

        {/* Curriculum */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2.5 text-xl font-extrabold text-fg">
            <span className="accent-bar" aria-hidden />
            Contenu de la formation
          </h2>
          <div className="mt-4 space-y-4">
            {data.sections.map((s) => {
              const sectionDone = s.lessons.filter((l) => l.completed).length;
              return (
                <div key={s.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-3.5">
                    <p className="text-sm font-bold text-fg">
                      Section {s.position} — {s.title}
                    </p>
                    <span className="chip bg-surface text-muted">
                      {sectionDone}/{s.lessons.length}
                    </span>
                  </div>
                  <div className="divide-y divide-line">
                    {s.lessons.map((l) => (
                      <Link
                        key={l.id}
                        href={`/apprendre/${data.formation.slug}/${l.id}`}
                        className="group flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-surface-2"
                      >
                        <span className="flex items-center gap-3 text-sm font-medium text-fg-soft group-hover:text-fg">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              l.completed
                                ? "text-white"
                                : "border-2 border-line bg-surface text-faint"
                            }`}
                            style={
                              l.completed
                                ? { background: "linear-gradient(135deg, #6366f1, #a855f7)" }
                                : undefined
                            }
                          >
                            {l.completed ? <Check className="h-3.5 w-3.5" /> : ""}
                          </span>
                          {l.title}
                          {l.isPreview && (
                            <span className="chip bg-indigo-500/15 text-[10px] text-indigo-600 dark:text-indigo-400">
                              aperçu
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-faint">
                          {l.duration ? `${Math.round(l.duration / 60)} min` : ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Sessions présentielles liées */}
        {data.mySessions.length > 0 && (
          <section className="mt-10">
            <h2 className="flex items-center gap-2.5 text-xl font-extrabold text-fg">
              <span className="accent-bar" aria-hidden />
              Sessions
            </h2>
            <div className="mt-4 space-y-3">
              {data.mySessions.map((s) => (
                <div
                  key={s.id}
                  className="card flex items-center justify-between gap-3 flex-wrap p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-fg">{s.title}</p>
                    <p className="mt-0.5 text-xs text-faint">
                      {new Date(s.startAt).toLocaleString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {s.location ? ` · ${s.location}` : ""}
                      {s.trainer ? ` · Formateur : ${s.trainer}` : ""}
                    </p>
                  </div>
                  <span
                    className={`chip shrink-0 ${
                      s.registered
                        ? "bg-emerald-500/15 font-bold text-emerald-600 dark:text-emerald-400"
                        : "bg-surface-2 text-muted"
                    }`}
                  >
                    {s.registered ? (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> Inscrit
                      </span>
                    ) : (
                      "Non inscrit"
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
