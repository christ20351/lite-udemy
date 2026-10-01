"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Contact = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  client: { id: string; name: string; status: string } | null;
  accesses: Array<{ formation: { title: string } }>;
  _count: { progresses: number };
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      const data = await api(
        `/clients/contacts/all${q ? `?search=${encodeURIComponent(q)}` : ""}`
      );
      setContacts(data.contacts);
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
          <h1 className="text-2xl font-bold text-fg">Contacts apprenants</h1>
          <p className="mt-1 text-sm text-muted">
            {contacts.length} apprenant{contacts.length > 1 ? "s" : ""} sur
            l&apos;ensemble du portefeuille.
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
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Apprenant</th>
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-5 py-3 font-medium">Formations accessibles</th>
              <th className="px-5 py-3 font-medium">Leçons terminées</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {contacts.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-surface-2">
                <td className="px-5 py-3">
                  <p className="font-medium text-fg">{c.name}</p>
                  <p className="text-xs text-faint">{c.email}</p>
                </td>
                <td className="px-5 py-3">
                  {c.client ? (
                    <Link
                      href={`/backoffice/clients/${c.client.id}`}
                      className="text-primary hover:underline"
                    >
                      {c.client.name}
                    </Link>
                  ) : (
                    <span className="chip bg-surface-2 text-muted">Compte libre</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {c.accesses.map((a) => (
                      <span
                        key={a.formation.title}
                        className="chip bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      >
                        {a.formation.title}
                      </span>
                    ))}
                    {c.accesses.length === 0 && (
                      <span className="text-xs text-faint">Aucun accès</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 font-semibold text-fg">
                  {c._count.progresses}
                </td>
              </tr>
            ))}
            {contacts.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-faint">
                  Aucun contact trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
