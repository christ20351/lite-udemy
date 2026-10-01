"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Participant = {
  id: string;
  userId: string;
  attended: boolean;
  user: { id: string; name: string; email: string };
};
type SessionItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  capacity: number;
  modality: "PRESENTIEL" | "ONLINE";
  meetingUrl: string | null;
  formation: { id: string; title: string };
  trainer: { id: string; name: string } | null;
  participants: Participant[];
};
type Formation = { id: string; title: string };
type AccessItem = {
  id: string;
  user: { id: string; name: string; email: string; client: { name: string } | null };
};

function fmt(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, AccessItem[]>>({});
  const [form, setForm] = useState({
    formationId: "",
    title: "",
    startAt: "",
    endAt: "",
    location: "",
    capacity: 10,
    modality: "PRESENTIEL" as "PRESENTIEL" | "ONLINE",
    meetingUrl: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, f] = await Promise.all([api("/sessions"), api("/formations")]);
    setSessions(s.sessions);
    setFormations(f.formations);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function loadAccess(formationId: string) {
    if (!formationId || accessMap[formationId]) return;
    const data = await api(`/formations/${formationId}/accesses`);
    setAccessMap((m) => ({ ...m, [formationId]: data.accesses }));
  }

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

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold">Sessions présentielles</h1>
      <p className="text-muted mt-1 text-sm">
        Planifiez les sessions en salle et gérez les participants.
      </p>

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

      {/* ── Création ────────────────────────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/sessions", {
              method: "POST",
              body: {
                formationId: form.formationId,
                title: form.title,
                startAt: new Date(form.startAt).toISOString(),
                endAt: new Date(form.endAt).toISOString(),
                location: form.modality === "PRESENTIEL" ? form.location || null : null,
                capacity: Number(form.capacity),
                modality: form.modality,
                meetingUrl: form.modality === "ONLINE" ? form.meetingUrl || null : null,
              },
            });
            setForm({ formationId: "", title: "", startAt: "", endAt: "", location: "", capacity: 10, modality: "PRESENTIEL", meetingUrl: "" });
          }, "Session créée");
        }}
        className="mt-6 bg-surface border border-line rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1">Intitulé *</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex : Journée intensive Python - Paris"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Formation *</label>
          <select
            required
            value={form.formationId}
            onChange={(e) => setForm({ ...form, formationId: e.target.value })}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">Choisir…</option>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Début *</label>
          <input
            required
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Fin *</label>
          <input
            required
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => setForm({ ...form, endAt: e.target.value })}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Capacité</label>
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Modalité</label>
          <select
            value={form.modality}
            onChange={(e) => setForm({ ...form, modality: e.target.value as "PRESENTIEL" | "ONLINE" })}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="PRESENTIEL">🏫 Présentiel</option>
            <option value="ONLINE">🌐 En ligne</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1">
            {form.modality === "ONLINE" ? "Lien visio" : "Lieu"}
          </label>
          {form.modality === "ONLINE" ? (
            <input
              value={form.meetingUrl}
              onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
              placeholder="https://meet.exemple.fr/…"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          ) : (
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Adresse, salle…"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          )}
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
          >
            + Créer la session
          </button>
        </div>
      </form>

      {/* ── Liste ───────────────────────────────────────────────────── */}
      <div className="mt-8 space-y-4">
        {sessions.map((s) => (
          <div key={s.id} className="bg-surface border border-line rounded-xl p-5">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-xs text-faint mt-0.5">
                  {s.formation.title} · {fmt(s.startAt)} → {fmt(s.endAt)}
                  {s.location ? ` · ${s.location}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted">
                  {s.participants.length}/{s.capacity} inscrits
                </span>
                <button
                  onClick={() => run(() => api(`/sessions/${s.id}`, { method: "DELETE" }), "Session supprimée")}
                  className="text-xs text-red-500 dark:text-red-400 hover:underline"
                >
                  Supprimer
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {s.participants.map((p) => (
                <span
                  key={p.id}
                  className={`inline-flex items-center gap-1.5 rounded-full text-xs px-2.5 py-1 ${
                    p.attended
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-surface-2 text-fg-soft"
                  }`}
                >
                  {p.user.name}
                  <button
                    title={p.attended ? "Marquer absent" : "Marquer présent"}
                    onClick={() =>
                      run(
                        () =>
                          api(`/sessions/${s.id}/participants/${p.userId}`, {
                            method: "PATCH",
                            body: { attended: !p.attended },
                          }),
                        "Présence mise à jour"
                      )
                    }
                    className="font-bold opacity-60 hover:opacity-100"
                  >
                    {p.attended ? "✓" : "○"}
                  </button>
                  <button
                    title="Désinscrire"
                    onClick={() =>
                      run(
                        () => api(`/sessions/${s.id}/participants/${p.userId}`, { method: "DELETE" }),
                        "Participant retiré"
                      )
                    }
                    className="font-bold opacity-60 hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              {s.participants.length === 0 && (
                <span className="text-xs text-faint">Aucun participant</span>
              )}
            </div>

            <ParticipantPicker
              session={s}
              accessMap={accessMap}
              onLoadAccess={loadAccess}
              onInscribe={(userId) =>
                run(
                  () =>
                    api(`/sessions/${s.id}/participants`, {
                      method: "POST",
                      body: { userIds: [userId] },
                    }),
                  "Participant inscrit"
                )
              }
            />
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-sm text-faint">Aucune session planifiée.</p>
        )}
      </div>
    </div>
  );
}

function ParticipantPicker({
  session,
  accessMap,
  onLoadAccess,
  onInscribe,
}: {
  session: SessionItem;
  accessMap: Record<string, AccessItem[]>;
  onLoadAccess: (formationId: string) => void;
  onInscribe: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");

  useEffect(() => {
    if (open) onLoadAccess(session.formation.id);
  }, [open, session.formation.id, onLoadAccess]);

  const contacts = accessMap[session.formation.id] ?? [];
  const eligible = contacts.filter(
    (a) => !session.participants.some((p) => p.userId === a.user.id)
  );

  return (
    <div className="mt-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          + Inscrire un participant (parmi les accès à la formation)
        </button>
      ) : (
        <div className="flex gap-2 items-center">
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">Choisir un contact…</option>
            {eligible.map((a) => (
              <option key={a.user.id} value={a.user.id}>
                {a.user.name} ({a.user.client?.name ?? a.user.email})
              </option>
            ))}
          </select>
          <button
            disabled={!choice}
            onClick={() => {
              onInscribe(choice);
              setChoice("");
              setOpen(false);
            }}
            className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            Inscrire
          </button>
          <button onClick={() => setOpen(false)} className="text-xs text-muted">
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
