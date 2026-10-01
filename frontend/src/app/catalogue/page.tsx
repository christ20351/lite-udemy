"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PortalHeader from "@/components/PortalHeader";
import GradientCover from "@/components/GradientCover";
import {
  BookOpen,
  Building2,
  Check,
  CircleAlert,
  CircleCheck,
  Globe,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { api, API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type CatalogueItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  mode: "ONLINE" | "ONSITE" | "HYBRID";
  price: number | null;
  thumbnailUrl: string | null;
  isNew: boolean;
  lessonCount: number;
  enrolled: boolean;
};

const MODE_LABELS = {
  ONLINE: "En ligne",
  ONSITE: "Présentiel",
  HYBRID: "Hybride",
} as const;

const MODE_ICONS = {
  ONLINE: Globe,
  ONSITE: Building2,
  HYBRID: Shuffle,
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

      {/* Bandeau dégradé */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 12% 20%, rgba(99,102,241,0.35), transparent 45%), radial-gradient(circle at 88% 30%, rgba(236,72,153,0.3), transparent 45%), linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.1))",
          }}
        />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between flex-wrap gap-3 px-6 py-8">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-fg">
              <span className="icon-tile">
                <BookOpen className="h-6 w-6" />
              </span>
              Catalogue
            </h1>
            <p className="mt-2 text-sm text-muted">
              Toutes les formations publiées — inscrivez-vous en un clic aux gratuites.
            </p>
          </div>
          <Link href="/mes-formations" className="btn-ghost">
            ← Mes formations
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-10">
        {message && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
              message.ok
                ? "border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                : "notice-box"
            }`}
          >
            {message.ok ? (
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {items === null ? (
          <p className="mt-8 text-muted animate-pulse">Chargement du catalogue…</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((f) => {
              const ModeIcon = MODE_ICONS[f.mode];
              return (
                <div
                  key={f.id}
                  className="group card flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* Couverture dégradée */}
                  <div className="relative h-40">
                    <GradientCover title={f.title} />
                    {f.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${API_URL}${f.thumbnailUrl}`}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      {f.isNew && (
                        <span className="chip bg-white/90 text-indigo-700 backdrop-blur">
                          <Sparkles className="h-3.5 w-3.5" />
                          Nouveau
                        </span>
                      )}
                      {f.price === null && (
                        <span className="chip bg-emerald-500 font-bold text-white shadow">
                          Gratuit
                        </span>
                      )}
                    </div>
                    <span className="absolute right-3 top-3 chip bg-black/45 text-white backdrop-blur">
                      <ModeIcon className="h-3.5 w-3.5" />
                      {MODE_LABELS[f.mode]}
                    </span>
                    <span className="absolute bottom-3 left-3 text-lg font-black leading-tight text-white drop-shadow-lg">
                      {f.category ?? "Général"}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold leading-snug text-fg">{f.title}</h3>
                      {f.price !== null && (
                        <span className="shrink-0 text-lg font-black gradient-text">
                          {Math.round(f.price).toLocaleString("fr-FR")} FCFA
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted line-clamp-2">
                      {f.description}
                    </p>
                    <p className="mt-2 text-xs text-faint">
                      {f.lessonCount} leçon{f.lessonCount > 1 ? "s" : ""}
                    </p>

                    <div className="mt-4">
                      {f.enrolled ? (
                        <Link href={`/apprendre/${f.slug}`} className="btn-ghost w-full">
                          <Check className="h-4 w-4 text-emerald-500" />
                          Suivie — ouvrir
                        </Link>
                      ) : f.price === null ? (
                        <button
                          onClick={() => enroll(f)}
                          disabled={pendingId === f.id}
                          className="btn-gradient w-full"
                        >
                          {pendingId === f.id ? "Inscription…" : "S'inscrire gratuitement"}
                        </button>
                      ) : (
                        <button
                          disabled
                          title="Contactez l'organisme : l'inscription se fait auprès de l'équipe"
                          className="btn-ghost w-full cursor-not-allowed"
                        >
                          Sur devis — contactez-nous
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
