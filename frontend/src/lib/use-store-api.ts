"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { useStoreContext } from "./store-context";

interface UseStoreApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * GETs from a tenant-scoped backend path. Returns null data while no store is
 * picked or the path is intentionally null (e.g. waiting on a dependency).
 */
export function useStoreApi<T>(path: string | null): UseStoreApiResult<T> {
  const { storeId } = useStoreContext();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId || !path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<T>(path, storeId));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail || err.message : String(err)
      );
    } finally {
      setLoading(false);
    }
  }, [path, storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.detail || err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
