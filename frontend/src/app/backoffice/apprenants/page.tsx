"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

type Learner = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  formations: Array<{ id: string; title: string }>;
  completedLessons: number;
  startedLessons: number;
};

export default function ApprenantsPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      const data = await api(
        `/learners${q ? `?search=${encodeURIComponent(q)}` : ""}`
      );
      setLearners(data.learners);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    load(search);
  }, [load, search]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-fg">Apprenants</h1>
          <p className="mt-1 text-sm text-muted">
            {learners.length} apprenant{learners.length > 1 ? "s" : ""} inscrit
            {learners.length > 1 ? "s" : ""} sur la plateforme.
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un apprenant…"
          className="input max-w-xs"
        />
      </div>

      {error && (
        <div className="notice-box mt-4">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Apprenant</th>
              <th className="px-5 py-3 font-medium">Formations suivies</th>
              <th className="px-5 py-3 font-medium">Leçons terminées</th>
              <th className="px-5 py-3 font-medium">Inscrit le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {learners.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-surface-2">
                <td className="px-5 py-3">
                  <Link
                    href={`/backoffice/apprenants/${l.id}`}
                    className="font-medium text-fg hover:text-primary hover:underline"
                  >
                    {l.name}
                  </Link>
                  <p className="text-xs text-faint">{l.email}</p>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {l.formations.map((f) => (
                      <span
                        key={f.id}
                        className="chip bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      >
                        {f.title}
                      </span>
                    ))}
                    {l.formations.length === 0 && (
                      <span className="text-xs text-faint">Aucune inscription</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 font-semibold text-fg">
                  {l.completedLessons}
                  <span className="ml-1 text-xs font-normal text-faint">
                    ({l.startedLessons} entamées)
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-muted">
                  {new Date(l.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
            {learners.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-faint">
                  Aucun apprenant trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
