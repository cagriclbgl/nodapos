"use client";

import { useAuth } from "./auth-context";

interface StoreContextValue {
  storeId: string | null;
  /** Kept for source compatibility — auth flow handles store assignment now. */
  setStoreId: (id: string | null) => void;
  /** False until auth has finished its initial `me()` round-trip. */
  isReady: boolean;
}

/**
 * Thin shim over `useAuth()` so existing call sites (`useStoreApi`, admin
 * pages) keep compiling. The active StoreId is now driven by the logged-in
 * user's session — there is no separate store picker any more.
 */
export function useStoreContext(): StoreContextValue {
  const { store, loading } = useAuth();
  return {
    storeId: store?.id ?? null,
    setStoreId: () => {
      // No-op: the active store is determined by the auth session.
    },
    isReady: !loading,
  };
}
