"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PortalHeader from "@/components/PortalHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type CatalogueItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  mode: "ONLINE" | "ONSITE" | "HYBRID";
  price: number | null;
  isNew: boolean;
  lessonCount: number;
  enrolled: boolean;
};

const MODE_BADGES = {
  ONLINE: "🌐 En ligne",
  ONSITE: "🏫 Présentiel",
  HYBRID: "🔀 Hybride",
} as const;

export default function CataloguePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<CatalogueItem[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    const d = await api("/catalogue");
    setItems(d.catalogue);
  }, []);

  useEffect(() => {
    if (user) load().catch(() => setItems([]));
  }, [user, load]);

  async function enroll(item: CatalogueItem) {
    setPendingId(item.id);
    setMessage(null);
    try {
      await api("/me/enroll", { method: "POST", body: { formationId: item.id } });
      setMessage({ ok: true, text: `Inscription confirmée à « ${item.title} » — elle est dans Mes formations !` });
      await load();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="flex-1">
      <PortalHeader />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-fg">Catalogue</h1>
            <p className="mt-1 text-sm text-muted">
              Toutes les formations publiées par l&apos;organisme — gratuites ou sur devis.
            </p>
          </div>
          <Link href="/mes-formations" className="btn-ghost">
            ← Mes formations
          </Link>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              message.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {items === null ? (
          <p className="mt-8 text-muted animate-pulse">Chargement du catalogue…</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map((f) => (
              <div key={f.id} className="card flex flex-col p-5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted">
                      {MODE_BADGES[f.mode]}
                    </span>
                    {f.isNew && (
                      <span className="chip bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                        ✦ Nouveau
                      </span>
                    )}
                  </div>
                  {f.price === null ? (
                    <span className="chip bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      Gratuit
                    </span>
                  ) : (
                    <span className="chip bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      {f.price.toLocaleString("fr-FR")} €
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-lg font-semibold text-fg">{f.title}</h3>
                {f.category && (
                  <p className="text-xs text-faint uppercase tracking-wide">{f.category}</p>
                )}
                <p className="mt-1 flex-1 text-sm text-muted line-clamp-2">{f.description}</p>
                <p className="mt-2 text-xs text-faint">
                  {f.lessonCount} leçon{f.lessonCount > 1 ? "s" : ""}
                </p>

                <div className="mt-4">
                  {f.enrolled ? (
                    <Link href={`/apprendre/${f.slug}`} className="btn-ghost w-full">
                      ✓ Suivie — ouvrir
                    </Link>
                  ) : f.price === null ? (
                    <button
                      onClick={() => enroll(f)}
                      disabled={pendingId === f.id}
                      className="btn-primary w-full"
                    >
                      {pendingId === f.id ? "Inscription…" : "S'inscrire gratuitement"}
                    </button>
                  ) : (
                    <button
                      disabled
                      title="Contactez l'organisme : un devis est nécessaire pour obtenir l'accès"
                      className="btn-ghost w-full cursor-not-allowed"
                    >
                      Sur devis — contactez-nous
                    </button>
                  )}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="card col-span-full border-dashed p-10 text-center">
                <p className="text-muted">Aucune formation publiée pour le moment.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
