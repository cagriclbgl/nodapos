import { BrowserWindow, app, session } from "electron";
import * as path from "path";
import * as fs from "fs";

/**
 * Cidshow C812A / C814A Caller ID köprüsü.
 *
 * Vendor (sistemler.com / cidshow.com) `cid.dll` v9.0.0.0 — tüm USB enumerate,
 * cihaz init, FSK/DTMF demod ve numara parse'ı içeride. Bizim sorumluluğumuz:
 *   1. DLL'i yükle (FFI: koffi prebuilt — derleme yok)
 *   2. SetEvents(callerIdCb, signalCb) ile callback'leri kaydet
 *   3. callerIdCb tetiklenince backend'e POST /api/incoming-calls + renderer'a
 *      IPC broadcast (caller-id:call) — IncomingCallModal'ı tetikler
 *   4. signalCb tetiklenince kasa "Bağlı" durumunu ve 4 hat sinyal seviyelerini
 *      renderer'a IPC ile yolla (caller-id:status, caller-id:signals)
 *
 * MİMARİ NOTU: Bu kasa Windows x64; DLL x64 yüklenir. x86 da resource'a
 * dahil — ileride 32-bit kasaya kurulursa otomatik fallback.
 *
 * GÜVENLİK: DLL yüklenemezse hata fırlatmaz, kasa "Caller ID disabled"
 * durumuyla açılır. Sipariş alma akışı etkilenmez.
 */

interface BridgeOptions {
  apiBaseUrl: string;
  log: (msg: string) => void;
}

interface CidshowStatus {
  loaded: boolean;
  connected: boolean;
  model?: string;
  serial?: string;
  signals?: [number, number, number, number]; // 4 hat (kullanılmayanlar 0)
  reason?: string;
}

const IPC_CHANNEL_CALL = "caller-id:call";
const IPC_CHANNEL_STATUS = "caller-id:status";
const IPC_CHANNEL_SIGNALS = "caller-id:signals";

export class CidshowBridge {
  private status: CidshowStatus = { loaded: false, connected: false };
  // Callback'leri ref'te tut — GC'lenirse DLL crash eder.
  private callerIdCbRef: unknown = null;
  private signalCbRef: unknown = null;
  // Aynı numarayı 5sn içinde tekrar gönderme (cihaz bazen birden fazla burst yayar)
  private lastCallKey = "";
  private lastCallAt = 0;
  private readonly debounceMs = 5000;

  // FSK decode tamponu: DLL aynı çağrıda partial → full progress eden multiple
  // CallerID event fire edebiliyor (örn: "045516338" sonra "05455163383").
  // 1500ms toplama penceresi içinde aynı hattan gelenlerden EN UZUN phone'u
  // kullan (en muhtemel "tam" decode), sonra tek POST at. Bu, "163383" gibi
  // 6 haneli partial decode'ların yanlış müşteriyle eşleşmesini engeller.
  private pendingByLine: Map<string, {
    phone: string;
    line: string;
    serial: string;
    dt: string;
    other: string;
    fireAt: number;
  }> = new Map();
  private readonly bufferMs = 1500;

  constructor(private readonly opts: BridgeOptions) {}

  /**
   * DLL'i yükle ve event handler'ları kaydet. Hata olursa false döner — main.ts
   * crash etmez, kasa Caller ID olmadan açılır.
   */
  start(): boolean {
    const dllPath = this.resolveDllPath();
    if (!dllPath) {
      this.setStatus({
        loaded: false,
        connected: false,
        reason: "cid.dll bulunamadı (resources/cidshow eksik)",
      });
      this.opts.log("[cidshow] cid.dll path bulunamadı, devre dışı");
      return false;
    }
    this.opts.log(`[cidshow] DLL yolu: ${dllPath} (arch=${process.arch})`);

    let koffi: typeof import("koffi");
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      koffi = require("koffi");
    } catch (err) {
      this.setStatus({
        loaded: false,
        connected: false,
        reason: `koffi yüklenemedi: ${(err as Error).message}`,
      });
      this.opts.log(`[cidshow] koffi import hatası: ${(err as Error).message}`);
      return false;
    }

    let lib: ReturnType<typeof koffi.load>;
    try {
      lib = koffi.load(dllPath);
    } catch (err) {
      this.setStatus({
        loaded: false,
        connected: false,
        reason: `cid.dll yüklenemedi: ${(err as Error).message}`,
      });
      this.opts.log(`[cidshow] DLL load hatası: ${(err as Error).message}`);
      return false;
    }

