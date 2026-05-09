"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  SupervisorAuthProvider,
  useSupervisorAuth,
} from "@/lib/supervisor-auth-context";
import { supervisor as supervisorApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "pendingRegistrations";
}

const NAV: NavItem[] = [
  { href: "/supervisor", label: "Özet", icon: BarChart3 },
  {
    href: "/supervisor/registrations",
    label: "Başvurular",
    icon: ClipboardList,
    badgeKey: "pendingRegistrations",
  },
  { href: "/supervisor/stores", label: "Mağazalar", icon: Building2 },
];

function Shell({ children }: { children: ReactNode }) {
  const { supervisor, loading, logout } = useSupervisorAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!supervisor) {
      router.replace("/supervisor/login");
    }
  }, [loading, supervisor, router]);

  useEffect(() => {
    if (!supervisor) return;
    let cancelled = false;
    void (async () => {
      try {
        const d = await supervisorApi.dashboard();
        if (!cancelled) setPendingCount(d.pendingRegistrations);
      } catch {
        if (!cancelled) setPendingCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supervisor, pathname]);

  if (loading || !supervisor) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      </div>
    );
  }

  const onLogout = async () => {
    await logout();
    router.replace("/supervisor/login");
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b bg-card p-4 md:w-64 md:border-b-0 md:border-r">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Supervisor</h1>
        </div>
        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
          {NAV.map((item) => {
            const active =
              item.href === "/supervisor"
                ? pathname === "/supervisor"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            const badge =
              item.badgeKey === "pendingRegistrations" && pendingCount && pendingCount > 0
                ? pendingCount
                : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {badge && (
                  <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    {badge}
                  </span>
                )}
                {!badge && active && (
                  <ChevronRight className="ml-auto hidden h-4 w-4 md:block" />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-6 py-3">
          <div className="text-sm text-muted-foreground">
            Platform Yöneticisi Paneli
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">
                {supervisor.fullName}
              </p>
              <p className="text-xs leading-tight text-muted-foreground">
                {supervisor.username}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              Çıkış
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default function SupervisorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Login page renders its own provider + form; the layout shell would loop
  // it back to /supervisor/login, so let it pass through unwrapped.
  if (pathname === "/supervisor/login") {
    return <>{children}</>;
  }
  return (
    <SupervisorAuthProvider>
      <Shell>{children}</Shell>
    </SupervisorAuthProvider>
  );
}
