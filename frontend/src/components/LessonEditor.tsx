"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CodeXml,
  Eye,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Lightbulb,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
  Video,
  type LucideIcon,
} from "lucide-react";
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
  { label: string; icon: LucideIcon; placeholder: string }
> = {
  text: { label: "Texte", icon: FileText, placeholder: "Paragraphe en HTML léger (<strong>, <ul>…)" },
  image: { label: "Image", icon: ImageIcon, placeholder: "" },
  code: { label: "Code", icon: CodeXml, placeholder: "print('hello world')" },
  callout: { label: "Encadré", icon: Lightbulb, placeholder: "Astuce, avertissement, point clé…" },
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
  // Vignettes locales : aperçu immédiat d'une image choisie, avant la fin de l'upload
  const [localImg, setLocalImg] = useState<Record<number, string>>({});

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
      // l'aperçu serveur remplace la vignette locale
      setLocalImg((p) => {
        if (p[idx]) URL.revokeObjectURL(p[idx]!);
        const next = { ...p };
        delete next[idx];
        return next;
      });
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
      flash("Leçon enregistrée");
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
      flash("Quiz enregistré");
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
        <p className="flex items-start gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-600 dark:text-indigo-400">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{msg}</span>
        </p>
      )}
      {err && (
        <p className="notice-box text-xs">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{err}</span>
        </p>
      )}

      {/* Éditeur à gauche · aperçu apprenant à droite (temps réel) */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div className="min-w-0 space-y-4">

      {/* Titre */}
      <input
        value={editedTitle}
        onChange={(e) => setEditedTitle(e.target.value)}
        className="input"
        placeholder="Titre de la leçon"
      />

      {/* Onglets Contenu / Quiz */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-sm">
        <p className="flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-center font-medium text-fg">
          <FileText className="h-4 w-4 text-primary" />
          Contenu
        </p>
        <p className="flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-center font-medium text-muted">
          <FlaskConical className="h-4 w-4" />
          Quiz ({questions.length})
        </p>
      </div>

      {/* ── Builder de blocs ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {myBlocks.map((b, i) => {
          const BlockIcon = BLOCK_TYPE_META[b.type].icon;
          return (
          <div key={i} className="rounded-lg border border-line bg-surface-2/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-fg">
                <BlockIcon className="h-4 w-4 text-primary" />
                {BLOCK_TYPE_META[b.type].label} #{i + 1}
              </p>
              <div className="flex items-center gap-1 text-xs">
                <button onClick={() => moveBlock(i, -1)} className="rounded px-1 hover:bg-surface" title="Monter"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => moveBlock(i, 1)} className="rounded px-1 hover:bg-surface" title="Descendre"><ChevronDown className="h-3.5 w-3.5" /></button>
                <button
                  onClick={() => setMyBlocks((bl) => bl.filter((_, j) => j !== i))}
                  className="rounded px-1.5 text-muted hover:bg-surface hover:text-fg"
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {b.type === "image" ? (
              <div className="flex items-center gap-3">
                {b.url || localImg[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.url ? `${API_URL}${b.url}` : localImg[i]}
                    alt={b.caption ?? ""}
                    className="h-16 w-28 rounded-none border border-line object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-28 items-center justify-center rounded-none border border-dashed border-line text-muted">
                    <ImageIcon className="h-5 w-5" />
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
                        if (f) {
                          // vignette locale immédiate, le temps de l'upload
                          setLocalImg((p) => {
                            if (p[i]) URL.revokeObjectURL(p[i]!);
                            return { ...p, [i]: URL.createObjectURL(f) };
                          });
                          uploadImage(i, f);
                        }
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
          );
        })}

        {!useBlocks && legacyContent && (
          <div className="notice-box flex-col">
            <p className="flex items-start gap-2 text-xs">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Cette leçon utilise l&apos;ancien contenu HTML. Ajoutez des blocs pour passer au
                nouveau format (la vidéo reste toujours en haut).
              </span>
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
          {(Object.keys(BLOCK_TYPE_META) as LessonBlock["type"][]).map((t) => {
            const AddIcon = BLOCK_TYPE_META[t].icon;
            return (
              <button key={t} onClick={() => addBlock(t)} className="btn-ghost text-xs">
                <Plus className="h-4 w-4 text-primary" />
                <AddIcon className="h-4 w-4" />
                {BLOCK_TYPE_META[t].label}
              </button>
            );
          })}
          <button onClick={saveContent} disabled={saving} className="btn-primary ml-auto text-xs">
            <Save className="h-4 w-4" />
            {saving ? "Enregistrement…" : "Enregistrer la leçon"}
          </button>
        </div>
        {hasVideo && (
          <p className="flex items-center gap-1.5 text-xs text-faint">
            <Video className="h-4 w-4" />
            La vidéo reste automatiquement affichée en haut de la leçon.
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
                    className="btn-danger text-xs"
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
                        className="text-muted hover:text-fg"
                        title="Supprimer ce choix"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Plus className="h-4 w-4" />
                      un choix
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
                <Plus className="h-4 w-4 text-primary" />
                Question
              </button>
              <button onClick={saveQuiz} disabled={quizSaving} className="btn-primary text-xs">
                <FlaskConical className="h-4 w-4" />
                {quizSaving ? "Enregistrement…" : "Enregistrer le quiz"}
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

        </div>

        {/* ── Aperçu temps réel (rendu identique au portail apprenant) ── */}
        <aside className="hidden xl:block">
          <div className="sticky top-20">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Eye className="h-4 w-4" aria-hidden />
              Aperçu apprenant — temps réel
            </p>
            <div className="overflow-hidden border border-line bg-surface">
              <div className="border-b border-line bg-surface-2 px-4 py-2.5">
                <p className="truncate text-sm font-semibold text-fg">
                  {editedTitle || "Titre de la leçon"}
                </p>
              </div>
              <div className="space-y-4 p-4">
                {hasVideo && (
                  <div className="flex aspect-video items-center justify-center border border-line bg-surface-2 text-muted">
                    <span className="flex flex-col items-center gap-1.5 text-xs">
                      <Video className="h-6 w-6" aria-hidden />
                      Vidéo affichée en tête de leçon
                    </span>
                  </div>
                )}

                {myBlocks.map((b, i) => {
                  if (b.type === "image") {
                    return b.url || localImg[i] ? (
                      <figure key={i} className="overflow-hidden border border-line bg-surface">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.url ? `${API_URL}${b.url}` : localImg[i]}
                          alt={b.caption ?? ""}
                          className="max-h-96 w-full object-cover"
                        />
                        {b.caption && (
                          <figcaption className="px-4 py-2 text-xs text-muted">
                            {b.caption}
                          </figcaption>
                        )}
                      </figure>
                    ) : (
                      <div
                        key={i}
                        className="flex h-24 items-center justify-center border border-dashed border-line text-xs text-faint"
                      >
                        Image pas encore choisie
                      </div>
                    );
                  }
                  if (b.type === "code") {
                    return (
                      <pre
                        key={i}
                        className="overflow-x-auto border border-line bg-[#0d1428] p-4 font-mono text-sm text-slate-100"
                      >
                        <code>{b.text}</code>
                      </pre>
                    );
                  }
                  if (b.type === "callout") {
                    return (
                      <div
                        key={i}
                        className="border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-fg-soft"
                      >
                        <Lightbulb className="inline h-4 w-4 align-[-3px] text-primary" /> {b.text}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="border border-line bg-surface p-6 text-sm leading-relaxed
                        [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2
                        [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
                        [&_li]:my-1 [&_p]:my-2
                        [&_strong]:font-semibold [&_em]:italic"
                      dangerouslySetInnerHTML={{ __html: b.text ?? "" }}
                    />
                  );
                })}

                {!useBlocks && legacyContent && (
                  <article
                    className="border border-line bg-surface p-6 text-sm leading-relaxed
                      [&_h2]:text-lg [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_p]:my-2
                      [&_strong]:font-semibold [&_em]:italic"
                    dangerouslySetInnerHTML={{ __html: legacy }}
                  />
                )}

                {useBlocks && myBlocks.length === 0 && !hasVideo && (
                  <p className="border border-dashed border-line px-3 py-6 text-center text-xs text-faint">
                    Ajoutez des blocs à gauche pour voir l&apos;aperçu se construire.
                  </p>
                )}

                {questions.length > 0 && (
                  <p className="flex items-center gap-1.5 bg-surface-2 px-3 py-2 text-xs text-muted">
                    <FlaskConical className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    Quiz de {questions.length} question{questions.length > 1 ? "s" : ""} en fin de
                    leçon
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* input caché partagé (compat ancien flux) */}
      <input ref={imageInput} type="file" className="hidden" />
    </div>
  );
}
