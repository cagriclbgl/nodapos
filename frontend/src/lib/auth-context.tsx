"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ApiError, auth } from "./api";
import type {
  LoginRequest,
  LoginResponse,
  StoreSummaryDto,
  UserDto,
  UserRole,
} from "@/types/api";

interface AuthContextValue {
  user: UserDto | null;
  store: StoreSummaryDto | null;
  loading: boolean;
  login: (req: LoginRequest) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Optimistic role check for UI gates; backend remains source of truth. */
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  store: null,
  loading: true,
  login: async () => {
    throw new Error("AuthContext not mounted");
  },
  logout: async () => {},
  refresh: async () => {},
  hasRole: () => false,
});

/**
 * Cookie-driven auth provider. On mount calls `auth.me()` to hydrate the
 * current session; treats 401 as unauthenticated rather than an error.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [store, setStore] = useState<StoreSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await auth.me();
      setUser(me.user);
      setStore(me.store);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setStore(null);
      } else {
        // Network or unexpected error — treat as logged-out so the user can
        // retry from /login rather than being stuck on a spinner.
        setUser(null);
        setStore(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // When any API call returns 401 (after the initial me() probe), drop the
  // session client-side. The AuthGuards on /admin and /pos will then push the
  // user to /login.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUnauthorized = () => {
      setUser(null);
      setStore(null);
      setLoading(false);
    };
    window.addEventListener("pizzapos:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("pizzapos:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (req: LoginRequest) => {
    const res = await auth.login(req);
    setUser(res.user);
    setStore(res.store);
    setLoading(false);
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      // Even if the server call fails, clear client state.
    }
    setUser(null);
    setStore(null);
  }, []);

  const hasRole = useCallback(
    (role: UserRole) => user?.role === role,
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, store, loading, login, logout, refresh, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
