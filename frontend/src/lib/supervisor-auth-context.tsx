"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ApiError, supervisorAuth } from "./api";
import type {
  SupervisorDto,
  SupervisorLoginRequest,
  SupervisorSessionResponse,
} from "@/types/api";

interface SupervisorAuthContextValue {
  supervisor: SupervisorDto | null;
  loading: boolean;
  login: (req: SupervisorLoginRequest) => Promise<SupervisorSessionResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SupervisorAuthContext = createContext<SupervisorAuthContextValue>({
  supervisor: null,
  loading: true,
  login: async () => {
    throw new Error("SupervisorAuthContext not mounted");
  },
  logout: async () => {},
  refresh: async () => {},
});

/**
 * Cookie-driven platform-supervisor session. Independent from the per-store
 * AuthProvider — separate cookie (`pizza_supervisor`) and separate route tree.
 */
export function SupervisorAuthProvider({ children }: { children: ReactNode }) {
  const [supervisor, setSupervisor] = useState<SupervisorDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await supervisorAuth.me();
      setSupervisor(me.supervisor);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSupervisor(null);
      } else {
        setSupervisor(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUnauthorized = () => {
      setSupervisor(null);
      setLoading(false);
    };
    window.addEventListener(
      "pizzapos:supervisor-unauthorized",
      onUnauthorized
    );
    return () =>
      window.removeEventListener(
        "pizzapos:supervisor-unauthorized",
        onUnauthorized
      );
  }, []);

  const login = useCallback(async (req: SupervisorLoginRequest) => {
    const res = await supervisorAuth.login(req);
    setSupervisor(res.supervisor);
    setLoading(false);
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await supervisorAuth.logout();
    } catch {
      // Clear client state even if the server call fails.
    }
    setSupervisor(null);
  }, []);

  return (
    <SupervisorAuthContext.Provider
      value={{ supervisor, loading, login, logout, refresh }}
    >
      {children}
    </SupervisorAuthContext.Provider>
  );
}

export function useSupervisorAuth() {
  return useContext(SupervisorAuthContext);
}
