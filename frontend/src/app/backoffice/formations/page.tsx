"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, API_URL } from "@/lib/api";
import { useAuth, isGestion } from "@/lib/auth";
import NotificationsPanel from "@/components/NotificationsPanel";
import {
  CircleAlert,
  Image as ImageIcon,
  Star,
  TriangleAlert,
  UserRound,
} from "lucide-react";

type Formation = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  mode: "ONLINE" | "ONSITE" | "HYBRID";
  status: "DRAFT" | "PUBLISHED";
  price: number | null;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl: string | null;
  instructors: Array<{ id: string; name: string }>;
  _count: { sections: number; sessions: number; enrollments: number };
};

const MODE_LABELS = { ONLINE: "En ligne", ONSITE: "Présentiel", HYBRID: "Hybride" } as const;

/** true si la formation a été touchée il y a moins de 24 h */
function modifieeRecemment(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() < 24 * 3600 * 1000;
}

export default function FormationsPage() {
  const { user } = useAuth();
  const gestion = isGestion(user?.role);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState<Formation["mode"]>("ONLINE");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [formateurs, setFormateurs] = useState<Array<{ id: string; name: string }>>([]);
  const [instructorId, setInstructorId] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadThumbnail(file: File) {
    setThumbUploading(true);
    setError(null);
    try {
      // vignette locale immédiate pendant l'upload
      const local = URL.createObjectURL(file);
      setThumbPreview(local);
      const fd = new FormData();
      fd.append("image", file);
      const d = await api("/uploads/image", { method: "POST", body: fd });
      setThumbnailUrl(d.url);
      setThumbPreview(`${d.url}`); // l'URL serveur remplace l'aperçu local
      URL.revokeObjectURL(local);
    } catch (err) {
      setThumbPreview(null);
      setError(err instanceof Error ? err.message : "Upload échoué");
    } finally {
      setThumbUploading(false);
    }
  }

  const load = useCallback(async () => {
    const data = await api("/formations");
    setFormations(data.formations);
  }, []);

  useEffect(() => {
    load().catch(() => setError("Chargement impossible"));
    if (gestion) {
      api("/formations/formateurs/options")
        .then((d) => setFormateurs(d.formateurs))
        .catch(() => {});
    }
  }, [load, gestion]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const data = await api("/formations", {
        method: "POST",
        body: {
          title,
          category: category || null,
          mode,
          description: description || null,
          price: price === "" ? null : Number(price),
          instructorId: instructorId || null,
          thumbnailUrl,
        },
      });
      setShowForm(false);
      setTitle("");
      setCategory("");
      setDescription("");
      setInstructorId("");
      setThumbnailUrl(null);
      setThumbPreview(null);
      window.location.href = `/backoffice/formations/${data.formation.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{gestion ? "Formations" : "Mes formations"}</h1>
          <p className="text-muted mt-1 text-sm">
            {gestion
              ? "Le catalogue : créez la coquille puis assignez un formateur qui construira le contenu."
              : "Les formations qui vous sont assignées : construisez le curriculum et le contenu."}
          </p>
        </div>
        {gestion && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
          >
            + Nouvelle formation
          </button>
        )}
      </div>

      {user && <NotificationsPanel />}

      {showForm && (
        <form
          onSubmit={create}
          className="mt-4 bg-surface border border-line rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {error && (
            <div className="notice-box md:col-span-2">
              <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Titre *</label>
            <input
              required
              minLength={3}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Python pour la Data"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Catégorie</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex : Data, Management…"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Formation["mode"])}
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
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Gratuite"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">
              Formateur chargé du contenu *
            </label>
            {formateurs.length > 0 ? (
              <select
                required
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="">Choisir un formateur…</option>
                {formateurs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="notice-box text-xs">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Aucun formateur disponible : demandez à un admin d&apos;en créer un
                  (page Équipe) avant de créer une formation.
                </span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-faint">
              Le formateur est notifié immédiatement et construit le cours.
            </p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">
              Image de couverture (optionnelle — affichée en fond de la box de la formation)
            </label>
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface-2 text-muted">
                {thumbPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbPreview.startsWith("/api/") ? `${API_URL}${thumbPreview}` : thumbPreview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-5 w-5" aria-hidden />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="btn-ghost cursor-pointer w-fit text-xs">
                  {thumbUploading ? "Téléversement…" : thumbnailUrl ? "Remplacer l'image" : "Choisir une image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadThumbnail(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {thumbnailUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setThumbnailUrl(null);
                      setThumbPreview(null);
                    }}
                    className="text-xs text-muted hover:text-fg hover:underline w-fit"
                  >
                    Retirer l&apos;image
                  </button>
                )}
                <p className="text-[11px] text-faint">
                  Sans image, un dégradé indigo est généré automatiquement.
                </p>
              </div>
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={!instructorId}
              className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
            >
              Créer la formation
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {formations.map((f) => (
          <Link
            key={f.id}
            href={`/backoffice/formations/${f.id}`}
            className="bg-surface rounded-xl border border-line p-5 hover:border-indigo-300 hover:shadow-sm transition relative overflow-hidden"
          >
            {f.thumbnailUrl && (
              <div className="-mx-5 -mt-5 mb-4 h-32 overflow-hidden border-b border-line bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_URL}${f.thumbnailUrl}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-faint uppercase tracking-wide">
                  {f.category ?? "Général"}
                </span>
              <div className="flex items-center gap-1.5">
                {modifieeRecemment(f.updatedAt) && (
                  <span className="chip inline-flex items-center gap-1 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600" />
                    </span>
                    Modifiée
                  </span>
                )}
                {Date.now() - new Date(f.createdAt).getTime() < 30 * 24 * 3600 * 1000 && (
                  <span className="chip inline-flex items-center gap-1 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Star className="h-3 w-3" aria-hidden />
                    Nouveau
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    f.status === "PUBLISHED"
                      ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {f.status === "PUBLISHED" ? "Publiée" : "Brouillon"}
                </span>
              </div>
            </div>
            <h3 className="font-semibold mt-2">{f.title}</h3>
            <p className="text-xs text-faint mt-1">
              {MODE_LABELS[f.mode]} · {f._count.sections} section
              {f._count.sections > 1 ? "s" : ""} · {f._count.enrollments} apprenant
              {f._count.enrollments > 1 ? "s" : ""} · modifiée le{" "}
              {new Date(f.updatedAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {f.instructors.length > 0 && (
              <p className="text-xs text-muted mt-1.5 flex items-center gap-1.5">
                <UserRound className="h-4 w-4 shrink-0" aria-hidden />
                {f.instructors.map((i) => i.name).join(", ")}
              </p>
            )}
            </div>
          </Link>
        ))}
        {formations.length === 0 && (
          <p className="text-sm text-faint col-span-full">
            {gestion
              ? "Aucune formation. Créez la première !"
              : "Aucune formation ne vous est encore assignée."}
          </p>
        )}
      </div>
    </div>
  );
}
