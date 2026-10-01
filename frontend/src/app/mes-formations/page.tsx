"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CircleCheck,
  Globe,
  GraduationCap,
  Hand,
  Play,
  Shuffle,
  Sparkles,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import PortalHeader from "@/components/PortalHeader";
import GradientCover from "@/components/GradientCover";
import { initialsOf } from "@/components/cover";
import { api, API_URL } from "@/lib/api";
import { isEquipe, useAuth } from "@/lib/auth";

type MyFormation = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  mode: "ONLINE" | "ONSITE" | "HYBRID";
  thumbnailUrl: string | null;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  isNew?: boolean;
};

type Overview = {
  stats: { formations: number; totalLessons: number; completedLessons: number; percent: number };
  resume: {
    lessonId: string; lessonTitle: string; formationSlug: string; formationTitle: string;
  } | null;
  nextSession: {
    title: string; startAt: string; location: string | null; formationTitle: string;
  } | null;
};

const MODE_ICONS = { ONLINE: Globe, ONSITE: Building2, HYBRID: Shuffle } as const;

const MODE_NAMES = { ONLINE: "En ligne", ONSITE: "Présentiel", HYBRID: "Hybride" } as const;

export default function MesFormationsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted animate-pulse">Chargement…</p>
        </main>
      }
    >
      <MesFormationsContent />
    </Suspense>
  );
}

function MesFormationsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const completedSlug = searchParams.get("completed");
  const completedTitle = searchParams.get("title");
  const [bannerVisible, setBannerVisible] = useState(true);
  const [formations, setFormations] = useState<MyFormation[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [view, setView] = useState<"netflix" | "list">("netflix");

  useEffect(() => {
    if (!loading && (!user || isEquipe(user.role))) router.replace("/backoffice");
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role !== "APPRENANT") return;
    api("/me/formations").then((d) => setFormations(d.formations)).catch(() => setFormations([]));
    api("/me/overview").then((d) => setOverview(d)).catch(() => setOverview(null));
  }, [user]);

  if (loading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted animate-pulse">Chargement…</p>
      </main>
    );
  }

  // ── Données dérivées ───────────────────────────────────────────────
  const all = formations ?? [];
  const inProgress = all.filter((f) => f.percent > 0 && f.percent < 100);
  const featured =
    all.find((f) => f.percent > 0 && f.percent < 100) ??
    all.find((f) => f.isNew) ??
    all[0] ??
    null;
  const news = all.filter((f) => f.isNew);

  // Suggestions post-complétion : d'abord celles en cours, puis les non commencées
  const suggestions = completedSlug
    ? [
        ...inProgress.filter((f) => f.slug !== completedSlug),
        ...all.filter((f) => f.percent === 0 && f.slug !== completedSlug),
      ].slice(0, 6)
    : [];

  const heure = new Date().getHours();
  const salut = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
  const FeaturedModeIcon = featured ? MODE_ICONS[featured.mode] : Globe;

  // ── Vue liste (fallback classique) ─────────────────────────────────
  if (view === "list") {
    return (
      <main className="flex-1">
        <PortalHeader />
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-fg">Mes formations</h1>
            <button onClick={() => setView("netflix")} className="btn-ghost text-xs">
              <Sparkles className="h-4 w-4" />
              Vue Netflix
            </button>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {all.map((f) => (
              <div key={f.id} className="card flex p-4">
                <div className="relative flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xl font-bold text-white/90">
                  <div className="absolute inset-0">
                    <GradientCover title={f.title} showInitials={false} />
                  </div>
                  {f.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_URL}${f.thumbnailUrl}`}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <span className="relative z-10 drop-shadow">{initialsOf(f.title)}</span>
                </div>
                <div className="ml-4 flex min-w-0 flex-1 flex-col">
                  <p className="truncate font-semibold text-fg">{f.title}</p>
                  <p className="text-xs text-faint">
                    {f.completedLessons}/{f.totalLessons} leçons · {f.percent}%
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-primary" style={{ width: `${f.percent}%` }} />
                  </div>
                  <Link href={`/apprendre/${f.slug}`} className="mt-auto text-xs text-primary hover:underline">
                    {f.percent > 0 ? "Continuer →" : "Commencer →"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── Vue Netflix ────────────────────────────────────────────────────
  return (
    <main className="flex-1">
      <PortalHeader />

      {/* ── HERO : plein dégradé, la signature de la formation mise en avant ── */}
      {featured ? (
        <section className="relative min-h-[400px] overflow-hidden">
          <div className="absolute inset-0">
            <GradientCover title={featured.title} showInitials={false} />
          </div>
          {featured.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${API_URL}${featured.thumbnailUrl}`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {/* Voile sombre pour la lisibilité du texte */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(10,10,40,0.72) 0%, rgba(10,10,40,0.45) 55%, rgba(10,10,40,0.2) 100%)",
            }}
          />
          <div className="relative mx-auto flex max-w-6xl flex-col justify-end px-6 pb-16 pt-20">
            <div className="mb-4 flex items-center gap-2">
              <span className="chip bg-white/20 text-white backdrop-blur">
                <FeaturedModeIcon className="h-4 w-4" />
                {MODE_NAMES[featured.mode]}
              </span>
              {featured.isNew && (
                <span className="chip bg-white text-indigo-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Nouveau
                </span>
              )}
              {featured.percent > 0 && (
                <span className="chip bg-black/45 text-white backdrop-blur">
                  {featured.percent}% complété
                </span>
              )}
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight text-white drop-shadow-xl">
              {featured.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 line-clamp-2">
              {featured.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={`/apprendre/${featured.slug}`} className="btn-gradient !px-8 !py-3.5 !text-base">
                <Play className="h-5 w-5 fill-current" />
                {featured.percent >= 100
                  ? "Revoir la formation"
                  : featured.percent > 0
                    ? `Reprendre à ${featured.percent} %`
                    : "Commencer"}
              </Link>
              {overview?.resume && (
                <span className="text-sm text-white/80">
                  Dernière leçon vue : {overview.resume.lessonTitle}
                </span>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-5xl px-6 pt-10">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-fg">
            {salut}, {user.name.split(" ")[0]}
            <Hand className="h-5 w-5 text-primary" />
          </h1>
          <div className="card mt-4 border-dashed p-10 text-center">
            <p className="text-muted">
              Aucune formation ne vous a encore été attribuée. Explorez le catalogue !
            </p>
            <Link href="/catalogue" className="btn-gradient mt-4">
              Parcourir le catalogue
            </Link>
          </div>
        </section>
      )}

      {/* ── Bandeau infos ─────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto -mt-8 max-w-6xl px-6 pb-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card flex items-center gap-4 p-5">
            <span className="icon-tile">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <p className="gradient-text text-2xl font-black">{overview?.stats.percent ?? 0}%</p>
              <p className="text-xs text-faint">progression globale</p>
            </div>
          </div>
          <div className="card flex items-center gap-4 p-5">
            <span className="icon-tile">
              <CircleCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-black text-fg">
                {overview?.stats.completedLessons ?? 0}
                <span className="text-base font-bold text-muted">
                  /{overview?.stats.totalLessons ?? 0}
                </span>
              </p>
              <p className="text-xs text-faint">leçons terminées</p>
            </div>
          </div>
          {overview?.nextSession ? (
            <Link
              href="/mes-sessions"
              className="card flex items-center gap-4 p-5 transition-all hover:-translate-y-px hover:shadow-lg"
            >
              <span className="icon-tile">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-fg">
                  {overview.nextSession.title}
                </p>
                <p className="text-xs text-faint">
                  {new Date(overview.nextSession.startAt).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "short",
                  })}{" "}
                  · voir mes sessions
                </p>
              </div>
            </Link>
          ) : (
            <div className="card hidden sm:flex sm:items-center sm:gap-4 p-5 opacity-60">
              <span className="icon-tile">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-fg">Aucune session</p>
                <p className="text-xs text-faint">à venir</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bannière post-complétion ───────────────────────────────── */}
      {completedSlug && bannerVisible && (
        <div className="mx-auto max-w-6xl px-6 pt-6">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <Trophy className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="flex-1 text-sm font-semibold text-fg">
              Félicitations, vous avez terminé
              {completedTitle ? (
                <> « {completedTitle} » !</>
              ) : (
                " une formation !"
              )}{" "}
              Voici des suggestions pour continuer votre apprentissage.
            </p>
            <button
              onClick={() => {
                setBannerVisible(false);
                router.replace("/mes-formations");
              }}
              aria-label="Fermer"
              className="text-faint transition-colors hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Rangées Netflix ───────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        {completedSlug && suggestions.length > 0 && (
          <Row
            title={
              <>
                <GraduationCap className="h-5 w-5 text-primary" />
                Suggestions pour continuer
              </>
            }
            items={suggestions}
            showProgress
          />
        )}
        <Row
          title={
            <>
              <Play className="h-5 w-5 text-primary" />
              Continuer
            </>
          }
          items={inProgress}
          showProgress
        />
        {news.length > 0 && (
          <Row
            title={
              <>
                <Sparkles className="h-5 w-5 text-primary" />
                Nouveautés
              </>
            }
            items={news}
          />
        )}
        <Row title="Toutes vos formations" items={all} />

        <div className="text-center">
          <button onClick={() => setView("list")} className="text-xs text-faint hover:text-primary hover:underline">
            Passer en vue liste
          </button>
        </div>
      </div>
    </main>
  );
}

function Row({
  title,
  items,
  showProgress = false,
}: {
  title: ReactNode;
  items: MyFormation[];
  showProgress?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2.5 text-xl font-extrabold text-fg">{title}</h2>
      <div className="scrollbar-none -mx-6 flex gap-5 overflow-x-auto px-6 pb-2 [scroll-snap-type:x_mandatory]">
        {items.map((f) => {
          const ModeIcon = MODE_ICONS[f.mode];
          return (
          <Link
            key={f.id}
            href={`/apprendre/${f.slug}`}
            className="group w-72 shrink-0 [scroll-snap-align:start]"
          >
            <div className="relative flex h-44 items-end overflow-hidden rounded-2xl shadow-lg transition-all duration-200 group-hover:scale-[1.04] group-hover:shadow-xl">
              {/* Couverture : remplit tout le cadre */}
              <div className="absolute inset-0">
                <GradientCover title={f.title} />
              </div>
              {f.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API_URL}${f.thumbnailUrl}`}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)",
                }}
              />
              {f.isNew && (
                <span className="absolute left-3 top-3 chip bg-white text-indigo-700 shadow">
                  <Sparkles className="h-3.5 w-3.5" />
                  Nouveau
                </span>
              )}
              <p className="relative z-10 flex items-center gap-2 px-4 pb-3 text-base font-extrabold text-white drop-shadow-lg">
                <ModeIcon className="h-4 w-4 shrink-0" />
                {f.title}
              </p>
              {showProgress && (
                <div className="absolute inset-x-4 bottom-1.5 h-1.5 rounded-full bg-black/45">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${f.percent}%`, background: "linear-gradient(90deg, #a5b4fc, #f0abfc)" }}
                  />
                </div>
              )}
            </div>
            <p className="mt-2.5 truncate text-sm font-semibold text-fg">
              {f.title}
            </p>
            <p className="text-xs text-faint">
              {f.completedLessons}/{f.totalLessons} leçons · {f.percent}%
            </p>
          </Link>
          );
        })}
      </div>
    </section>
  );
}
