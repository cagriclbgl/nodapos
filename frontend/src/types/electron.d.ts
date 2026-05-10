/**
 * `window.callerId` — Electron preload (electron/src/preload.ts) içinden
 * contextBridge.exposeInMainWorld ile renderer'a açılan minimal API. Web
 * (Vercel) ortamında bu obje undefined olur; tüm tüketicilerin önce
 * `if (typeof window !== "undefined" && window.callerId) { ... }` kontrolü
 * yapması gerekir.
 */

import type { IncomingCallDto } from "./api";

export interface CallerIdRawPayload {
  hex: string;
}

export type CallerIdStatusPayload =
  | { kind: "disconnected"; reason?: string }
  | { kind: "searching" }
  | {
      kind: "connected";
      product?: string;
      manufacturer?: string;
      serial?: string;
    }
  | { kind: "test-mode" };

/**
 * Backend kayıt başarılıysa tam IncomingCallDto, başarısızsa minimal fallback
 * payload (örn. kullanıcı henüz login değil — UI yine toast göstersin diye).
 */
export type CallerIdCallPayload =
  | IncomingCallDto
  | {
      unauthenticated: boolean;
      phone?: string;
      lineNumber?: number;
      receivedAt: string;
    };

export interface CallerIdHidDeviceInfo {
  vendorId?: number;
  productId?: number;
  product?: string;
  manufacturer?: string;
  serialNumber?: string;
  path?: string;
  usagePage?: number;
  usage?: number;
}

export interface CallerIdBridge {
  onCall(cb: (payload: CallerIdCallPayload) => void): () => void;
  onRaw(cb: (payload: CallerIdRawPayload) => void): () => void;
  onStatus(cb: (payload: CallerIdStatusPayload) => void): () => void;
  rescan(): Promise<{ ok: boolean }>;
  listDevices(): Promise<CallerIdHidDeviceInfo[]>;
  setTestMode(active: boolean): Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    app?: { version: string; platform: string };
    callerId?: CallerIdBridge;
  }
}

export {};
