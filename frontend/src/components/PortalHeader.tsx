"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

const PORTAL_NAV = [
  { href: "/mes-formations", label: "Mes formations" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/mes-sessions", label: "Mes sessions" },
];

export default function PortalHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur-md">
      {/* Liseré dégradé en haut de page */}
      <div
        aria-hidden
        className="h-0.5 w-full"
        style={{ background: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899)" }}
      />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/mes-formations" className="text-base font-black tracking-tight">
            <span className="gradient-text">Lora</span>
            <span className="text-fg">One</span>
          </Link>
          <nav className="flex items-center gap-1.5">
            {PORTAL_NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "rounded-full px-3.5 py-1.5 text-sm font-bold text-white shadow-md shadow-indigo-500/30 transition-colors"
                      : "rounded-full px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  }
                  style={
                    active
                      ? { background: "linear-gradient(120deg, #6366f1, #a855f7)" }
                      : undefined
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted sm:inline">{user?.name}</span>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #ec4899)" }}
            title={user?.email}
          >
            {initials}
          </span>
          <ThemeToggle />
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}
