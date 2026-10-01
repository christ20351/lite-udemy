"use client";

import { useEffect, useRef, useState } from "react";
import { api, API_URL } from "@/lib/api";

export type LessonBlock = {
  type: "text" | "image" | "code" | "callout";
  text?: string | null;
  url?: string | null;
  caption?: string | null;
};

type QuizQuestion = {
  text: string;
  choices: Array<{ text: string; correct: boolean }>;
  order?: number;
};

const BLOCK_TYPE_META: Record<
  LessonBlock["type"],
  { label: string; icon: string; placeholder: string }
> = {
  text: { label: "Texte", icon: "📝", placeholder: "Paragraphe en HTML léger (<strong>, <ul>…)" },
  image: { label: "Image", icon: "🖼️", placeholder: "" },
  code: { label: "Code", icon: "💻", placeholder: "print('hello world')" },
  callout: { label: "Encadré", icon: "💡", placeholder: "Astuce, avertissement, point clé…" },
};

export default function LessonEditor({
  lessonId,
  title,
  blocks,
  legacyContent,
  hasVideo,
  onSaved,
}: {
  lessonId: string;
  title: string;
  blocks: LessonBlock[] | null;
  legacyContent: string | null;
  hasVideo: boolean;
  onSaved: () => void;
}) {
  // ── Contenu (blocs) ──────────────────────────────────────────────
  const [editedTitle, setEditedTitle] = useState(title);
  const [myBlocks, setMyBlocks] = useState<LessonBlock[]>(blocks ?? []);
  const [useBlocks, setUseBlocks] = useState((blocks ?? []).length > 0);
  const [legacy, setLegacy] = useState(legacyContent ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const imageTarget = useRef<number | null>(null);

  // ── Quiz ─────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoaded, setQuizLoaded] = useState(false);
  const [quizSaving, setQuizSaving] = useState(false);
  const [attempts, setAttempts] = useState<Array<{ user: { name: string }; score: number; total: number }>>([]);

  useEffect(() => {
    api(`/staff/quiz/lessons/${lessonId}/quiz`)
      .then((d) => {
        setQuestions(
          (d.quiz?.questions ?? []).map((q: QuizQuestion & { id?: string }) => ({
            text: q.text,
            choices: q.choices,
          }))
        );
        setAttempts(d.attempts ?? []);
        setQuizLoaded(true);
      })
      .catch(() => setQuizLoaded(true));
  }, [lessonId]);

  function flash(m: string) {
    setMsg(m);
    setErr(null);
    setTimeout(() => setMsg(null), 2500);
  }

  function addBlock(type: LessonBlock["type"]) {
    setUseBlocks(true);
    setMyBlocks((b) => [
      ...b,
      { type, text: type === "text" ? "<p>Votre texte…</p>" : "", url: null, caption: null },
    ]);
  }

  function moveBlock(i: number, dir: -1 | 1) {
    setMyBlocks((b) => {
      const j = i + dir;
      if (j < 0 || j >= b.length) return b;
      const copy = [...b];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function uploadImage(idx: number, file: File) {
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const d = await api("/uploads/image", { method: "POST", body: fd });
      setMyBlocks((b) =>
        b.map((bl, i) => (i === idx ? { ...bl, type: "image", url: d.url } : bl))
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload échoué");
    }
  }

  async function saveContent() {
    setSaving(true);
    setErr(null);
    try {
      await api(`/formations/lessons/${lessonId}`, {
        method: "PATCH",
        body: {
          title: editedTitle,
          ...(useBlocks
            ? {
                blocks: myBlocks.map((b) => ({
                  type: b.type,
                  text: b.text ?? null,
                  url: b.url ?? null,
                  caption: b.caption ?? null,
                })),
              }
            : { content: legacy || null }),
        },
      });
      flash("Leçon enregistrée ✓");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function saveQuiz() {
    if (questions.length === 0) {
      // supprimer le quiz si vide → PUT requiert 1 question, on envoie un quiz minimal ? Non : on refuse.
      setErr("Ajoutez au moins une question (ou laissez le quiz vide pour l'instant).");
      return;
    }
    setQuizSaving(true);
    setErr(null);
    try {
      await api(`/staff/quiz/lessons/${lessonId}/quiz`, {
        method: "PUT",
        body: { questions: questions.map((q, i) => ({ ...q, order: i })) },
      });
      flash("Quiz enregistré ✓");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setQuizSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-surface p-4">
      {msg && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
          {msg}
        </p>
      )}
      {err && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {err}
        </p>
      )}

      {/* Titre */}
      <input
        value={editedTitle}
        onChange={(e) => setEditedTitle(e.target.value)}
        className="input"
        placeholder="Titre de la leçon"
      />

      {/* Onglets Contenu / Quiz */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-sm">
        <p className="rounded-md px-3 py-1.5 text-center font-medium text-fg">📝 Contenu</p>
        <p className="rounded-md px-3 py-1.5 text-center font-medium text-muted">
          🧪 Quiz ({questions.length})
        </p>
      </div>

      {/* ── Builder de blocs ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {myBlocks.map((b, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface-2/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-fg">
                {BLOCK_TYPE_META[b.type].icon} {BLOCK_TYPE_META[b.type].label} #{i + 1}
              </p>
              <div className="flex gap-1 text-xs">
                <button onClick={() => moveBlock(i, -1)} className="rounded px-1.5 hover:bg-surface" title="Monter">↑</button>
                <button onClick={() => moveBlock(i, 1)} className="rounded px-1.5 hover:bg-surface" title="Descendre">↓</button>
                <button
                  onClick={() => setMyBlocks((bl) => bl.filter((_, j) => j !== i))}
                  className="rounded px-1.5 text-red-500 hover:bg-surface"
                  title="Supprimer"
                >
                  ×
                </button>
              </div>
            </div>

            {b.type === "image" ? (
              <div className="flex items-center gap-3">
                {b.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${API_URL}${b.url}`}
                    alt={b.caption ?? ""}
                    className="h-16 w-28 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed border-line text-lg">
                    🖼️
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <label className="btn-ghost cursor-pointer text-xs">
                    {b.url ? "Remplacer l'image" : "Choisir une image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(i, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <input
                    value={b.caption ?? ""}
                    onChange={(e) =>
                      setMyBlocks((bl) =>
                        bl.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x))
                      )
                    }
                    placeholder="Légende (optionnelle)"
                    className="input py-1 text-xs"
                  />
                </div>
              </div>
            ) : (
              <textarea
                rows={b.type === "code" ? 4 : 3}
                value={b.text ?? ""}
                onChange={(e) =>
                  setMyBlocks((bl) =>
                    bl.map((x, j) => (j === i ? { ...x, text: e.target.value } : x))
                  )
                }
                placeholder={BLOCK_TYPE_META[b.type].placeholder}
                className={`input font-mono text-xs ${b.type !== "code" ? "font-sans" : ""}`}
              />
            )}
          </div>
        ))}

        {!useBlocks && legacyContent && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Cette leçon utilise l&apos;ancien contenu HTML. Ajoutez des blocs pour passer au
              nouveau format (la vidéo reste toujours en haut).
            </p>
            <textarea
              rows={4}
              value={legacy}
              onChange={(e) => setLegacy(e.target.value)}
              className="input mt-2 font-mono text-xs"
            />
          </div>
        )}

        {/* Boutons d'ajout de blocs */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BLOCK_TYPE_META) as LessonBlock["type"][]).map((t) => (
            <button key={t} onClick={() => addBlock(t)} className="btn-ghost text-xs">
              + {BLOCK_TYPE_META[t].icon} {BLOCK_TYPE_META[t].label}
            </button>
          ))}
          <button onClick={saveContent} disabled={saving} className="btn-primary ml-auto text-xs">
            {saving ? "Enregistrement…" : "💾 Enregistrer la leçon"}
          </button>
        </div>
        {hasVideo && (
          <p className="text-xs text-faint">
            🎬 La vidéo reste automatiquement affichée en haut de la leçon.
          </p>
        )}
      </div>

      {/* ── Builder quiz ─────────────────────────────────────────────── */}
      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Questions du quiz
        </p>
        {!quizLoaded ? (
          <p className="text-xs text-faint">Chargement du quiz…</p>
        ) : (
          <>
            {questions.map((q, qi) => (
              <div key={qi} className="rounded-lg border border-line bg-surface-2/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-fg">Question {qi + 1}</p>
                  <button
                    onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== qi))}
                    className="text-xs text-red-500"
                  >
                    Supprimer
                  </button>
                </div>
                <input
                  value={q.text}
                  onChange={(e) =>
                    setQuestions((qs) =>
                      qs.map((x, j) => (j === qi ? { ...x, text: e.target.value } : x))
                    )
                  }
                  placeholder="Énoncé de la question…"
                  className="input mt-2"
                />
                <div className="mt-2 space-y-1.5">
                  {q.choices.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={c.correct}
                        onChange={(e) =>
                          setQuestions((qs) =>
                            qs.map((x, j) =>
                              j === qi
                                ? {
                                    ...x,
                                    choices: x.choices.map((ch, k) =>
                                      k === ci ? { ...ch, correct: e.target.checked } : ch
                                    ),
                                  }
                                : x
                            )
                          )
                        }
                        title="Bonne réponse"
                      />
                      <input
                        value={c.text}
                        onChange={(e) =>
                          setQuestions((qs) =>
                            qs.map((x, j) =>
                              j === qi
                                ? {
                                    ...x,
                                    choices: x.choices.map((ch, k) =>
                                      k === ci ? { ...ch, text: e.target.value } : ch
                                    ),
                                  }
                                : x
                            )
                          )
                        }
                        placeholder={`Choix ${ci + 1}`}
                        className="input py-1 text-xs"
                      />
                      <button
                        onClick={() =>
                          setQuestions((qs) =>
                            qs.map((x, j) =>
                              j === qi
                                ? { ...x, choices: x.choices.filter((_, k) => k !== ci) }
                                : x
                            )
                          )
                        }
                        className="text-xs text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {q.choices.length < 6 && (
                    <button
                      onClick={() =>
                        setQuestions((qs) =>
                          qs.map((x, j) =>
                            j === qi
                              ? { ...x, choices: [...x.choices, { text: "", correct: false }] }
                              : x
                          )
                        )
                      }
                      className="text-xs text-primary hover:underline"
                    >
                      + un choix
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  setQuestions((qs) => [
                    ...qs,
                    {
                      text: "",
                      choices: [
                        { text: "", correct: true },
                        { text: "", correct: false },
                      ],
                    },
                  ])
                }
                className="btn-ghost text-xs"
              >
                + Question
              </button>
              <button onClick={saveQuiz} disabled={quizSaving} className="btn-primary text-xs">
                {quizSaving ? "Enregistrement…" : "🧪 Enregistrer le quiz"}
              </button>
              {attempts.length > 0 && (
                <span className="text-xs text-faint">
                  {attempts.length} tentative{attempts.length > 1 ? "s" : ""} ·{" "}
                  {attempts[0].user.name} : {attempts[0].score}/{attempts[0].total}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* input caché partagé (compat ancien flux) */}
      <input ref={imageInput} type="file" className="hidden" />
    </div>
  );
}
