"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PortalHeader from "@/components/PortalHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type MySession = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  attended: boolean;
  formationTitle: string;
  trainer: string | null;
};

export default function MesSessionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<MySession[] | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "CONTACT")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === "CONTACT") {
      api("/me/sessions")
        .then((d) => setSessions(d.sessions))
        .catch(() => setSessions([]));
    }
  }, [user]);

  const upcoming = (sessions ?? []).filter(
    (s) => new Date(s.endAt).getTime() > Date.now()
  );
  const past = (sessions ?? []).filter(
    (s) => new Date(s.endAt).getTime() <= Date.now()
  );

  return (
    <main className="flex-1">
      <PortalHeader />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold">Mes sessions présentielles</h1>

        {sessions === null ? (
          <p className="text-muted mt-6 animate-pulse">Chargement…</p>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mt-6">
              À venir
            </h2>
            <div className="mt-3 space-y-2">
              {upcoming.map((s) => (
                <div
                  key={s.id}
                  className="bg-surface border border-line rounded-xl p-4 flex items-start justify-between gap-4 flex-wrap"
                >
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-faint mt-0.5">
                      {s.formationTitle} ·{" "}
                      {new Date(s.startAt).toLocaleString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {s.location ? ` · 📍 ${s.location}` : ""}
                      {s.trainer ? ` · ${s.trainer}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full">
                    Inscrit ✓
                  </span>
                </div>
              ))}
              {upcoming.length === 0 && (
                <p className="text-sm text-faint">
                  Aucune session à venir. Elles apparaîtront ici quand votre
                  organisme vous inscrira.
                </p>
              )}
            </div>

            {past.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mt-8">
                  Passées
                </h2>
                <div className="mt-3 space-y-2">
                  {past.map((s) => (
                    <div
                      key={s.id}
                      className="bg-surface-2 border border-line rounded-xl p-4"
                    >
                      <p className="font-medium text-sm text-fg-soft">{s.title}</p>
                      <p className="text-xs text-faint mt-0.5">
                        {new Date(s.startAt).toLocaleDateString("fr-FR")} ·{" "}
                        {s.attended ? "✓ Présence confirmée" : "Absence enregistrée"}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
