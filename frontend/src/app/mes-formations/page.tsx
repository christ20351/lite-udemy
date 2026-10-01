"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PortalHeader from "@/components/PortalHeader";
import { coverGradient, initialsOf } from "@/components/cover";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type MyFormation = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  mode: "ONLINE" | "ONSITE" | "HYBRID";
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

const MODE_LABEL = { ONLINE: "🌐", ONSITE: "🏫", HYBRID: "🔀" } as const;

export default function MesFormationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [formations, setFormations] = useState<MyFormation[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [view, setView] = useState<"netflix" | "list">("netflix");

  useEffect(() => {
    if (!loading && (!user || user.role !== "CONTACT")) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role !== "CONTACT") return;
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
  const finished = all.filter((f) => f.percent === 100);

  const heure = new Date().getHours();
  const salut = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";

  // ── Vue liste (fallback classique) ─────────────────────────────────
  if (view === "list") {
    return (
      <main className="flex-1">
        <PortalHeader />
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-fg">Mes formations</h1>
            <button onClick={() => setView("netflix")} className="btn-ghost text-xs">
              ✨ Vue Netflix
            </button>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {all.map((f) => (
              <div key={f.id} className="card flex p-4">
                <div
                  className={`flex h-20 w-32 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xl font-bold text-white/90 ${coverGradient(f.title)}`}
                >
                  {initialsOf(f.title)}
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

      {/* ── HERO ──────────────────────────────────────────────────── */}
      {featured ? (
        <section className="relative min-h-[380px] overflow-hidden">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${coverGradient(featured.title)}`}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 75% 20%, rgba(255,255,255,0.14), transparent 45%), linear-gradient(to top, var(--bg) 4%, transparent 55%)",
            }}
          />
          <div className="relative mx-auto flex max-w-5xl flex-col justify-end px-6 pb-10 pt-24">
            <div className="mb-3 flex items-center gap-2">
              <span className="chip bg-white/15 text-white backdrop-blur">
                {MODE_LABEL[featured.mode]} {featured.mode === "ONLINE" ? "En ligne" : featured.mode === "ONSITE" ? "Présentiel" : "Hybride"}
              </span>
              {featured.isNew && (
                <span className="chip bg-indigo-500 text-white">✦ Nouveau</span>
              )}
              {featured.percent > 0 && (
                <span className="chip bg-black/40 text-white backdrop-blur">
                  {featured.percent}% complété
                </span>
              )}
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-tight text-white drop-shadow-lg">
              {featured.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/80 line-clamp-2">
              {featured.description}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={`/apprendre/${featured.slug}`}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-lg transition-transform hover:scale-105"
              >
                ▶{" "}
                {featured.percent >= 100
                  ? "Revoir la formation"
                  : featured.percent > 0
                    ? `Reprendre à ${featured.percent} %`
                    : "Commencer"}
              </Link>
              {overview?.resume && (
                <span className="text-xs text-white/70">
                  Dernière leçon vue : {overview.resume.lessonTitle}
                </span>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-5xl px-6 pt-10">
          <h1 className="text-2xl font-bold text-fg">
            {salut}, {user.name.split(" ")[0]} 👋
          </h1>
          <div className="card mt-4 border-dashed p-10 text-center">
            <p className="text-muted">
              Aucune formation ne vous a encore été attribuée. Explorez le catalogue !
            </p>
            <Link href="/catalogue" className="btn-primary mt-4 inline-block">
              Parcourir le catalogue
            </Link>
          </div>
        </section>
      )}

      {/* ── Bandeau infos ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="-mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card flex items-center gap-3 px-4 py-3">
            <span className="text-2xl">📈</span>
            <div>
              <p className="text-sm font-bold text-fg">{overview?.stats.percent ?? 0}%</p>
              <p className="text-xs text-faint">progression globale</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 px-4 py-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-bold text-fg">
                {overview?.stats.completedLessons ?? 0}/{overview?.stats.totalLessons ?? 0}
              </p>
              <p className="text-xs text-faint">leçons terminées</p>
            </div>
          </div>
          {overview?.nextSession && (
            <Link href="/mes-sessions" className="card flex items-center gap-3 px-4 py-3 transition-colors hover:border-primary/40">
              <span className="text-2xl">📅</span>
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
          )}
        </div>
      </div>

      {/* ── Rangées Netflix ───────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <Row title="▶ Continuer" items={inProgress} showProgress />
        {news.length > 0 && <Row title="✦ Nouveautés" items={news} />}
        <Row title="Toutes vos formations" items={all} />

        {view === "netflix" && (
          <div className="text-center">
            <button onClick={() => setView("list")} className="text-xs text-faint hover:text-primary hover:underline">
              Passer en vue liste
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({
  title,
  items,
  showProgress = false,
}: {
  title: string;
  items: MyFormation[];
  showProgress?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-fg">{title}</h2>
      <div className="scrollbar-none -mx-6 flex gap-4 overflow-x-auto px-6 pb-2 [scroll-snap-type:x_mandatory]">
        {items.map((f) => (
          <Link
            key={f.id}
            href={`/apprendre/${f.slug}`}
            className="group w-64 shrink-0 [scroll-snap-align:start]"
          >
            <div
              className={`relative flex h-36 items-end overflow-hidden rounded-xl bg-gradient-to-br p-3 shadow-lg transition-transform duration-200 group-hover:scale-[1.04] ${coverGradient(f.title)}`}
            >
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse at 70% 15%, rgba(255,255,255,0.18), transparent 50%)",
                }}
              />
              <span className="absolute right-3 top-3 text-3xl font-black text-white/15">
                {initialsOf(f.title)}
              </span>
              {f.isNew && (
                <span className="absolute left-3 top-3 chip bg-indigo-500 text-white">
                  ✦ Nouveau
                </span>
              )}
              <p className="relative z-10 text-sm font-bold text-white drop-shadow">
                {MODE_LABEL[f.mode]} {f.title}
              </p>
              {showProgress && (
                <div className="absolute inset-x-3 bottom-1.5 h-1 rounded-full bg-black/40">
                  <div className="h-full rounded-full bg-white" style={{ width: `${f.percent}%` }} />
                </div>
              )}
            </div>
            <p className="mt-2 truncate text-sm font-medium text-fg-soft">
              {f.title}
            </p>
            <p className="text-xs text-faint">
              {f.completedLessons}/{f.totalLessons} leçons · {f.percent}%
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
