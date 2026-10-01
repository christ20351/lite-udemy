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

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-5">
          <Link href="/mes-formations" className="text-sm font-bold text-fg">
            Lite{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
              Academy
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            {PORTAL_NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm transition-colors ${
                    active
                      ? "font-semibold text-primary"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted sm:inline">
            {user?.name}
            {user?.client ? (
              <span className="text-faint"> · {user.client.name}</span>
            ) : null}
          </span>
          <ThemeToggle />
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="text-xs text-muted underline-offset-2 hover:text-red-500 hover:underline"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}

