"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "GESTIONNAIRE" | "FORMATEUR";
  createdAt: string;
  _count: { formationsTaught: number; sessionsTrained: number };
};

const ROLE_META: Record<string, { label: string; chip: string }> = {
  ADMIN: { label: "Admin", chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  GESTIONNAIRE: { label: "Gestionnaire", chip: "bg-primary-soft text-primary" },
  FORMATEUR: { label: "Formateur", chip: "bg-surface-2 text-muted" },
};

export default function EquipePage() {
  const { user: me } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "FORMATEUR" });

  const load = useCallback(async () => {
    try {
      const data = await api("/team");
      setMembers(data.members);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function flash(msg: string) {
    setNotice(msg);
    setError(null);
    setTimeout(() => setNotice(null), 2500);
  }

  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    setError(null);
    try {
      await fn();
      if (okMsg) flash(okMsg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await api("/team", { method: "POST", body: form });
      setForm({ name: "", email: "", password: "", role: "FORMATEUR" });
      setShowForm(false);
    }, "Compte créé");
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-fg">Équipe</h1>
          <p className="mt-1 text-sm text-muted">
            Comptes internes : admins, gestionnaires de formation et formateurs.
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          + Nouveau compte
        </button>
      </div>

      {notice && (
        <div className="mt-4 rounded-lg border border-line bg-primary-soft px-3 py-2 text-sm text-primary">
          {notice}
        </div>
      )}
      {error && (
        <div className="notice-box mt-4">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={create}
          className="card mt-4 grid grid-cols-1 gap-3 p-5 md:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-xs font-medium">Nom complet *</label>
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex : Karim Benali"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Email *</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ex : karim@monorganisme.fr"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Mot de passe provisoire *</label>
            <input
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Rôle *</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="input"
            >
              <option value="FORMATEUR">Formateur — construit les contenus de ses formations</option>
              <option value="GESTIONNAIRE">Gestionnaire — crée les formations, assigne, publie</option>
              <option value="ADMIN">Admin — tout le back-office + gestion de l&apos;équipe</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary w-full md:w-auto">
              Créer le compte
            </button>
          </div>
        </form>
      )}

      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Membre</th>
              <th className="px-5 py-3 font-medium">Rôle</th>
              <th className="px-5 py-3 font-medium">Activité</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((m) => {
              const meta = ROLE_META[m.role];
              const isMe = me?.id === m.id;
              return (
                <tr key={m.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <p className="font-medium text-fg">
                      {m.name}
                      {isMe && <span className="ml-2 text-xs text-faint">(vous)</span>}
                    </p>
                    <p className="text-xs text-faint">{m.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`chip ${meta.chip}`}>{meta.label}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">
                    {m.role === "FORMATEUR" ? (
                      <>
                        {m._count.formationsTaught} formation
                        {m._count.formationsTaught > 1 ? "s" : ""} ·{" "}
                        {m._count.sessionsTrained} session
                        {m._count.sessionsTrained > 1 ? "s" : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3 text-xs">
                      <select
                        value={m.role}
                        disabled={isMe}
                        onChange={(e) =>
                          run(
                            () =>
                              api(`/team/${m.id}`, {
                                method: "PATCH",
                                body: { role: e.target.value },
                              }),
                            "Rôle mis à jour"
                          )
                        }
                        className="rounded-lg border border-line bg-surface px-2 py-1 text-xs disabled:opacity-40"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="GESTIONNAIRE">Gestionnaire</option>
                        <option value="FORMATEUR">Formateur</option>
                      </select>
                      <button
                        disabled={isMe}
                        onClick={() => {
                          if (!confirm(`Supprimer le compte de ${m.name} ?`)) return;
                          run(() => api(`/team/${m.id}`, { method: "DELETE" }), "Compte supprimé");
                        }}
                        className="btn-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-faint">
                  Aucun membre d&apos;équipe.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
