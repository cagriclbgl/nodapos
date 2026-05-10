import { BrowserWindow, session } from "electron";
import type { CallerIdListener } from "../hid/caller-id-listener";
import type { CallerIdStatus, ParsedCallerIdEvent } from "../hid/types";

/**
 * Çağrı köprüsü:
 *  1. Listener "call" event'i atınca backend'e POST /api/incoming-calls
 *  2. Backend'in döndürdüğü IncomingCallDto'yu (matched customer + recent
 *     orders dahil) renderer pencerelerine IPC ile yayar
 *
 * Auth: kasa Electron'unda backend ile renderer aynı session cookie havuzunu
 * paylaşır. Main process'ten yapılan fetch'i `session.defaultSession`
 * cookie'leriyle imzalamak için header'ı manuel ekliyoruz (Electron'un
 * net.request'i ile cookie otomatik geçer ama kullanıcı yeni giriş yapmamışsa
 * boş kalabilir — o durumda backend 401 döner ve UI login'e yönlenir).
 */

interface BridgeOptions {
  apiBaseUrl: string;
  log?: (msg: string) => void;
}

const IPC_CHANNEL_CALL = "caller-id:call";
const IPC_CHANNEL_RAW = "caller-id:raw";
const IPC_CHANNEL_STATUS = "caller-id:status";

export class IncomingCallBridge {
  constructor(
    private readonly listener: CallerIdListener,
    private readonly opts: BridgeOptions
  ) {}

  install(): void {
    this.listener.on("call", (event) => {
      void this.onCall(event);
    });
    this.listener.on("raw", (hex) => this.broadcast(IPC_CHANNEL_RAW, { hex }));
    this.listener.on("status", (status: CallerIdStatus) => {
      this.broadcast(IPC_CHANNEL_STATUS, status);
    });
    this.listener.on("error", (err) => {
      this.opts.log?.(`[bridge] listener error: ${err.message}`);
    });
  }

  private async onCall(event: ParsedCallerIdEvent): Promise<void> {
    if (event.type !== "ring" && event.type !== "number") return;

    const body = {
      phone: event.phone ?? null,
      lineNumber: event.lineNumber ?? null,
      receivedAt: event.receivedAt.toISOString(),
      rawPayloadHex: event.rawHex,
    };

    try {
      // Aynı pencerenin kullandığı cookie'lerini al ve Cookie header'ı kur.
      // Bu fetch backend ile aynı host (127.0.0.1:apiPort) olduğu için
      // CORS sorunu yok; auth cookie'si varsa backend kasa kullanıcısına
      // bağlar ve doğru StoreId tenant'ına yazar.
      const cookies = await session.defaultSession.cookies.get({});
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

      const res = await fetch(`${this.opts.apiBaseUrl}/api/incoming-calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        this.opts.log?.(
          `[bridge] backend ${res.status} — çağrı kaydı atlandı (${event.phone ?? "?"} hat ${
            event.lineNumber ?? "_"
          })`
        );
        // 401: kullanıcı girişli değil; UI yine toast göstersin diye event'i
        // minimal payload ile renderer'a düşür.
        this.broadcast(IPC_CHANNEL_CALL, {
          unauthenticated: res.status === 401,
          phone: event.phone,
          lineNumber: event.lineNumber,
          receivedAt: event.receivedAt.toISOString(),
        });
        return;
      }

      const dto = await res.json();
      this.broadcast(IPC_CHANNEL_CALL, dto);
    } catch (err) {
      this.opts.log?.(
        `[bridge] backend POST hatası: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      win.webContents.send(channel, payload);
    }
  }
}

export const CALLER_ID_IPC = {
  CALL: IPC_CHANNEL_CALL,
  RAW: IPC_CHANNEL_RAW,
  STATUS: IPC_CHANNEL_STATUS,
} as const;
