"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Client = {
  id: string;
  name: string;
  type: "COMPANY" | "INDIVIDUAL";
  status: "LEAD" | "PROSPECT" | "CLIENT" | "INACTIVE";
  email: string | null;
  _count: { users: number; subscriptions: number };
};

const STATUS_LABELS: Record<Client["status"], string> = {
  LEAD: "Lead",
  PROSPECT: "Prospect",
  CLIENT: "Client",
  INACTIVE: "Inactif",
};

const STATUS_STYLES: Record<Client["status"], string> = {
  LEAD: "bg-surface-2 text-fg-soft",
  PROSPECT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  CLIENT: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  INACTIVE: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "COMPANY" as Client["type"],
    email: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    const data = await api(`/clients${q ? `?search=${encodeURIComponent(q)}` : ""}`);
    setClients(data.clients);
  }, []);

  useEffect(() => {
    load(search);
  }, [load, search]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/clients", {
        method: "POST",
        body: {
          name: form.name,
          type: form.type,
          status: "LEAD",
          email: form.email || null,
          phone: form.phone || null,
        },
      });
      setForm({ name: "", type: "COMPANY", email: "", phone: "" });
      setShowForm(false);
      load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted mt-1 text-sm">
            {clients.length} client{clients.length > 1 ? "s" : ""} dans le CRM.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
          >
            + Nouveau client
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={createClient}
          className="mt-4 bg-surface border border-line rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
        >
          {error && (
            <p className="md:col-span-4 text-sm text-red-600">{error}</p>
          )}
          <div>
            <label className="block text-xs font-medium mb-1">Nom *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Client["type"] })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="COMPANY">Entreprise</option>
              <option value="INDIVIDUAL">Particulier</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Téléphone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700"
            >
              Créer
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 bg-surface rounded-xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left">
            <tr>
              <th className="px-5 py-3 font-medium">Nom</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Statut</th>
              <th className="px-5 py-3 font-medium">Contacts</th>
              <th className="px-5 py-3 font-medium">Souscriptions</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-surface-2">
                <td className="px-5 py-3">
                  <Link
                    href={`/backoffice/clients/${c.id}`}
                    className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-faint">{c.email}</p>
                </td>
                <td className="px-5 py-3 text-fg-soft">
                  {c.type === "COMPANY" ? "Entreprise" : "Particulier"}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}
                  >
                    {STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-5 py-3 text-fg-soft">{c._count.users}</td>
                <td className="px-5 py-3 text-fg-soft">{c._count.subscriptions}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/backoffice/clients/${c.id}`}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Ouvrir →
                  </Link>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-faint">
                  Aucun client. Créez-en un pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
