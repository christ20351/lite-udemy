"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/backoffice", label: "Tableau de bord", exact: true, icon: "M3 12h4l3-8 4 16 3-8h4" },
  { href: "/backoffice/pipeline", label: "Pipeline", icon: "M3 6h18M3 12h18M3 18h18M9 3v18M15 3v18" },
  { href: "/backoffice/clients", label: "Clients", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/backoffice/contacts", label: "Contacts apprenants", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/backoffice/formations", label: "Formations", icon: "M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" },
  { href: "/backoffice/calendar", label: "Calendrier", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" },
  { href: "/backoffice/sessions", label: "Sessions présentiel", icon: "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" },
  { href: "/backoffice/analytics", label: "Analytics", icon: "M18 20V10M12 20V4M6 20v-6" },
];

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || user.role !== "STAFF")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted animate-pulse">Chargement…</p>
      </main>
    );
  }

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex-1 flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-fg">
        <div className="flex items-center gap-3 border-b border-sidebar-line px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10 12 5 2 10l10 5 10-5Z" />
              <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Lite Academy</p>
            <p className="text-[11px] text-sidebar-muted">Back-office</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-indigo-500/20 font-semibold text-white ring-1 ring-inset ring-indigo-400/40"
                    : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-line px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/25 text-xs font-bold text-indigo-300">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-[11px] text-sidebar-muted">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
              className="text-xs text-sidebar-muted underline-offset-2 hover:text-white hover:underline"
            >
              Se déconnecter
            </button>
            <ThemeToggle className="border-sidebar-line bg-white/5 hover:bg-white/10 hover:text-sidebar-fg" />
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
