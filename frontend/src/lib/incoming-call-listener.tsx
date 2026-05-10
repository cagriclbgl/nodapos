"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CallerIdCallPayload,
  CallerIdStatusPayload,
} from "@/types/electron";
import type { IncomingCallDto } from "@/types/api";
import { incomingCalls } from "@/lib/api";

/**
 * Caller ID dinleyicisi (renderer tarafı).
 *
 *  - Electron preload'undan gelen `window.callerId.onCall()` event'ine subscribe
 *    olur ve aktif çağrıyı state'e koyar.
 *  - Web (Vercel) ortamında `window.callerId` undefined → tüm event handler'lar
 *    kayıtlı olmaz; sağlayıcı sessizce no-op döner.
 *  - Modal kapatma akışları: kullanıcı bir aksiyon aldığında (sipariş başlat /
 *    cevapsız işaretle) `clearActiveCall()` çağırılır.
 *  - 60 sn timeout: aktif çağrı el sürülmediyse otomatik "Missed" işaretlenir.
 */

interface IncomingCallContextValue {
  activeCall: IncomingCallDto | null;
  /** Backend kayıt başarısız olduysa minimal fallback (telefon + hat). */
  activeCallFallback: {
    phone?: string;
    lineNumber?: number;
    receivedAt: string;
    unauthenticated: boolean;
  } | null;
  status: CallerIdStatusPayload;
  clearActiveCall: () => void;
  /** "Cevapsız işaretle" — backend'e PATCH atar ve UI'dan düşürür. */
  markMissed: (id: string) => Promise<void>;
}

const DEFAULT_STATUS: CallerIdStatusPayload = { kind: "disconnected" };

const Ctx = createContext<IncomingCallContextValue>({
  activeCall: null,
  activeCallFallback: null,
  status: DEFAULT_STATUS,
  clearActiveCall: () => {},
  markMissed: async () => {},
});

const MISSED_AUTO_TIMEOUT_MS = 60_000;

function isFullDto(p: CallerIdCallPayload): p is IncomingCallDto {
  return "id" in p;
}

export function IncomingCallProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<IncomingCallDto | null>(null);
  const [activeCallFallback, setActiveCallFallback] =
    useState<IncomingCallContextValue["activeCallFallback"]>(null);
  const [status, setStatus] = useState<CallerIdStatusPayload>(DEFAULT_STATUS);

  // Çağrı geldikten sonra 60sn içinde aksiyon yoksa otomatik Missed.
  useEffect(() => {
    if (!activeCall) return;
    const t = setTimeout(() => {
      void incomingCalls
        .resolve(activeCall.id, { status: "Missed" })
        .catch(() => {
          /* ignore — sonraki list refresh düzeltir */
        })
        .finally(() => {
          setActiveCall((cur) => (cur?.id === activeCall.id ? null : cur));
        });
    }, MISSED_AUTO_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [activeCall]);

  // Electron IPC subscribe — bridge undefined ise hiçbir şey yapma.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = window.callerId;
    if (!bridge) return;

    const offCall = bridge.onCall((payload) => {
      if (isFullDto(payload)) {
        setActiveCall(payload);
        setActiveCallFallback(null);
      } else {
        setActiveCallFallback({
          phone: payload.phone,
          lineNumber: payload.lineNumber,
          receivedAt: payload.receivedAt,
          unauthenticated: payload.unauthenticated,
        });
      }
    });
    const offStatus = bridge.onStatus((s) => {
      setStatus(s);
    });

    return () => {
      offCall();
      offStatus();
    };
  }, []);

  const clearActiveCall = useCallback(() => {
    setActiveCall(null);
    setActiveCallFallback(null);
  }, []);

  const markMissed = useCallback(async (id: string) => {
    try {
      await incomingCalls.resolve(id, { status: "Missed" });
    } finally {
      setActiveCall((cur) => (cur?.id === id ? null : cur));
    }
  }, []);

  const value = useMemo<IncomingCallContextValue>(
    () => ({
      activeCall,
      activeCallFallback,
      status,
      clearActiveCall,
      markMissed,
    }),
    [activeCall, activeCallFallback, status, clearActiveCall, markMissed]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIncomingCall() {
  return useContext(Ctx);
}
