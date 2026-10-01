"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "./api";

export type Role = "ADMIN" | "GESTIONNAIRE" | "FORMATEUR" | "APPRENANT";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/** Membres de l'équipe : accès au back-office (tout sauf APPRENANT). */
export function isEquipe(role: string | undefined): boolean {
  return role === "ADMIN" || role === "GESTIONNAIRE" || role === "FORMATEUR";
}

/** ADMIN et GESTIONNAIRE : pilotent le catalogue, les apprenants, l'équipe. */
export function isGestion(role: string | undefined): boolean {
  return role === "ADMIN" || role === "GESTIONNAIRE";
}

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {
    throw new Error("AuthProvider manquant");
  },
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Un seul essai suffit en temps normal ; on retente une fois en cas
    // d'échec réseau transitoire (serveur qui redémarre…).
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await api("/auth/me");
        setUser(data.user);
        break;
      } catch {
        setUser(null);
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setUser(data.user);
    return data.user as SessionUser;
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homeForRole(role: string | undefined) {
  return isEquipe(role) ? "/backoffice" : "/mes-formations";
}
