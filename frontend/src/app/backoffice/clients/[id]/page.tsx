"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type Access = { id: string; formation: { id: string; title: string } };
type Contact = {
  id: string;
  name: string;
  email: string;
  accesses: Access[];
};
type Subscription = {
  id: string;
  seats: number;
  status: "ACTIVE" | "EXPIRED";
  startedAt: string;
  formation: { id: string; title: string; slug: string; mode: string; status: string };
};
type Interaction = {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  author: { name: string } | null;
};
type ClientDetail = {
  id: string;
  name: string;
  type: "COMPANY" | "INDIVIDUAL";
  status: "LEAD" | "PROSPECT" | "CLIENT" | "INACTIVE";
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  users: Contact[];
  subscriptions: Subscription[];
  interactions: Interaction[];
};
type Formation = { id: string; title: string };

const TYPE_LABELS = { COMPANY: "Entreprise", INDIVIDUAL: "Particulier" } as const;
const STATUS_LABELS = {
  LEAD: "Lead",
  PROSPECT: "Prospect",
  CLIENT: "Client",
  INACTIVE: "Inactif",
} as const;
const INTERACTION_LABELS = {
  CALL: "📞 Appel",
  EMAIL: "✉️ Email",
  MEETING: "🤝 RDV",
  NOTE: "📝 Note",
} as const;

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // formulaires
  const [newContact, setNewContact] = useState({ name: "", email: "", password: "" });
  const [subFormationId, setSubFormationId] = useState("");
  const [subSeats, setSubSeats] = useState(1);
  const [grantChoice, setGrantChoice] = useState<Record<string, string>>({});
  const [interaction, setInteraction] = useState({ type: "CALL", content: "" });

  const load = useCallback(async () => {
    try {
      const data = await api(`/clients/${id}`);
      setClient(data.client);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }, [id]);

  useEffect(() => {
    load();
    api("/formations").then((d) => setFormations(d.formations)).catch(() => {});
  }, [load]);

  function flash(msg: string) {
    setNotice(msg);
    setError(null);
    setTimeout(() => setNotice(null), 3000);
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

  if (!client) {
    return (
      <div className="p-8">
        <p className="text-muted">{error ?? "Chargement…"}</p>
      </div>
    );
  }

  const activeSubs = client.subscriptions.filter((s) => s.status === "ACTIVE");

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/backoffice/clients" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
        ← Tous les clients
      </Link>

      <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-muted text-sm mt-1">
            {TYPE_LABELS[client.type]}
            {client.email ? ` · ${client.email}` : ""}
            {client.phone ? ` · ${client.phone}` : ""}
          </p>
        </div>
        <select
          value={client.status}
          onChange={(e) =>
            run(
              () => api(`/clients/${client.id}`, { method: "PATCH", body: { status: e.target.value } }),
              "Statut mis à jour"
            )
          }
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm bg-surface"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {notice && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm px-3 py-2">
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Contacts apprenants ─────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Contacts apprenants ({client.users.length})
        </h2>
        <div className="mt-3 space-y-3">
          {client.users.map((u) => (
            <div
              key={u.id}
              className="bg-surface border border-line rounded-xl p-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-faint">{u.email}</p>
                </div>
                <p className="text-xs text-faint">
                  Accès portail : email + mot de passe communiqué
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {u.accesses.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-1"
                  >
                    {a.formation.title}
                    <button
                      title="Révoquer l'accès"
                      onClick={() =>
                        run(() => api(`/access/${a.id}`, { method: "DELETE" }), "Accès révoqué")
                      }
                      className="text-emerald-800 hover:text-red-600 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {u.accesses.length === 0 && (
                  <span className="text-xs text-faint">Aucun accès attribué</span>
                )}
              </div>

              {activeSubs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <select
                    value={grantChoice[u.id] ?? ""}
                    onChange={(e) =>
                      setGrantChoice({ ...grantChoice, [u.id]: e.target.value })
                    }
                    className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
                  >
                    <option value="">Attribuer un accès…</option>
                    {activeSubs
                      .filter(
                        (s) => !u.accesses.some((a) => a.formation.id === s.formation.id)
                      )
                      .map((s) => (
                        <option key={s.id} value={s.formation.id}>
                          {s.formation.title}
                        </option>
                      ))}
                  </select>
                  <button
                    disabled={!grantChoice[u.id]}
                    onClick={() =>
                      run(
                        () =>
                          api("/access", {
                            method: "POST",
                            body: { userId: u.id, formationId: grantChoice[u.id] },
                          }),
                        "Accès attribué"
                      )
                    }
                    className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                  >
                    Donner accès
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api(`/clients/${client.id}/contacts`, {
                method: "POST",
                body: newContact,
              });
              setNewContact({ name: "", email: "", password: "" });
            }, "Contact créé — communiquez-lui ses identifiants");
          }}
          className="mt-3 bg-surface-2 border border-line rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Nom *</label>
            <input
              required
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email (login) *</label>
            <input
              required
              type="email"
              value={newContact.email}
              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Mot de passe *</label>
            <input
              required
              minLength={6}
              value={newContact.password}
              onChange={(e) => setNewContact({ ...newContact, password: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary-strong"
          >
            + Ajouter le contact
          </button>
        </form>
      </section>

      {/* ── Souscriptions ───────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Souscriptions ({client.subscriptions.length})
        </h2>
        <div className="mt-3 space-y-2">
          {client.subscriptions.map((s) => (
            <div
              key={s.id}
              className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between flex-wrap gap-3"
            >
              <div>
                <p className="font-medium">{s.formation.title}</p>
                <p className="text-xs text-faint">
                  {s.seats} place{s.seats > 1 ? "s" : ""} · souscrite le{" "}
                  {new Date(s.startedAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    s.status === "ACTIVE"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/15 text-red-600 dark:text-red-400"
                  }`}
                >
                  {s.status === "ACTIVE" ? "Active" : "Expirée"}
                </span>
                <button
                  onClick={() =>
                    run(
                      () =>
                        api(`/subscriptions/${s.id}`, {
                          method: "PATCH",
                          body: { status: s.status === "ACTIVE" ? "EXPIRED" : "ACTIVE" },
                        }),
                      "Souscription mise à jour"
                    )
                  }
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {s.status === "ACTIVE" ? "Résilier" : "Réactiver"}
                </button>
              </div>
            </div>
          ))}
          {client.subscriptions.length === 0 && (
            <p className="text-sm text-faint">Aucune souscription.</p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/subscriptions", {
                method: "POST",
                body: { clientId: client.id, formationId: subFormationId, seats: Number(subSeats) },
              });
              setSubFormationId("");
              setSubSeats(1);
            }, "Souscription créée");
          }}
          className="mt-3 bg-surface-2 border border-line rounded-xl p-4 flex flex-wrap gap-3 items-end"
        >
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium mb-1">Formation *</label>
            <select
              required
              value={subFormationId}
              onChange={(e) => setSubFormationId(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm bg-surface"
            >
              <option value="">Choisir une formation…</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium mb-1">Places</label>
            <input
              type="number"
              min={1}
              value={subSeats}
              onChange={(e) => setSubSeats(Number(e.target.value))}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary-strong"
          >
            + Souscrire
          </button>
        </form>
      </section>

      {/* ── Historique / interactions ───────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Historique ({client.interactions.length})
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api(`/clients/${client.id}/interactions`, {
                method: "POST",
                body: interaction,
              });
              setInteraction({ type: "CALL", content: "" });
            }, "Interaction enregistrée");
          }}
          className="mt-3 bg-surface-2 border border-line rounded-xl p-4 flex flex-wrap gap-3 items-end"
        >
          <select
            value={interaction.type}
            onChange={(e) => setInteraction({ ...interaction, type: e.target.value })}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm bg-surface"
          >
            {Object.entries(INTERACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Compte-rendu…"
            value={interaction.content}
            onChange={(e) => setInteraction({ ...interaction, content: e.target.value })}
            className="flex-1 min-w-48 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary-strong"
          >
            + Journaliser
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {client.interactions.map((i) => (
            <div
              key={i.id}
              className="bg-surface border border-line rounded-xl p-4 flex gap-4"
            >
              <span className="text-xs text-faint shrink-0 w-32">
                {new Date(i.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div>
                <p className="text-xs font-medium text-muted">
                  {INTERACTION_LABELS[i.type as keyof typeof INTERACTION_LABELS] ?? i.type}
                  {i.author ? ` · ${i.author.name}` : ""}
                </p>
                <p className="text-sm mt-0.5">{i.content}</p>
              </div>
            </div>
          ))}
          {client.interactions.length === 0 && (
            <p className="text-sm text-faint">Aucune interaction enregistrée.</p>
          )}
        </div>
      </section>
    </div>
  );
}
