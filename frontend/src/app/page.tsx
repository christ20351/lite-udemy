"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, homeForRole } from "@/lib/auth";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? homeForRole(user.role) : "/login");
    }
  }, [user, loading, router]);

  return (
    <main className="flex-1 flex items-center justify-center">
      <p className="text-muted animate-pulse">Chargement…</p>
    </main>
  );
}
