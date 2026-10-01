"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type QuizData = {
  quiz: {
    lessonId: string;
    questions: Array<{ id: string; text: string; choices: Array<{ text: string }> }>;
  };
  bestAttempt: { score: number; total: number } | null;
};

type Correction = {
  score: number;
  total: number;
  correction: Array<{
    question: string;
    ok: boolean;
    correctIndices: number[];
    pickedIndices: number[];
  }>;
};

export default function QuizBox({ lessonId }: { lessonId: string }) {
  const [data, setData] = useState<QuizData | null>(null);
  const [picked, setPicked] = useState<Record<number, number[]>>({});
  const [result, setResult] = useState<Correction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api(`/me/quiz/lessons/${lessonId}/quiz`)
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [lessonId]);

  if (!data || data.quiz.questions.length === 0) return null;

  const allAnswered = data.quiz.questions.every((_, i) => (picked[i]?.length ?? 0) > 0);

  function toggle(qi: number, ci: number) {
    setPicked((p) => {
      const cur = p[qi] ?? [];
      return {
        ...p,
        [qi]: cur.includes(ci) ? cur.filter((x) => x !== ci) : [...cur, ci],
      };
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const answers = data!.quiz.questions.map((_, i) => picked[i] ?? []);
      const r: Correction = await api(`/me/quiz/lessons/${lessonId}/quiz/attempt`, {
        method: "POST",
        body: { answers },
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card mt-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">🧪 Quiz de la leçon</h2>
        {data.bestAttempt && !result && (
          <span className="chip bg-surface-2 text-muted">
            Meilleur score : {data.bestAttempt.score}/{data.bestAttempt.total}
          </span>
        )}
      </div>

      {result ? (
        <div className="mt-4">
          <div
            className={`rounded-xl border p-5 text-center ${
              result.score === result.total
                ? "border-emerald-500/30 bg-emerald-500/10"
                : result.score / result.total >= 0.5
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-red-500/30 bg-red-500/10"
            }`}
          >
            <p className="text-4xl font-bold text-fg">
              {result.score}/{result.total}
            </p>
            <p className="mt-1 text-sm text-muted">
              {result.score === result.total
                ? "Parfait ! 🎉"
                : result.score / result.total >= 0.5
                  ? "Pas mal — rejouable pour progresser."
                  : "Relisez la leçon et retentez votre chance !"}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {result.correction.map((c, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 text-sm ${
                  c.ok
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-red-500/30 bg-red-500/5"
                }`}
              >
                <p className="font-medium text-fg">
                  {c.ok ? "✅" : "❌"} {c.question}
                </p>
                {!c.ok && (
                  <p className="mt-1 text-xs text-muted">
                    Réponse(s) attendue(s) :{" "}
                    {c.correctIndices.map((idx) => data!.quiz.questions[i].choices[idx]?.text).join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>

          <button onClick={() => setResult(null)} className="btn-ghost mt-4 w-full">
            ↻ Rejouer le quiz
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-5">
            {data.quiz.questions.map((q, qi) => (
              <div key={q.id}>
                <p className="text-sm font-semibold text-fg">
                  {qi + 1}. {q.text}
                </p>
                <div className="mt-2 space-y-1.5">
                  {q.choices.map((c, ci) => {
                    const checked = (picked[qi] ?? []).includes(ci);
                    return (
                      <button
                        key={ci}
                        onClick={() => toggle(qi, ci)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          checked
                            ? "border-primary bg-primary/10 text-fg"
                            : "border-line bg-surface text-fg-soft hover:bg-surface-2"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] ${
                            checked
                              ? "border-primary bg-primary text-white"
                              : "border-line"
                          }`}
                        >
                          {checked ? "✓" : ""}
                        </span>
                        {c.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={!allAnswered || submitting}
            className="btn-primary mt-5 w-full"
          >
            {submitting
              ? "Correction…"
              : allAnswered
                ? "Valider mes réponses"
                : "Répondez à toutes les questions"}
          </button>
        </>
      )}
    </section>
  );
}
