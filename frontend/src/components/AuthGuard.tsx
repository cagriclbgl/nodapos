"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/types/api";

interface AuthGuardProps {
  /** Required role. If omitted, any authenticated user is allowed. */
  role?: UserRole;
  children: ReactNode;
}

/**
 * Client-side route guard. Renders nothing while auth is hydrating to avoid
 * flashing the wrong page; once loaded, redirects unauthorised users:
 *  - anonymous → /login
 *  - role mismatch → role-appropriate landing (Manager→/admin, Cashier→/pos)
 *
 * The backend remains the source of truth — these UI checks are for routing
 * UX only.
 */
export function AuthGuard({ role, children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role && user.role !== role) {
      router.replace(user.role === "Manager" ? "/admin" : "/pos");
    }
  }, [loading, user, role, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-500">Yükleniyor…</p>
      </div>
    );
  }

  if (!user) return null;
  if (role && user.role !== role) return null;

  return <>{children}</>;
}
