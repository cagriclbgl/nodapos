/**
 * `window.callerId` — Electron preload (electron/src/preload.ts) içinden
 * contextBridge.exposeInMainWorld ile renderer'a açılan minimal API. Web
 * (Vercel) ortamında bu obje undefined olur; tüm tüketicilerin önce
 * `if (typeof window !== "undefined" && window.callerId) { ... }` kontrolü
 * yapması gerekir.
 */

import type { IncomingCallDto } from "./api";

export type CallerIdStatusPayload =
  | { kind: "disconnected"; reason?: string }
  | { kind: "searching"; reason?: string }
  | {
      kind: "connected";
      product?: string;
      manufacturer?: string;
      serial?: string;
      signals?: number[];
    };

export interface CallerIdSignalsPayload {
  model?: string;
  serial?: string;
  signals: number[];
}

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

export interface CallerIdBridgeStatus {
  loaded: boolean;
  connected: boolean;
  model?: string;
  serial?: string;
  signals?: number[];
  reason?: string;
}

export interface CallerIdBridge {
  onCall(cb: (payload: CallerIdCallPayload) => void): () => void;
  onStatus(cb: (payload: CallerIdStatusPayload) => void): () => void;
  onSignals(cb: (payload: CallerIdSignalsPayload) => void): () => void;
  getStatus(): Promise<CallerIdBridgeStatus>;
}

/**
 * `window.printer` — Electron silent print köprüsü. Termal fiş yazıcısına
 * yazıcı seçim diyalogu olmadan basar; web (Vercel) ortamında undefined,
 * çağıran tarafta önce `if (window.printer)` kontrolü yapılmalı.
 */
export interface PrinterInfo {
  name: string;
  displayName?: string;
  isDefault?: boolean;
  status?: number;
}

export interface PrinterBridge {
  /**
   * Verilen URL'yi hidden BrowserWindow'da açar ve sessizce basar. URL
   * göreceli ("/print/end-of-day/...") veya tam olabilir; her iki durumda
   * da main process ?silent=1 query'sini ekler — sayfa kendi otomatik
   * print çağrısını atlamalı, yoksa çift baskı olur.
   *
   * Çözünür ok:false döndürürse renderer fallback (window.open) yapabilir.
   */
  print(
    url: string,
    deviceName?: string
  ): Promise<{ ok: boolean; reason?: string }>;
  listPrinters(): Promise<PrinterInfo[]>;
}

declare global {
  interface Window {
    app?: { version: string; platform: string };
    callerId?: CallerIdBridge;
    printer?: PrinterBridge;
  }
}

export {};
