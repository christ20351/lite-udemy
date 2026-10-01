"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import LessonEditor, { type LessonBlock } from "@/components/LessonEditor";
import { api, API_URL } from "@/lib/api";

type Lesson = {
  id: string;
  title: string;
  content: string | null;
  blocks: LessonBlock[] | null;
  videoPath: string | null;
  duration: number | null;
  position: number;
  isPreview: boolean;
};
type Section = {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
};
type Formation = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  mode: "ONLINE" | "ONSITE" | "HYBRID";
  status: "DRAFT" | "PUBLISHED";
  price: number | null;
  sections: Section[];
};

export default function FormationEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [f, setF] = useState<Formation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [info, setInfo] = useState({
    title: "",
    description: "",
    category: "",
    mode: "ONLINE",
    price: "" as string,
  });

  // état d'édition
  const [newSection, setNewSection] = useState("");
  const [newLessons, setNewLessons] = useState<Record<string, string>>({});
  const [newLessonVideos, setNewLessonVideos] = useState<Record<string, File | undefined>>({});
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api(`/formations/${id}`);
      setF(data.formation);
      setInfo({
        title: data.formation.title,
        description: data.formation.description ?? "",
        category: data.formation.category ?? "",
        mode: data.formation.mode,
        price: data.formation.price === null || data.formation.price === undefined ? "" : String(data.formation.price),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(msg: string) {
    setNotice(msg);
    setError(null);
    setTimeout(() => setNotice(null), 2500);
  }

  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    setError(null);
    try {
      await fn();
      if (okMsg) flash(okMsg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function uploadVideo(lessonId: string, file: File) {
    setUploading(lessonId);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("video", file);
      const data = await api("/uploads/video", { method: "POST", body: fd });
      await api(`/formations/lessons/${lessonId}`, {
        method: "PATCH",
        body: { videoPath: data.url },
      });
      flash("Vidéo téléversée ✓");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload échoué");
    } finally {
      setUploading(null);
    }
  }

  if (!f) {
    return (
      <div className="p-8">
        <p className="text-muted">{error ?? "Chargement…"}</p>
      </div>
    );
  }

  const totalLessons = f.sections.reduce((acc, s) => acc + s.lessons.length, 0);

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/backoffice/formations" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
        ← Toutes les formations
      </Link>

      <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{f.title}</h1>
          <p className="text-muted text-sm mt-1">
            {totalLessons} leçon{totalLessons > 1 ? "s" : ""} · slug : {f.slug}
          </p>
        </div>
        {f.status === "PUBLISHED" ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-medium px-3 py-1">
              Publiée
            </span>
            <button
              onClick={() => run(() => api(`/formations/${f.id}/unpublish`, { method: "POST" }), "Dépubliée")}
              className="text-xs text-muted hover:underline"
            >
              Repasser en brouillon
            </button>
          </div>
        ) : (
          <button
            onClick={() => run(() => api(`/formations/${f.id}/publish`, { method: "POST" }))}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700"
          >
            🚀 Publier
          </button>
        )}
      </div>

      {notice && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm px-3 py-2">
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Infos générales ─────────────────────────────────────────── */}
      <section className="mt-8 bg-surface border border-line rounded-xl p-5">
        <h2 className="font-semibold">Informations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Titre</label>
            <input
              value={info.title}
              onChange={(e) => setInfo({ ...info, title: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Catégorie</label>
            <input
              value={info.category}
              onChange={(e) => setInfo({ ...info, category: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Mode</label>
            <select
              value={info.mode}
              onChange={(e) => setInfo({ ...info, mode: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="ONLINE">En ligne</option>
              <option value="ONSITE">Présentiel</option>
              <option value="HYBRID">Hybride</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Prix (€, vide = gratuit)</label>
            <input
              type="number"
              min={0}
              value={info.price}
              onChange={(e) => setInfo({ ...info, price: e.target.value })}
              placeholder="Gratuite"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              onClick={() =>
                run(
                  () =>
                    api(`/formations/${f.id}`, {
                      method: "PATCH",
                      body: {
                        ...info,
                        price: info.price === "" ? null : Number(info.price),
                      },
                    }),
                  "Informations enregistrées"
                )
              }
              className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary-strong"
            >
              Enregistrer
            </button>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium mb-1">Description</label>
            <textarea
              rows={3}
              value={info.description}
              onChange={(e) => setInfo({ ...info, description: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {/* ── Curriculum ──────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="font-semibold">Curriculum</h2>
        <div className="mt-3 space-y-4">
          {f.sections.map((s) => (
            <div key={s.id} className="bg-surface border border-line rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-line">
                <p className="font-medium text-sm">
                  Section {s.position} — {s.title}
                </p>
                <button
                  onClick={() => run(() => api(`/formations/sections/${s.id}`, { method: "DELETE" }), "Section supprimée")}
                  className="text-xs text-red-500 dark:text-red-400 hover:underline"
                >
                  Supprimer
                </button>
              </div>
              <div className="divide-y divide-line">
                {s.lessons.map((l) => (
                  <div key={l.id} className="px-4 py-3">
                    {editingLesson === l.id ? (
                      <LessonEditor
                        lessonId={l.id}
                        title={l.title}
                        blocks={(l.blocks ?? null) as LessonBlock[] | null}
                        legacyContent={l.content}
                        hasVideo={Boolean(l.videoPath)}
                        onSaved={load}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {l.position}. {l.title}{" "}
                            {l.isPreview && (
                              <span className="text-xs text-amber-600">(aperçu gratuit)</span>
                            )}
                          </p>
                          <p className="text-xs text-faint mt-0.5 flex gap-2">
                            {l.videoPath ? "🎬 vidéo" : ""}
                            {l.videoPath && l.content ? "·" : ""}
                            {l.content ? "📝 texte" : ""}
                            {!l.videoPath && !l.content ? "⚠️ vide" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {uploading === l.id ? (
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 animate-pulse">
                              Téléversement…
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setUploadTarget(l.id);
                                fileInput.current?.click();
                              }}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              {l.videoPath ? "Remplacer la vidéo" : "+ Vidéo"}
                            </button>
                          )}
                          <button
                            onClick={() => setEditingLesson(l.id)}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Éditer
                          </button>
                          <button
                            onClick={() =>
                              run(
                                () =>
                                  api(`/formations/lessons/${l.id}`, {
                                    method: "PATCH",
                                    body: { isPreview: !l.isPreview },
                                  }),
                                l.isPreview ? "Aperçu retiré" : "Aperçu activé"
                              )
                            }
                            className="text-xs text-muted hover:underline"
                          >
                            {l.isPreview ? "Retirer aperçu" : "Aperçu"}
                          </button>
                          <button
                            onClick={() =>
                              run(() => api(`/formations/lessons/${l.id}`, { method: "DELETE" }), "Leçon supprimée")
                            }
                            className="text-xs text-red-500 dark:text-red-400 hover:underline"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const title = newLessons[s.id];
                  if (!title) return;
                  const file = newLessonVideos[s.id];
                  run(async () => {
                    const created = await api(`/formations/sections/${s.id}/lessons`, {
                      method: "POST",
                      body: { title },
                    });
                    setNewLessons({ ...newLessons, [s.id]: "" });
                    setNewLessonVideos((v) => ({ ...v, [s.id]: undefined }));
                    if (file) {
                      const fd = new FormData();
                      fd.append("video", file);
                      const up = await api("/uploads/video", { method: "POST", body: fd });
                      await api(`/formations/lessons/${created.lesson.id}`, {
                        method: "PATCH",
                        body: { videoPath: up.url },
                      });
                    }
                  }, file ? "Leçon ajoutée avec sa vidéo ✓" : "Leçon ajoutée");
                }}
                className="space-y-2 px-4 py-3 border-t border-line"
              >
                <div className="flex gap-2">
                  <input
                    value={newLessons[s.id] ?? ""}
                    onChange={(e) => setNewLessons({ ...newLessons, [s.id]: e.target.value })}
                    placeholder="Titre de la nouvelle leçon…"
                    className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-primary text-white px-3 py-1.5 text-xs font-medium"
                  >
                    + Leçon
                  </button>
                </div>
                {/* Vidéo optionnelle dès la création */}
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-fg">
                  🎬
                  {newLessonVideos[s.id] ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {newLessonVideos[s.id]!.name.slice(0, 40)} — sera téléversée à la création
                    </span>
                  ) : (
                    <span>Joindre la vidéo de la leçon (mp4, webm, mov…)</span>
                  )}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogv"
                    className="hidden"
                    onChange={(e) =>
                      setNewLessonVideos((v) => ({ ...v, [s.id]: e.target.files?.[0] }))
                    }
                  />
                </label>
              </form>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api(`/formations/${f.id}/sections`, {
                method: "POST",
                body: { title: newSection },
              });
              setNewSection("");
            }, "Section ajoutée");
          }}
          className="mt-4 flex gap-2"
        >
          <input
            required
            value={newSection}
            onChange={(e) => setNewSection(e.target.value)}
            placeholder="Titre de la nouvelle section…"
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium"
          >
            + Section
          </button>
        </form>
      </section>

      {/* input fichier caché pour l'upload vidéo */}
      <input
        ref={fileInput}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTarget) uploadVideo(uploadTarget, file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
