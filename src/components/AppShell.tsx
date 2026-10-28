"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import {
  canAccess,
  clearSession,
  getStoredUser,
  routeConfig,
  type AuthUser,
} from "@/lib/client/auth";
import { getBusinessProfile } from "@/lib/client/format";

type AppShellProps = {
  children: React.ReactNode;
  user: AuthUser;
};

export default function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = getBusinessProfile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [businessName, setBusinessName] = useState(user.businessName || profile.name);

  const allowedNav = useMemo(
    () => routeConfig.filter((item) => canAccess(user.role, item.moduleKey)),
    [user.role],
  );

  useEffect(() => {
    let active = true;
    apiFetch<{ billProfile?: { businessName?: string } }>("/api/print-templates/current")
      .then((data) => {
        if (!active) return;
        const name = String(data?.billProfile?.businessName || "").trim();
        if (name) setBusinessName(name);
      })
      .catch(() => {
        /* branding is optional */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  function handleLogout() {
    clearSession();
    void apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  const ownerInitial = (user.name || "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white transition lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-5 py-5">
            <p className="text-lg font-semibold text-emerald-700">STF POS</p>
            <p className="mt-1 truncate text-xs text-slate-500">{profile.name}</p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {allowedNav.map((item) => {
              const active =
                item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
            <p>Role</p>
            <p className="mt-1 font-medium capitalize text-slate-800">{user.role}</p>
          </div>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              className="btn-ghost px-3 py-2 lg:hidden"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              Menu
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                {businessName}
              </h1>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>

            <div className="relative">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Account menu"
              >
                {ownerInitial}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Signed in</p>
                  <p className="mt-1 truncate text-sm font-medium text-slate-900">{user.name}</p>
                  <button type="button" className="btn-ghost mt-3 w-full" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>

        <footer className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Soman Tech Foundry
        </footer>
      </div>
    </div>
  );
}

export function useClientUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    setUser(getStoredUser());
  }, []);
  return user;
}
