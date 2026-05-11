"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, PackageCheck } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { IncomingCallProvider } from "@/lib/incoming-call-listener";
import { IncomingCallModal } from "@/components/incoming-call/IncomingCallModal";

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <AuthGuard>
      <IncomingCallProvider>
        <div className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
            <nav className="flex items-center gap-1">
              <PosTab
                href="/pos"
                icon={LayoutGrid}
                label="Masalar"
                active={pathname === "/pos" || pathname.startsWith("/pos/table") || pathname.startsWith("/pos/delivery")}
              />
              <PosTab
                href="/pos/calls"
                icon={PackageCheck}
                label="Paket Servis"
                active={pathname.startsWith("/pos/calls")}
              />
            </nav>
            <div className="flex items-center gap-4">
              <ManagerLink />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1">{children}</main>
          {/* Caller ID kutusundan gelen çağrı için global modal — pencerede her
              yerde aktif (masa ekranı, sipariş ekranı vb.). */}
          <IncomingCallModal />
        </div>
      </IncomingCallProvider>
    </AuthGuard>
  );
}

function PosTab({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

/** Only shows the admin link when the current user is a Manager. */
function ManagerLink() {
  const { user } = useAuth();
  if (user?.role !== "Manager") return null;
  return (
    <Link
      href="/admin"
      className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
    >
      Yönetici Paneli →
    </Link>
  );
}
