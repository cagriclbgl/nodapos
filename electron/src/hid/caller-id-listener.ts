import { EventEmitter } from "node:events";
import { Wch1A86E008Parser } from "./parsers/wch-1a86-e008";
import {
  CallerIdParser,
  CallerIdStatus,
  ParsedCallerIdEvent,
  TARGET_PRODUCT_ID,
  TARGET_VENDOR_ID,
} from "./types";

// node-hid lazy-load: rebuild edilmediyse import'ta çakılırsa main process
// crash etmesin diye.
type HIDModule = typeof import("node-hid");

interface ListenerOptions {
  vendorId?: number;
  productId?: number;
  /** Aynı numaranın N ms içinde tekrar event olmasını engelle (kasa uyarı patlamasın). */
  debounceMs?: number;
  log?: (line: string) => void;
}

/**
 * USB HID Caller ID box dinleyicisi.
 *
 * Sorumluluklar:
 *  - Açılışta (ve hot-plug sonrası) cihazı VID/PID ile bul, bağlan
 *  - device.on("data") raporlarını parser'a aktar
 *  - Anlamlı event'lerde "call" event'i yayınla (bridge backend'e POST eder)
 *  - Disconnect/error → exponential backoff ile reconnect
 *  - Test modu açıkken her ham rapor "raw" event'i ile dışa açılır
 */
export class CallerIdListener extends EventEmitter {
  private hid: HIDModule | null = null;
  private device: import("node-hid").HID | null = null;
  private parser: CallerIdParser;
  private status: CallerIdStatus = { kind: "disconnected" };
  private testModeActive = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelayMs = 2000;
  private readonly maxReconnectDelayMs = 30_000;
  private lastEventKey = "";
  private lastEventAt = 0;

  constructor(private readonly opts: ListenerOptions = {}) {
    super();
    this.parser = new Wch1A86E008Parser();
  }

  start(): void {
    this.opts.log?.("[caller-id] start");
    void this.connect();
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeDevice();
    this.setStatus({ kind: "disconnected" });
  }

  setTestMode(active: boolean): void {
    this.testModeActive = active;
    if (active) this.setStatus({ kind: "test-mode" });
  }

  getStatus(): CallerIdStatus {
    return this.status;
  }

  /** Ayar panelindeki "Yeniden tara" butonu için: mevcut bağlantıyı kapat ve yeniden dene. */
  rescan(): void {
    this.opts.log?.("[caller-id] manual rescan");
    this.closeDevice();
    this.scheduleReconnect(true);
  }

