"use client";

import { useCallback, useMemo, useState } from "react";

// ── Collection de requêtes de démonstration ──────────────────────────

type Preset = {
  id: string;
  name: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  url: string; // chemin API, préfixé automatiquement
  body?: Record<string, unknown>;
  /** connexion silencieuse préalable (le cookie httpOnly porte la session) */
  loginAs?: "staff" | "learner";
  loginHint?: string;
  note: string;
};

const API_URL = "http://localhost:4100";

const PRESETS: Preset[] = [
  {
    id: "login-staff",
    name: "1 · Connexion staff",
    method: "POST",
    url: "/api/auth/login",
    body: { email: "admin@liteudemy.local", password: "admin123" },
    note: "Authentifie le staff — pose un cookie httpOnly signé (JWT) utilisé par toutes les requêtes suivantes.",
  },
  {
    id: "stats-dashboard",
    name: "2 · Stats du tableau de bord",
    method: "GET",
    url: "/api/stats/dashboard",
    loginAs: "staff",
    note: "Agrégations CRM réservées au staff : clients, formations, accès, sessions, quiz… (403 pour un apprenant).",
  },
  {
    id: "deal-create",
    name: "3 · Créer une opportunité",
    method: "POST",
    url: "/api/deals",
    body: {
      title: "Demo Postman — offre team building",
      amount: 6200,
      notes: "Créée depuis le Mini Postman",
    },
    loginAs: "staff",
    note: "Écriture dans le pipeline commercial : le deal naît à l'étape NEW, glisse-le ensuite dans le kanban.",
  },
  {
    id: "me-formations",
    name: "4 · Mes formations (apprenant)",
    method: "GET",
    url: "/api/me/formations",
    loginAs: "learner",
    loginHint: "jean@acme.example",
    note: "Le rôle CONTACT du token limite la réponse aux seules formations où un accès a été attribué — isolation par client.",
  },
];

const METHOD_COLOR: Record<string, string> = {
  GET: "text-emerald-400",
  POST: "text-amber-400",
  PATCH: "text-sky-400",
  PUT: "text-sky-400",
  DELETE: "text-red-400",
};

// ── Coloration syntaxique JSON minimaliste ───────────────────────────

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJson(json: string) {
  const escaped = escapeHtml(json);
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "text-amber-300"; // nombres
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "text-sky-300" : "text-emerald-300"; // clé vs valeur
      } else if (/true|false/.test(match)) {
        cls = "text-violet-400";
      } else if (/null/.test(match)) {
        cls = "text-slate-500";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

// ── Page ─────────────────────────────────────────────────────────────

type Response = {
  status: number;
  statusText: string;
  timeMs: number;
  size: number;
  bodyText: string;
};

export default function PostmanPage() {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId)!, [presetId]);

  const [method, setMethod] = useState(preset.method);
  const [path, setPath] = useState(preset.url);
  const [body, setBody] = useState(preset.body ? JSON.stringify(preset.body, null, 2) : "");
  const [response, setResponse] = useState<Response | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id)!;
    setPresetId(id);
    setMethod(p.method);
    setPath(p.url);
    setBody(p.body ? JSON.stringify(p.body, null, 2) : "");
    setResponse(null);
    setError(null);
  }

  const send = useCallback(async () => {
    setSending(true);
    setError(null);
    setResponse(null);
    const t0 = performance.now();
    try {
      // connexion silencieuse préalable si le preset l'exige
      if (preset.loginAs) {
        const creds =
          preset.loginAs === "staff"
            ? { email: "admin@liteudemy.local", password: "admin123" }
            : { email: "jean@acme.example", password: "demo123" };
        await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(creds),
        });
      }

      const res = await fetch(`${API_URL}${path}`, {
        method,
        credentials: "include",
        headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
        body: method === "GET" || !body.trim() ? undefined : body,
      });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* pas du JSON : affiché brut */
      }
      setResponse({
        status: res.status,
        statusText: res.statusText || (res.ok ? "OK" : ""),
        timeMs: Math.round(performance.now() - t0),
        size: new Blob([text]).size,
        bodyText: pretty,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setSending(false);
    }
  }, [preset, path, method, body]);

  const statusColor = !response
    ? ""
    : response.status < 300
      ? "text-emerald-400"
      : response.status < 400
        ? "text-sky-400"
        : response.status < 500
          ? "text-amber-400"
          : "text-red-400";

  return (
    <main className="min-h-screen bg-[#0d1117] text-slate-200">
      {/* Barre supérieure */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-sm font-black text-white">
          LP
        </div>
        <div>
          <p className="text-sm font-bold">
            Lite Postman <span className="text-orange-400">· API Lite Academy</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Base : {API_URL} · cookies httpOnly inclus automatiquement
          </p>
        </div>
        <a
          href="/login"
          className="ml-auto rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          ← Retour à l&apos;app
        </a>
      </div>

      <div className="flex">
        {/* ── Collection ── */}
        <aside className="w-72 shrink-0 border-r border-white/10 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Collection — Lite Academy
          </p>
          <div className="space-y-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPreset(p.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${
                  presetId === p.id
                    ? "bg-white/10 text-white ring-1 ring-orange-500/40"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span className={`mr-2 font-bold ${METHOD_COLOR[p.method]}`}>{p.method}</span>
                {p.name.replace(/^\d+ · /, "")}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-slate-400">
            <p className="mb-1 font-semibold text-slate-300">💡 Note</p>
            {preset.note}
          </div>
        </aside>

        {/* ── Requête / Réponse ── */}
        <section className="min-w-0 flex-1 p-5">
          {/* Ligne de requête */}
          <div className="flex items-stretch gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className={`w-28 rounded-lg border border-white/10 bg-[#161b22] px-3 text-sm font-bold ${METHOD_COLOR[method]}`}
            >
              {["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-[#161b22] px-3 text-sm">
              <span className="text-slate-500">{API_URL}</span>
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="w-full bg-transparent py-2.5 text-slate-200 outline-none"
                spellCheck={false}
              />
            </div>
            <button
              onClick={send}
              disabled={sending}
              className="rounded-lg bg-orange-500 px-6 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {sending ? "Envoi…" : "Send"}
            </button>
          </div>

          {/* Corps de requête */}
          {(method !== "GET" || body) && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Body · JSON
              </p>
              <textarea
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
                className="w-full rounded-lg border border-white/10 bg-[#161b22] p-3 font-mono text-xs text-slate-300 outline-none focus:border-orange-500/50"
              />
            </div>
          )}

          {/* Réponse */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Réponse
              </p>
              {response && (
                <div className="flex items-center gap-4 text-xs">
                  <span className={`font-bold ${statusColor}`}>
                    {response.status} {response.statusText}
                  </span>
                  <span className="text-slate-500">{response.timeMs} ms</span>
                  <span className="text-slate-500">{response.size} o</span>
                </div>
              )}
            </div>
            <div className="min-h-64 rounded-lg border border-white/10 bg-[#0a0e14] p-4">
              {error ? (
                <p className="text-xs text-red-400">⚠️ {error}</p>
              ) : response ? (
                <pre
                  className="overflow-x-auto font-mono text-xs leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: highlightJson(response.bodyText) }}
                />
              ) : (
                <p className="text-xs text-slate-600">
                  Clique sur <span className="font-bold text-orange-400">Send</span> pour exécuter
                  la requête — choisis d&apos;abord une entrée dans la collection à gauche.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
