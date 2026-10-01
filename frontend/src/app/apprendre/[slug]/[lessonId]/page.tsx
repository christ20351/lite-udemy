"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PortalHeader from "@/components/PortalHeader";
import QuizBox from "@/components/QuizBox";
import { Check, CircleAlert, Lightbulb, Lock, Trophy } from "lucide-react";
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
  isLast: boolean;
  formationProgress: { totalLessons: number; completedLessons: number };
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
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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

  // Une leçon sans vidéo ouverte hors dernière étape est considérée lue :
  // sans cela, une formation à leçons textuelles ne pourrait jamais être clôturée.
  useEffect(() => {
    if (!data || data.completed || data.lesson.videoPath || data.isLast) return;
    setCompleted(true);
    saveProgress(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

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

  async function completeFormation() {
    if (!data) return;
    setCompleting(true);
    setActionError(null);
    try {
      await api(`/me/formations/${data.formation.slug}/complete`, { method: "POST" });
      router.push(
        `/mes-formations?completed=${encodeURIComponent(data.formation.slug)}&title=${encodeURIComponent(data.formation.title)}`
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur");
      setCompleting(false);
    }
  }

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="notice-box justify-center">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </p>
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
  const formationDone =
    data.formationProgress.totalLessons > 0 &&
    data.formationProgress.completedLessons >= data.formationProgress.totalLessons;
  // Sur la dernière leçon : toutes les autres leçons doivent être terminées
  const othersDone =
    data.formationProgress.completedLessons >= data.formationProgress.totalLessons - 1;

  return (
    <main className="flex-1 flex flex-col">
      <PortalHeader />

      <div className="bg-surface border-b border-line">
        <div
          aria-hidden
          className="h-0.5 w-full"
          style={{ background: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899)" }}
        />
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/apprendre/${formation.slug}`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              ← {formation.title}
            </Link>
            <p className="font-bold truncate text-fg">{lesson.title}</p>
          </div>
          {formationDone ? (
            <button
              disabled
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default"
            >
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4" /> Formation terminée
              </span>
            </button>
          ) : !data.isLast ? (
            <button
              disabled
              title="Vous pourrez terminer la formation depuis la dernière leçon du parcours."
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold bg-black/10 dark:bg-white/10 text-faint cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4" /> Terminer la formation
              </span>
            </button>
          ) : !othersDone ? (
            <button
              disabled
              title="Terminez d'abord toutes les leçons du parcours."
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold bg-black/10 dark:bg-white/10 text-faint cursor-not-allowed"
            >
              Terminer la formation · {data.formationProgress.completedLessons}/
              {data.formationProgress.totalLessons}
            </button>
          ) : (
            <button
              onClick={completeFormation}
              disabled={completing}
              className="btn-gradient shrink-0 rounded-xl px-4 py-2 text-sm font-bold"
            >
              {completing ? "Clôture…" : "Terminer la formation"}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mx-auto w-full max-w-6xl px-6 pt-4">
          <p className="notice-box">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </p>
        </div>
      )}

      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
        {lesson.videoPath && (
          <video
            ref={videoRef}
            controls
            controlsList="nodownload"
            onTimeUpdate={onTimeUpdate}
            onPause={() => saveProgress(videoRef.current?.currentTime ?? 0)}
            className="w-full rounded-2xl bg-black aspect-video shadow-xl"
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
                    className="rounded-xl border-l-4 border-indigo-500 bg-indigo-500/10 px-4 py-3 text-sm text-fg-soft"
                  >
                    <Lightbulb className="inline h-4 w-4 align-[-3px] text-primary" /> {b.text}
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
              className="btn-gradient max-w-xs truncate"
            >
              Leçon suivante : {next.title} →
            </Link>
          ) : (
            <Link href={`/apprendre/${formation.slug}`} className="btn-gradient">
              <Trophy className="h-4 w-4" />
              Retour au sommaire
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
