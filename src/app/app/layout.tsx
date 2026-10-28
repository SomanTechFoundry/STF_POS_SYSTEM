"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  canAccess,
  getStoredUser,
  isLoggedIn,
  routeConfig,
  type AuthUser,
  type ModuleKey,
} from "@/lib/client/auth";

function moduleForPath(pathname: string): ModuleKey | null {
  if (pathname === "/app" || pathname === "/app/") return "dashboard";
  if (pathname.startsWith("/app/unauthorized")) return null;
  const match = routeConfig.find((item) => item.href !== "/app" && pathname.startsWith(item.href));
  return match?.moduleKey ?? "dashboard";
}

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    const stored = getStoredUser();
    if (!stored) {
      router.replace("/login");
      return;
    }

    const moduleKey = moduleForPath(pathname);
    if (moduleKey && !canAccess(stored.role, moduleKey)) {
      router.replace("/app/unauthorized");
      return;
    }

    setUser(stored);
    setReady(true);
  }, [pathname, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading workspace…
      </div>
    );
  }

  return <AppShell user={user}>{children}</AppShell>;
}
