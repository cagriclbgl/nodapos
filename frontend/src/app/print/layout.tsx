"use client";

import { AuthGuard } from "@/components/AuthGuard";

/**
 * Standalone layout for print-only pages (receipts, kitchen tickets, etc.).
 *
 * Strips the admin/POS chrome — no sidebar, top bar, or UserMenu — so the
 * route can be loaded full-screen and triggered straight into `window.print()`.
 * AuthGuard is still applied so an anonymous user gets bounced to /login
 * before any order data is fetched.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-white text-zinc-900 print:bg-white">
        {children}
      </main>
    </AuthGuard>
  );
}
