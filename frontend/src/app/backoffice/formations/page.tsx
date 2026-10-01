"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Formation = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  mode: "ONLINE" | "ONSITE" | "HYBRID";
  status: "DRAFT" | "PUBLISHED";
  price: number | null;
  createdAt: string;
  _count: { sections: number; sessions: number; accesses: number };
};

const MODE_LABELS = { ONLINE: "En ligne", ONSITE: "Présentiel", HYBRID: "Hybride" } as const;

export default function FormationsPage() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState<Formation["mode"]>("ONLINE");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api("/formations");
    setFormations(data.formations);
  }, []);

  useEffect(() => {
    load().catch(() => setError("Chargement impossible"));
  }, [load]);

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
        },
      });
      setShowForm(false);
      setTitle("");
      setCategory("");
      setDescription("");
      window.location.href = `/backoffice/formations/${data.formation.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Formations</h1>
          <p className="text-muted mt-1 text-sm">
            Le catalogue de l&apos;organisme.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          + Nouvelle formation
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={create}
          className="mt-4 bg-surface border border-line rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
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
            <label className="block text-xs font-medium mb-1">Prix (€, vide = gratuit)</label>
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
            <label className="block text-xs font-medium mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700"
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
            className="bg-surface rounded-xl border border-line p-5 hover:border-indigo-300 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-faint uppercase tracking-wide">
                {f.category ?? "Général"}
              </span>
              <div className="flex items-center gap-1.5">
                {Date.now() - new Date(f.createdAt).getTime() < 30 * 24 * 3600 * 1000 && (
                  <span className="chip bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">✦ Nouveau</span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    f.status === "PUBLISHED"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {f.status === "PUBLISHED" ? "Publiée" : "Brouillon"}
                </span>
              </div>
            </div>
            <h3 className="font-semibold mt-2">{f.title}</h3>
            <p className="text-xs text-faint mt-1">
              {MODE_LABELS[f.mode]} · {f._count.sections} section
              {f._count.sections > 1 ? "s" : ""} · {f._count.accesses} apprenant
              {f._count.accesses > 1 ? "s" : ""}
            </p>
          </Link>
        ))}
        {formations.length === 0 && (
          <p className="text-sm text-faint col-span-full">
            Aucune formation. Créez la première !
          </p>
        )}
      </div>
    </div>
  );
}
