"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABEL = {
  Manager: "Yönetici",
  Cashier: "Kasiyer",
} as const;

/**
 * Compact identity strip for the admin/POS top bars: full name, role badge,
 * and a logout button. Reads directly from the auth context.
 */
export function UserMenu() {
  const { user, store, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{user.fullName}</p>
        <p className="text-xs leading-tight text-zinc-500">
          {store?.name ?? "—"}
        </p>
      </div>
      <span
        className={
          user.role === "Manager"
            ? "rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
            : "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        }
      >
        {ROLE_LABEL[user.role]}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Çıkış
      </button>
    </div>
  );
}
