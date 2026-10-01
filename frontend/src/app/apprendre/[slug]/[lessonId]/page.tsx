"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PortalHeader from "@/components/PortalHeader";
import QuizBox from "@/components/QuizBox";
import { api, API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type LessonBlock = {
  type: "text" | "image" | "code" | "callout";
  text?: string | null;
  url?: string | null;
  caption?: string | null;
};

type LessonData = {
  lesson: {
    id: string;
    title: string;
    content: string | null;
    blocks: LessonBlock[] | null;
    videoPath: string | null;
    duration: number | null;
    isPreview: boolean;
    hasQuiz?: boolean;
  };
  formation: { id: string; title: string; slug: string };
  lastPosition: number;
  completed: boolean;
  bestQuizScore?: { score: number; total: number } | null;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
};

export default function LessonPlayerPage() {
  const params = useParams<{ slug: string; lessonId: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<LessonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumedRef = useRef(false);
  const lastSavedRef = useRef(0);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    try {
      const d: LessonData = await api(`/me/lessons/${params.lessonId}`);
      setData(d);
      setCompleted(d.completed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, [params.lessonId]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Sauvegarde de la position toutes les 10 s + reprise au chargement
  const saveProgress = useCallback(
    async (position: number, completedValue?: boolean) => {
      try {
        await api(`/me/lessons/${params.lessonId}/progress`, {
          method: "PUT",
          body: { lastPosition: Math.floor(position), ...(completedValue !== undefined ? { completed: completedValue } : {}) },
        });
      } catch {
        /* silencieux : la progression se resynchronisera */
      }
    },
    [params.lessonId]
  );

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    // reprise de lecture à la position sauvegardée
    if (!resumedRef.current && data && data.lastPosition > 5) {
      resumedRef.current = true;
      v.currentTime = data.lastPosition;
      return;
    }
    resumedRef.current = true;
    const now = Math.floor(v.currentTime);
    if (now - lastSavedRef.current >= 10) {
      lastSavedRef.current = now;
      saveProgress(now);
    }
    // auto-complétion à 92 %
    if (v.duration && now / v.duration >= 0.92 && !completed) {
      setCompleted(true);
      saveProgress(now, true);
    }
  }

  function markCompleted() {
    setCompleted(true);
    const v = videoRef.current;
    saveProgress(v?.currentTime ?? 0, true);
  }

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

  const { lesson, formation, prev, next } = data;

  return (
    <main className="flex-1 flex flex-col">
      <PortalHeader />

      <div className="bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/apprendre/${formation.slug}`}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← {formation.title}
            </Link>
            <p className="font-semibold truncate">{lesson.title}</p>
          </div>
          <button
            onClick={markCompleted}
            disabled={completed}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${
              completed
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-primary text-white hover:bg-primary-strong"
            }`}
          >
            {completed ? "✓ Terminée" : "Marquer comme terminée"}
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
        {lesson.videoPath && (
          <video
            ref={videoRef}
            controls
            controlsList="nodownload"
            onTimeUpdate={onTimeUpdate}
            onPause={() => saveProgress(videoRef.current?.currentTime ?? 0)}
            className="w-full rounded-xl bg-black aspect-video"
            src={`${API_URL}${lesson.videoPath}`}
          />
        )}

        {/* Blocs structurés (nouveau builder) */}
        {lesson.blocks && lesson.blocks.length > 0 && (
          <div className="mt-6 space-y-4">
            {lesson.blocks.map((b, i) => {
              if (b.type === "image" && b.url) {
                return (
                  <figure key={i} className="card overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${API_URL}${b.url}`}
                      alt={b.caption ?? ""}
                      className="max-h-96 w-full object-cover"
                    />
                    {b.caption && (
                      <figcaption className="px-4 py-2 text-xs text-muted">
                        {b.caption}
                      </figcaption>
                    )}
                  </figure>
                );
              }
              if (b.type === "code") {
                return (
                  <pre
                    key={i}
                    className="overflow-x-auto rounded-xl border border-line bg-[#0d1428] p-4 font-mono text-sm text-slate-100"
                  >
                    <code>{b.text}</code>
                  </pre>
                );
              }
              if (b.type === "callout") {
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
                  >
                    💡 {b.text}
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className="rounded-xl border border-line bg-surface p-6 leading-relaxed
                    [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
                    [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
                    [&_li]:my-1 [&_p]:my-2
                    [&_strong]:font-semibold [&_em]:italic"
                  dangerouslySetInnerHTML={{ __html: b.text ?? "" }}
                />
              );
            })}
          </div>
        )}

        {/* Contenu legacy (HTML simple) */}
        {!lesson.blocks?.length && lesson.content && (
          <article
            className="mt-6 rounded-xl border border-line bg-surface p-6 text-sm leading-relaxed
              [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
              [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
              [&_li]:my-1 [&_p]:my-2 [&_pre]:rounded-lg [&_pre]:bg-[#0d1428] [&_pre]:p-4
              [&_pre]:text-slate-100 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:text-sm
              [&_code]:font-mono [&_strong]:font-semibold [&_em]:italic"
            dangerouslySetInnerHTML={{ __html: lesson.content }}
          />
        )}

        {/* Quiz de la leçon */}
        {lesson.hasQuiz && <QuizBox lessonId={lesson.id} />}

        {/* Navigation entre leçons */}
        <nav className="mt-8 flex items-center justify-between gap-4">
          {prev ? (
            <Link
              href={`/apprendre/${formation.slug}/${prev.id}`}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/apprendre/${formation.slug}/${next.id}`}
              className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
            >
              Leçon suivante : {next.title} →
            </Link>
          ) : (
            <Link
              href={`/apprendre/${formation.slug}`}
              className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700"
            >
              Retour au sommaire 🎉
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