    try {
      // Callback prototipleri. DLL Windows UTF-16 (wchar_t*) string kullanıyor
      // — Python örneğinde c_wchar_p, C# örneğinde MarshalAs(BStr). koffi'de
      // bu `str16` tipi (NULL-terminated UTF-16 pointer, BSTR-allocated bile olsa
      // null-terminated olduğu için problem değil).
      const CallerIDProto = koffi.proto(
        "void CallerIDFunc(const char16_t* serial, const char16_t* line, const char16_t* phone, const char16_t* dt, const char16_t* other)"
      );
      const SignalProto = koffi.proto(
        "void SignalFunc(const char16_t* model, const char16_t* serial, int s1, int s2, int s3, int s4)"
      );
      const SetEvents = lib.func(
        "void __cdecl SetEvents(CallerIDFunc* cb1, SignalFunc* cb2)"
      );

      this.callerIdCbRef = koffi.register(
        (serial: string | null, line: string | null, phone: string | null, dt: string | null, other: string | null) => {
          this.onCallerId(serial ?? "", line ?? "", phone ?? "", dt ?? "", other ?? "");
        },
        koffi.pointer(CallerIDProto)
      );
      this.signalCbRef = koffi.register(
        (model: string | null, serial: string | null, s1: number, s2: number, s3: number, s4: number) => {
          this.onSignal(model ?? "", serial ?? "", s1, s2, s3, s4);
        },
        koffi.pointer(SignalProto)
      );

      SetEvents(this.callerIdCbRef, this.signalCbRef);

      this.setStatus({
        loaded: true,
        connected: false,
        reason: "Cihaz bekleniyor",
      });
      this.opts.log("[cidshow] SetEvents başarılı, callback'ler kayıtlı");
      return true;
    } catch (err) {
      this.setStatus({
        loaded: false,
        connected: false,
        reason: `SetEvents hatası: ${(err as Error).message}`,
      });
      this.opts.log(`[cidshow] SetEvents hatası: ${(err as Error).message}`);
      return false;
    }
  }

  getStatus(): CidshowStatus {
    return this.status;
  }

  /**
   * Resource layout:
   *   dev:        electron/resources/cidshow/{x64,x86}/cid.dll
   *   packaged:   <resourcesPath>/cidshow/{x64,x86}/cid.dll
   */
  private resolveDllPath(): string | null {
    const archDir = process.arch === "x64" ? "x64" : "x86";
    const root = app.isPackaged
      ? path.join(process.resourcesPath, "cidshow")
      : path.resolve(__dirname, "..", "..", "resources", "cidshow");
    const dll = path.join(root, archDir, "cid.dll");
    return fs.existsSync(dll) ? dll : null;
  }

  /**
   * DLL'in çağırdığı callback. FSK decode noisy olabildiği için aynı çağrıda
   * birden fazla event fire edebilir (partial → full progress). 1500ms tamponla:
   *   - İlk event: timer kurulur, pendingByLine'a yaz
   *   - Aynı hatta sonraki event: phone uzunsa pendingByLine'da değiştir
   *   - Timer dolunca: en son toplananı POST et
   *
   * Bu sayede "163383" (truncated) ve "05455163383" (full) ardışık gelirse
   * sadece "05455163383" POST'lanır — yanlış customer match olmaz.
   */
  private onCallerId(serial: string, line: string, phone: string, dt: string, other: string): void {
    this.opts.log(
      `[cidshow] CallerID event: phone="${phone}" line="${line}" serial="${serial}" dt="${dt}" other="${other}"`
    );

    const lineKey = line || "default";
    const existing = this.pendingByLine.get(lineKey);

    if (existing) {
      // Aynı hatta tampon süresinde tekrar event → daha uzun phone'u tut
      if (phone.length > existing.phone.length) {
        this.opts.log(
          `[cidshow] buffer update line=${lineKey}: "${existing.phone}" → "${phone}" (daha uzun)`
        );
        existing.phone = phone;
        existing.serial = serial;
        existing.dt = dt;
        existing.other = other;
      } else {
        this.opts.log(
          `[cidshow] buffer skip line=${lineKey}: "${phone}" (mevcut "${existing.phone}" daha uzun)`
        );
      }
      return;
    }

    // İlk event — tampon başlat
    const buffered = {
      phone,
      line,
      serial,
      dt,
      other,
      fireAt: Date.now() + this.bufferMs,
    };
    this.pendingByLine.set(lineKey, buffered);
    setTimeout(() => {
      const final = this.pendingByLine.get(lineKey);
      if (!final) return;
      this.pendingByLine.delete(lineKey);
      this.flushBufferedCall(final);
    }, this.bufferMs);
  }

  private flushBufferedCall(buf: {
    phone: string;
    line: string;
    serial: string;
    dt: string;
    other: string;
  }): void {
    // Debounce: aynı (line, phone) 5sn içinde tekrar tetiklenirse atla
    const key = `${buf.line}|${buf.phone}`;
    const now = Date.now();
    if (key === this.lastCallKey && now - this.lastCallAt < this.debounceMs) {
      this.opts.log(`[cidshow] debounce: ${key} (${now - this.lastCallAt}ms önce)`);
      return;
    }
    this.lastCallKey = key;
    this.lastCallAt = now;

    const phoneNorm = buf.phone.trim().length > 0 ? buf.phone.trim() : undefined;
    const lineNumber = parseLineNumber(buf.line);
    this.opts.log(
      `[cidshow] flush: line=${buf.line} phone="${phoneNorm ?? "(yok)"}" — backend POST`
    );

    void this.postIncomingCall({
      phone: phoneNorm,
      lineNumber,
      receivedAt: new Date(now),
      rawDeviceSerial: buf.serial,
      rawDateTime: buf.dt,
      rawOther: buf.other,
    });
  }

  /**
   * Periyodik sinyal kalitesi callback'i — DLL ~1sn'de bir tetikliyor.
   * Cihaz model + seri ilk seferinde gelir; sonraki çağrılar sadece sinyal güncellemesi.
   */
  private onSignal(model: string, serial: string, s1: number, s2: number, s3: number, s4: number): void {
    const wasConnected = this.status.connected;
    const isConnected = model.length > 0 && serial.length > 0;

    if (isConnected !== wasConnected) {
      this.opts.log(
        `[cidshow] connection change: ${wasConnected} → ${isConnected} (model="${model}" serial="${serial}")`
      );
    }

    this.setStatus({
      loaded: true,
      connected: isConnected,
      model: isConnected ? model : undefined,
      serial: isConnected ? serial : undefined,
      signals: [s1, s2, s3, s4],
      reason: isConnected ? undefined : "Cihaz takılı değil",
    });

    // Sinyal seviyeleri çok sık geliyor (saniyede 1+) — kendi IPC channel'ı,
    // ayar panelinde live bar göstergesi için. Diğer pencereler dinlemiyor.
    this.broadcast(IPC_CHANNEL_SIGNALS, {
      model: isConnected ? model : undefined,
      serial: isConnected ? serial : undefined,
      signals: [s1, s2, s3, s4],
    });
  }

  private async postIncomingCall(event: {
    phone?: string;
    lineNumber?: number;
    receivedAt: Date;
    rawDeviceSerial: string;
    rawDateTime: string;
    rawOther: string;
  }): Promise<void> {
    const body = {
      phone: event.phone ?? null,
      lineNumber: event.lineNumber ?? null,
      receivedAt: event.receivedAt.toISOString(),
      rawPayloadHex: null, // DLL ham byte'ları vermiyor, parse'lı veri veriyor
    };

    try {
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
        this.opts.log(
          `[cidshow] backend ${res.status} — çağrı kaydı atlandı (phone=${event.phone ?? "?"} hat=${event.lineNumber ?? "_"})`
        );
        // 401: kullanıcı girişli değil; UI yine toast/modal göstersin diye
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
      this.opts.log(
        `[cidshow] backend POST hatası: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private setStatus(s: CidshowStatus): void {
    this.status = s;
    this.broadcast(IPC_CHANNEL_STATUS, {
      kind: s.connected ? "connected" : s.loaded ? "searching" : "disconnected",
      product: s.model,
      manufacturer: s.connected ? "Cidshow.com" : undefined,
      serial: s.serial,
      reason: s.reason,
      signals: s.signals,
    });
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      win.webContents.send(channel, payload);
    }
  }
}

/**
 * DLL "Line" alanı: tek hatlı cihazda "1", çok hatlıda "1"-"4" veya farklı
 * format ("Line 1", "L1") olabilir. İlk sayıyı çek.
 */
function parseLineNumber(line: string): number | undefined {
  const m = line.match(/(\d+)/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 && n <= 8 ? n : undefined;
}

export const CIDSHOW_IPC = {
  CALL: IPC_CHANNEL_CALL,
  STATUS: IPC_CHANNEL_STATUS,
  SIGNALS: IPC_CHANNEL_SIGNALS,
} as const;
