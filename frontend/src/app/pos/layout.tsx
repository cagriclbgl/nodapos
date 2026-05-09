"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/lib/auth-context";

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Kasa</h1>
          </div>
          <div className="flex items-center gap-4">
            <ManagerLink />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </AuthGuard>
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
