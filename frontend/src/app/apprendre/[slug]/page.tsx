"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PortalHeader from "@/components/PortalHeader";
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
          <p className="text-red-600">{error}</p>
          <Link href="/mes-formations" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block">
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

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold">{data.formation.title}</h1>
            <p className="text-muted mt-2">{data.formation.description}</p>
          </div>
          {nextLesson && (
            <Link
              href={`/apprendre/${data.formation.slug}/${nextLesson.id}`}
              className="rounded-lg bg-indigo-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 shrink-0"
            >
              {done > 0 ? "Continuer la formation" : "Commencer"} →
            </Link>
          )}
        </div>

        {allLessons.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>
                {done}/{allLessons.length} leçons terminées
              </span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-line overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Curriculum */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Contenu de la formation</h2>
          <div className="mt-3 space-y-3">
            {data.sections.map((s) => (
              <div key={s.id} className="bg-surface border border-line rounded-xl overflow-hidden">
                <p className="px-4 py-3 bg-surface-2 border-b border-line text-sm font-medium">
                  Section {s.position} — {s.title}
                </p>
                <div className="divide-y divide-line">
                  {s.lessons.map((l) => (
                    <Link
                      key={l.id}
                      href={`/apprendre/${data.formation.slug}/${l.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-surface-2"
                    >
                      <span className="flex items-center gap-3 text-sm">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            l.completed
                              ? "bg-emerald-500 text-white"
                              : "border-2 border-line bg-surface text-faint"
                          }`}
                        >
                          {l.completed ? "✓" : ""}
                        </span>
                        {l.title}
                        {l.isPreview && (
                          <span className="text-xs text-amber-600">aperçu</span>
                        )}
                      </span>
                      <span className="text-xs text-faint">
                        {l.duration ? `${Math.round(l.duration / 60)} min` : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sessions présentielles liées */}
        {data.mySessions.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Sessions présentielles</h2>
            <div className="mt-3 space-y-2">
              {data.mySessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between flex-wrap gap-2"
                >
                  <div>
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-xs text-faint mt-0.5">
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
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      s.registered
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-surface-2 text-muted"
                    }`}
                  >
                    {s.registered ? "✓ Inscrit" : "Non inscrit"}
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
