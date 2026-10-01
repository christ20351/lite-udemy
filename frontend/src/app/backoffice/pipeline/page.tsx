"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Deal = {
  id: string;
  title: string;
  stage: keyof typeof STAGES;
  amount: number | null;
  notes: string | null;
  client: { id: string; name: string } | null;
  formation: { id: string; title: string } | null;
  owner: { name: string } | null;
};

const STAGES = {
  NEW: { label: "Contact", color: "#94a3b8" },
  QUALIFIED: { label: "Qualifié", color: "#0ea5e9" },
  QUOTE: { label: "Devis envoyé", color: "#f59e0b" },
  NEGOTIATION: { label: "Négociation", color: "#8b5cf6" },
  WON: { label: "Gagné", color: "#10b981" },
  LOST: { label: "Perdu", color: "#ef4444" },
} as const;

type Client = { id: string; name: string };
type Formation = { id: string; title: string };

const eur = (v: number) =>
  v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function PipelinePage() {
  const [kanban, setKanban] = useState<Record<string, Deal[]> | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    clientId: "",
    formationId: "",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const d = await api("/deals");
      setKanban(d.kanban);
      setTotals(d.totals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    load();
    api("/clients").then((d) => setClients(d.clients)).catch(() => {});
    api("/formations").then((d) => setFormations(d.formations)).catch(() => {});
  }, [load]);

  async function moveDeal(dealId: string, stage: string) {
    setKanban((k) => {
      if (!k) return k;
      const next: Record<string, Deal[]> = {};
      let moved: Deal | null = null;
      for (const [s, deals] of Object.entries(k)) {
        next[s] = deals.filter((d) => {
          if (d.id === dealId) {
            moved = { ...d, stage: stage as Deal["stage"] };
            return false;
          }
          return true;
        });
      }
      if (moved) next[stage].unshift(moved);
      return next;
    });
    try {
      await api(`/deals/${dealId}`, { method: "PATCH", body: { stage } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      await load();
    }
  }

  async function createDeal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/deals", {
        method: "POST",
        body: {
          title: form.title,
          amount: form.amount === "" ? null : Number(form.amount),
          clientId: form.clientId || null,
          formationId: form.formationId || null,
          notes: form.notes || null,
        },
      });
      setForm({ title: "", amount: "", clientId: "", formationId: "", notes: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function removeDeal(id: string) {
    try {
      await api(`/deals/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-fg">Pipeline commercial</h1>
          <p className="mt-1 text-sm text-muted">
            Glissez-déposez les opportunités d&apos;une étape à l&apos;autre.
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          + Nouvelle opportunité
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={createDeal} className="card mt-4 grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium">Intitulé *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex : ACME — renouvellement 2027"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Client</label>
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="input"
            >
              <option value="">— Prospect libre —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Formation visée</label>
            <select
              value={form.formationId}
              onChange={(e) => setForm({ ...form, formationId: e.target.value })}
              className="input"
            >
              <option value="">—</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Montant (€)</label>
            <input
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Ex : 8500"
              className="input"
            />
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Contexte, interlocuteur…"
              className="input"
            />
          </div>
          <div className="md:col-span-3">
            <button type="submit" className="btn-primary w-full md:w-auto">
              Créer l&apos;opportunité
            </button>
          </div>
        </form>
      )}

      {kanban === null ? (
        <p className="mt-8 text-muted animate-pulse">Chargement du pipeline…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {Object.entries(STAGES).map(([stage, meta]) => (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                if (dragId) moveDeal(dragId, stage);
                setDragId(null);
              }}
              className={`rounded-2xl border p-3 transition-colors ${
                dragOverStage === stage
                  ? "border-primary bg-primary/5"
                  : "border-line bg-surface-2/50"
              }`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  {meta.label}
                </p>
                <span className="text-xs font-semibold text-fg">{kanban[stage]?.length ?? 0}</span>
              </div>
              <p className="mb-3 px-1 text-xs font-medium text-faint">
                {eur(totals[stage] ?? 0)}
              </p>

              <div className="space-y-2">
                {(kanban[stage] ?? []).map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`card cursor-grab p-3 active:cursor-grabbing ${
                      dragId === d.id ? "opacity-40" : "hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-fg">{d.title}</p>
                      <button
                        onClick={() => removeDeal(d.id)}
                        title="Supprimer"
                        className="text-xs text-faint hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                    {d.client && (
                      <p className="mt-1 text-xs text-muted">🏢 {d.client.name}</p>
                    )}
                    {d.formation && (
                      <p className="truncate text-xs text-faint">🎓 {d.formation.title}</p>
                    )}
                    {d.amount !== null && (
                      <p className="mt-1.5 text-sm font-bold text-primary">{eur(d.amount)}</p>
                    )}
                    {d.notes && <p className="mt-1 line-clamp-2 text-xs text-faint">{d.notes}</p>}
                  </div>
                ))}
                {(kanban[stage] ?? []).length === 0 && (
                  <p className="rounded-lg border border-dashed border-line px-2 py-4 text-center text-xs text-faint">
                    Déposez ici
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
