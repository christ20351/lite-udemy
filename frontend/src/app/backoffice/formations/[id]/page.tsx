"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import LessonEditor, { type LessonBlock } from "@/components/LessonEditor";
import { api, API_URL } from "@/lib/api";
import { useAuth, isGestion } from "@/lib/auth";
import { BellRing, CircleAlert, CircleCheck, FileText, Image as ImageIcon, Rocket, TriangleAlert, UserRound, Video } from "lucide-react";

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
  updatedAt: string;
  thumbnailUrl: string | null;
  instructors: Array<{ id: string; name: string; email: string }>;
  sections: Section[];
};

export default function FormationEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const gestion = isGestion(user?.role);

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
  const [formateursOptions, setFormateursOptions] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [formateurChoice, setFormateurChoice] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbUploading, setThumbUploading] = useState(false);

  // état d'édition
  const [newSection, setNewSection] = useState("");
  const [newLessons, setNewLessons] = useState<Record<string, string>>({});
  const [newLessonVideos, setNewLessonVideos] = useState<Record<string, File | undefined>>({});
  const [newLessonVideoPreviews, setNewLessonVideoPreviews] = useState<Record<string, string>>({});
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api(`/formations/${id}`);
      setF(data.formation);
      setThumbUrl(data.formation.thumbnailUrl ?? null);
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
    if (gestion) {
      api("/formations/formateurs/options")
        .then((d) => setFormateursOptions(d.formateurs))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, gestion]);

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
      flash("Vidéo téléversée");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload échoué");
    } finally {
      setUploading(null);
    }
  }

  async function uploadCover(file: File) {
    setUploadingCover(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const data = await api("/uploads/image", { method: "POST", body: fd });
      await api(`/formations/${f!.id}`, {
        method: "PATCH",
        body: { thumbnailUrl: data.url },
      });
      flash("Image de couverture mise à jour ✓");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload échoué");
    } finally {
      setUploadingCover(false);
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
    <div className={`p-8 ${editingLesson ? "max-w-6xl" : "max-w-4xl"}`}>
      <Link href="/backoffice/formations" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
        ← Toutes les formations
      </Link>

      <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{f.title}</h1>
          <p className="text-muted text-sm mt-1">
            {totalLessons} leçon{totalLessons > 1 ? "s" : ""} · slug : {f.slug} · modifiée le{" "}
            {new Date(f.updatedAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        {gestion ? (
          f.status === "PUBLISHED" ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-xs font-medium px-3 py-1">
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
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
            >
              <Rocket className="h-4 w-4" aria-hidden />
              Publier
            </button>
          )
        ) : (
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full text-xs font-medium px-3 py-1 ${
                f.status === "PUBLISHED"
                  ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                  : "bg-surface-2 text-muted"
              }`}
            >
              {f.status === "PUBLISHED" ? "Publiée" : "Brouillon"}
            </span>
            <button
              disabled={totalLessons === 0}
              onClick={() =>
                run(
                  () =>
                    api(`/formations/${f.id}/notify-ready`, {
                      method: "POST",
                      body: {},
                    }),
                  "La gestion a été prévenue — elle peut relire le contenu depuis sa file de notifications"
                )
              }
              title={
                totalLessons === 0
                  ? "Ajoutez d'abord au moins une leçon"
                  : "Signaler à l'ADMIN et aux GESTIONNAIRES que le contenu est prêt ou à jour"
              }
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-fg-soft transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <BellRing className="h-4 w-4 text-primary" aria-hidden />
              Prévenir la gestion
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className="notice-box mt-4">
          <CircleCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="notice-box mt-4">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {/* ── Formateurs assignés (gestion) ───────────────────────────── */}
      {gestion && (
        <section className="mt-8 bg-surface border border-line rounded-xl p-5">
          <h2 className="font-semibold">Formateurs assignés</h2>
          <p className="text-xs text-muted mt-1">
            Le formateur construit le contenu de la formation et anime ses sessions.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {f.instructors.map((i) => (
              <span
                key={i.id}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-xs px-3 py-1.5"
              >
                <UserRound className="h-4 w-4 shrink-0" aria-hidden />
                {i.name}
                <button
                  title="Retirer"
                  onClick={() =>
                    run(
                      () => api(`/formations/${f.id}/instructors/${i.id}`, { method: "DELETE" }),
                      "Formateur retiré"
                    )
                  }
                  className="font-bold opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
            {f.instructors.length === 0 && (
              <span className="text-xs text-faint">Aucun formateur assigné.</span>
            )}
          </div>
          <div className="mt-3 flex gap-2 items-center">
            <select
              value={formateurChoice}
              onChange={(e) => setFormateurChoice(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
            >
              <option value="">Choisir un formateur…</option>
              {formateursOptions
                .filter((o) => !f.instructors.some((i) => i.id === o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
            <button
              disabled={!formateurChoice}
              onClick={() => {
                run(
                  () =>
                    api(`/formations/${f.id}/instructors`, {
                      method: "POST",
                      body: { userId: formateurChoice },
                    }),
                  "Formateur assigné"
                );
                setFormateurChoice("");
              }}
              className="rounded-lg bg-primary text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Assigner
            </button>
          </div>
        </section>
      )}

      {/* ── Infos générales (gestion) ───────────────────────────────── */}
      {gestion && (
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
            <label className="block text-xs font-medium mb-1">Prix (FCFA, vide = gratuit)</label>
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
          <div className="md:col-span-3 border-t border-line pt-4">
            <label className="block text-xs font-medium mb-1.5">
              Image de couverture — visible par les apprenants (catalogue, accueil)
            </label>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative h-24 w-44 overflow-hidden rounded-xl border border-line">
                {f.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${API_URL}${f.thumbnailUrl}`}
                    alt="Couverture"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-2 text-[11px] text-faint">
                    Aucune image — dégradé auto
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {uploadingCover ? (
                  <span className="text-xs text-primary animate-pulse">Téléversement…</span>
                ) : (
                  <button
                    onClick={() => coverInput.current?.click()}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-strong"
                  >
                    {f.thumbnailUrl ? "Remplacer l'image" : "+ Ajouter une image"}
                  </button>
                )}
                {f.thumbnailUrl && (
                  <button
                    onClick={() =>
                      run(
                        () => api(`/formations/${f.id}`, { method: "PATCH", body: { thumbnailUrl: null } }),
                        "Image retirée"
                      )
                    }
                    className="text-xs text-muted hover:text-red-500 hover:underline"
                  >
                    Retirer (revenir au dégradé auto)
                  </button>
                )}
                <p className="text-[11px] text-faint">
                  jpg, png, webp… — sans image, un dégradé unique à la formation est généré.
                </p>
              </div>
            </div>
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
          <div className="md:col-span-3">
            <label className="block text-xs font-medium mb-1">
              Image de couverture (fond de la box de la formation)
            </label>
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface-2 text-muted">
                {thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${API_URL}${thumbUrl}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-5 w-5" aria-hidden />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="btn-ghost cursor-pointer w-fit text-xs">
                  {thumbUploading ? "Téléversement…" : thumbUrl ? "Remplacer l'image" : "Choisir une image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setThumbUploading(true);
                      const fd = new FormData();
                      fd.append("image", file);
                      api("/uploads/image", { method: "POST", body: fd })
                        .then((d) =>
                          run(
                            () =>
                              api(`/formations/${f!.id}`, {
                                method: "PATCH",
                                body: { thumbnailUrl: d.url },
                              }),
                            "Image de couverture mise à jour"
                          )
                        )
                        .catch((err) =>
                          setError(err instanceof Error ? err.message : "Upload échoué")
                        )
                        .finally(() => setThumbUploading(false));
                      e.target.value = "";
                    }}
                  />
                </label>
                {thumbUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      run(
                        () =>
                          api(`/formations/${f!.id}`, {
                            method: "PATCH",
                            body: { thumbnailUrl: null },
                          }),
                        "Image retirée"
                      ).then(() => setThumbUrl(null))
                    }
                    className="text-xs text-muted hover:text-fg hover:underline w-fit"
                  >
                    Retirer l&apos;image
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

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
                  className="text-xs text-muted hover:text-fg hover:underline"
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
                        <div className="flex min-w-0 items-center gap-3">
                          {l.videoPath && (
                            // eslint-disable-next-line jsx-a11y/media-has-caption
                            <video
                              src={`${API_URL}${l.videoPath}`}
                              muted
                              preload="metadata"
                              className="h-16 w-28 shrink-0 rounded-none border border-line bg-surface-2 object-cover"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {l.position}. {l.title}{" "}
                              {l.isPreview && (
                                <span className="text-xs text-primary">(aperçu gratuit)</span>
                              )}
                            </p>
                            <p className="text-xs text-faint mt-0.5 flex flex-wrap items-center gap-2">
                              {l.videoPath ? (
                                <span className="inline-flex items-center gap-1">
                                  <Video className="h-3.5 w-3.5" aria-hidden />
                                  vidéo
                                </span>
                              ) : (
                                ""
                              )}
                              {l.videoPath && (l.content || (l.blocks && l.blocks.length > 0))
                                ? "·"
                                : ""}
                              {l.content || (l.blocks && l.blocks.length > 0) ? (
                                <span className="inline-flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5" aria-hidden />
                                  {l.content ? "texte" : `${l.blocks!.length} bloc${l.blocks!.length > 1 ? "s" : ""}`}
                                </span>
                              ) : (
                                ""
                              )}
                              {!l.videoPath && !l.content && !(l.blocks && l.blocks.length > 0) ? (
                                <span className="inline-flex items-center gap-1">
                                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                                  vide
                                </span>
                              ) : (
                                ""
                              )}
                            </p>
                          </div>
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
                            className="text-xs text-muted hover:text-fg hover:underline"
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
                    setNewLessonVideoPreviews((p) => {
                      if (p[s.id]) URL.revokeObjectURL(p[s.id]!);
                      return { ...p, [s.id]: "" };
                    });
                    if (file) {
                      const fd = new FormData();
                      fd.append("video", file);
                      const up = await api("/uploads/video", { method: "POST", body: fd });
                      await api(`/formations/lessons/${created.lesson.id}`, {
                        method: "PATCH",
                        body: { videoPath: up.url },
                      });
                    }
                  }, file ? "Leçon ajoutée avec sa vidéo" : "Leçon ajoutée");
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
                {/* Vidéo optionnelle dès la création, aperçu immédiat */}
                <label className="flex cursor-pointer items-center gap-3 text-xs text-muted hover:text-fg">
                  {newLessonVideos[s.id] ? (
                    <>
                      <video
                        src={newLessonVideoPreviews[s.id]}
                        muted
                        preload="metadata"
                        className="h-16 w-28 shrink-0 rounded-none border border-line bg-surface-2 object-cover"
                      />
                      <span className="text-primary">
                        {newLessonVideos[s.id]!.name.slice(0, 40)} — sera téléversée à la création
                      </span>
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4 shrink-0" aria-hidden />
                      <span>Joindre la vidéo de la leçon (mp4, webm, mov…)</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setNewLessonVideos((v) => ({ ...v, [s.id]: file }));
                      setNewLessonVideoPreviews((p) => {
                        if (p[s.id]) URL.revokeObjectURL(p[s.id]!);
                        return { ...p, [s.id]: file ? URL.createObjectURL(file) : "" };
                      });
                    }}
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

      {/* input fichier caché pour la couverture */}
      <input
        ref={coverInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadCover(file);
          e.target.value = "";
        }}
      />

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