  /**
   * UI'daki "Cihaz listesini göster" için. Native modül yüklü değilse boş döner.
   */
  async listAllDevices(): Promise<Array<import("node-hid").Device>> {
    try {
      const hid = await this.loadHid();
      return hid.devices();
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------

  private async loadHid(): Promise<HIDModule> {
    if (this.hid) return this.hid;
    // require dinamik — packaged build'de native binary unpack edilmiş klasörden
    // yüklenir; rebuild edilmediyse `Error: Could not locate the bindings file.`
    // gibi bir hata atar ve listener "disconnected" durumunda kalır.
    this.hid = (await import("node-hid")) as unknown as HIDModule;
    return this.hid;
  }

  private async connect(): Promise<void> {
    if (this.device) return;
    this.setStatus({ kind: "searching" });

    let hid: HIDModule;
    try {
      hid = await this.loadHid();
    } catch (err) {
      this.opts.log?.(
        `[caller-id] node-hid yüklenemedi (rebuild gerekli olabilir): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      this.setStatus({ kind: "disconnected", reason: "node-hid native modül yüklenemedi" });
      this.scheduleReconnect();
      return;
    }

    const vid = this.opts.vendorId ?? TARGET_VENDOR_ID;
    const pid = this.opts.productId ?? TARGET_PRODUCT_ID;

    const candidates = hid.devices().filter(
      (d) => d.vendorId === vid && d.productId === pid
    );
    if (candidates.length === 0) {
      this.setStatus({
        kind: "disconnected",
        reason: `VID 0x${vid.toString(16)} PID 0x${pid.toString(16)} cihaz bulunamadı`,
      });
      this.scheduleReconnect();
      return;
    }

    const target = candidates[0];
    if (!target.path) {
      this.setStatus({ kind: "disconnected", reason: "HID device.path boş" });
      this.scheduleReconnect();
      return;
    }

    try {
      const device = new hid.HID(target.path);
      this.device = device;
      this.parser.reset?.();

      // Cihazın wakeup paketi gerekiyorsa burada feature reportu yollanır.
      this.parser.initialize?.((bytes) => {
        try {
          device.sendFeatureReport(bytes);
        } catch (err) {
          this.opts.log?.(`[caller-id] feature report yazılamadı: ${err}`);
        }
      });

      device.on("data", (buf: Buffer) => this.onData(buf));
      device.on("error", (err: Error) => this.onError(err));

      this.setStatus({
        kind: "connected",
        product: target.product,
        manufacturer: target.manufacturer,
        serial: target.serialNumber,
      });
      this.reconnectDelayMs = 2000; // başarılı bağlantıda backoff'u sıfırla
      this.opts.log?.(
        `[caller-id] bağlandı (${target.manufacturer ?? "?"} / ${
          target.product ?? "?"
        } / s/n=${target.serialNumber ?? "?"})`
      );
    } catch (err) {
      this.opts.log?.(`[caller-id] cihaz açılamadı: ${err}`);
      this.setStatus({
        kind: "disconnected",
        reason: err instanceof Error ? err.message : String(err),
      });
      this.scheduleReconnect();
    }
  }

  private onData(buf: Buffer): void {
    const hex = buf.toString("hex");
    if (this.testModeActive) {
      this.emit("raw", hex);
    }

    let event: ParsedCallerIdEvent | undefined;
    try {
      event = this.parser.feed(buf);
    } catch (err) {
      this.opts.log?.(`[caller-id] parser hatası: ${err}`);
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
      return;
    }

    if (!event) return;

    // Stub parser'da her rapor "unknown" olarak gelir. Backend'e POST atmak
    // istemiyoruz çünkü bu raporlar henüz çağrı anlamına gelmiyor — ham hex'i
    // sadece test modu yayınına ve log'a düşür. Protokol netleşince
    // type === "ring" | "number" durumlarında emit("call") devreye girer.
    if (event.type === "unknown") {
      this.opts.log?.(`[caller-id][raw] ${hex}`);
      return;
    }

    // De-bounce: aynı (line, phone) çiftinin debounceMs içinde tekrar event
    // olmasını engelle (cihaz birkaç sn boyunca raporu tekrar tekrar gönderebilir).
    const key = `${event.lineNumber ?? "_"}|${event.phone ?? "?"}|${event.type}`;
    const debounceMs = this.opts.debounceMs ?? 5000;
    const now = Date.now();
    if (key === this.lastEventKey && now - this.lastEventAt < debounceMs) {
      return;
    }
    this.lastEventKey = key;
    this.lastEventAt = now;

    this.emit("call", event);
  }

  private onError(err: Error): void {
    this.opts.log?.(`[caller-id] device error: ${err.message}`);
    this.emit("error", err);
    this.closeDevice();
    this.setStatus({ kind: "disconnected", reason: err.message });
    this.scheduleReconnect();
  }

  private closeDevice(): void {
    if (this.device) {
      try {
        this.device.close();
      } catch {
        /* ignore */
      }
      this.device = null;
    }
  }

  private scheduleReconnect(immediate = false): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = immediate ? 250 : this.reconnectDelayMs;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
    if (!immediate) {
      this.reconnectDelayMs = Math.min(
        this.maxReconnectDelayMs,
        Math.round(this.reconnectDelayMs * 1.5)
      );
    }
  }

  private setStatus(s: CallerIdStatus): void {
    this.status = s;
    this.emit("status", s);
  }
}
