"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { CircleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth, homeForRole } from "@/lib/auth";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(homeForRole(user.role));
  }, [user, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        const u = await login(email, password);
        router.replace(homeForRole(u.role));
      } else {
        // Inscription apprenant : connexion automatique puis catalogue
        await api("/auth/signup", {
          method: "POST",
          body: { name, email, password },
        });
        await login(email, password);
        router.replace("/catalogue");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex-1 flex items-center justify-center overflow-hidden p-4">
      {/* Halo décoratif */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
      </div>

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/30">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10 12 5 2 10l10 5 10-5Z" />
              <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-fg">
            Lora{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">
              One
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-muted">Formations en ligne — apprenez à votre rythme</p>
        </div>

        {/* Onglets */}
        <div className="card grid grid-cols-2 gap-1 p-1 mb-4">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-fg"
              }`}
            >
              {m === "login" ? "Se connecter" : "Créer un compte"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg-soft">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              {error}
            </div>
          )}
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-fg">
                Nom complet
              </label>
              <input
                id="name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nina Nouvelle"
                className="input"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-fg">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.fr"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-fg">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={mode === "signup" ? 6 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting
              ? "Un instant…"
              : mode === "login"
                ? "Se connecter"
                : "Créer mon compte apprenant"}
          </button>
          {mode === "signup" && (
            <p className="text-center text-xs text-faint">
              Vous pourrez ensuite vous inscrire aux formations gratuites du
              catalogue. Les formations payantes sont accessibles après
              inscription par l&apos;équipe.
            </p>
          )}
        </form>

        {mode === "login" && (
          <div className="card mt-4 px-5 py-4 text-center text-xs leading-relaxed text-muted">
            <p className="mb-1 font-semibold text-fg-soft">Comptes de démonstration</p>
            <p>
              <span className="text-faint">Admin</span> · admin@liteudemy.local / admin123
            </p>
            <p>
              <span className="text-faint">Gestionnaire</span> · gestion@liteudemy.local / gestion123
            </p>
            <p>
              <span className="text-faint">Formateur</span> · formateur@liteudemy.local / formateur123
            </p>
            <p>
              <span className="text-faint">Apprenant</span> · jean@example.fr / demo123
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
