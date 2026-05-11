"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Package,
  Phone,
  Settings,
  Sparkles,
  Tag,
  Users,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { UserMenu } from "@/components/UserMenu";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Özet", icon: BarChart3 },
  { href: "/admin/products", label: "Ürünler", icon: Package },
  { href: "/admin/combos", label: "Kampanyalar", icon: Sparkles },
  { href: "/admin/categories", label: "Kategoriler", icon: Tag },
  { href: "/admin/tables", label: "Masalar", icon: LayoutGrid },
  { href: "/admin/orders", label: "Siparişler", icon: ClipboardList },
  { href: "/admin/customers", label: "Müşteriler", icon: Users },
  { href: "/admin/calls", label: "Paket Servis", icon: Phone },
  { href: "/admin/users", label: "Kullanıcılar", icon: UserCog },
  { href: "/admin/settings/caller-id", label: "Caller ID", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AuthGuard role="Manager">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="border-b bg-card p-4 md:w-64 md:border-b-0 md:border-r">
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-base font-bold">N</span>
            </div>
            <h1 className="text-lg font-semibold tracking-tight">NodaPos</h1>
          </div>
          <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
            {NAV.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
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
                  {active && (
                    <ChevronRight className="ml-auto hidden h-4 w-4 md:block" />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b bg-card px-6 py-3">
            <Link
              href="/pos"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Kasa Ekranı
            </Link>
            <UserMenu />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
