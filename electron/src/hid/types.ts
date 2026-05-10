/**
 * Caller ID HID listener — paylaşılan tipler.
 *
 * Cihaz: WCH (1A86) PID 0xE008 — 4 hatlı USB HID Caller ID box.
 * Protokol kapalı; gerçek byte düzenini `hid-probe.ts` ile çıkardıktan sonra
 * `parsers/wch-1a86-e008.ts` STUB'unu doldur.
 */

export const TARGET_VENDOR_ID = 0x1a86;
export const TARGET_PRODUCT_ID = 0xe008;

/**
 * Parser'ın HID input report'undan çıkardığı çağrı eventi. Telefon numarası
 * "bilinmiyor" olarak gelebilir (gizli numara, ID alma süresi yetmedi vb.).
 */
export interface ParsedCallerIdEvent {
  /**
   * Olay tipi — parser ne çıkardı.
   *  - "ring": telefon çalıyor; numara henüz hazır değil olabilir
   *  - "number": numara teslim edildi (tek başına ya da ring'le birlikte)
   *  - "end": çağrı sonlandı (raw'da varsa)
   *  - "unknown": parser tanımadığı bir frame (debug için ham raporu birlikte yolla)
   */
  type: "ring" | "number" | "end" | "unknown";

  /** Normalize edilmemiş ham telefon numarası (parser'ın çıkardığı şekilde). */
  phone?: string;

  /** Çok hatlı kutuda hangi hat (1..N). Tek hatlı kutu için undefined. */
  lineNumber?: number;

  /** Olayın yaklaşık zamanı (parser bilmiyorsa Date.now). */
  receivedAt: Date;

  /** Ham hex (debug + cevapsız çağrı sebep analizi). */
  rawHex: string;
}

/**
 * Parser sözleşmesi: bir HID input report buffer'ı al, varsa anlamlı bir event
 * üret. Tek bir çağrı için birden fazla raporun gelmesi olasılığı var (ring +
 * number gibi); parser stateful olabilir, bu yüzden interface bir factory döner.
 */
export interface CallerIdParser {
  readonly name: string;
  /**
   * Bir HID raporunu işle. Olay üretilirse döner; ring tetiklemiş ama numara
   * henüz hazır değilse undefined döner ve numara raporu geldiğinde event çıkar.
   */
  feed(reportBytes: Buffer): ParsedCallerIdEvent | undefined;
  /** Cihaz açılışında bir defa çalışır — gerekiyorsa wakeup feature reportu yollar. */
  initialize?(write: (bytes: number[]) => void): void;
  /** İç state'i sıfırla (cihaz reset / reconnect sonrası). */
  reset?(): void;
}

/**
 * Listener'ın main process içindeki olay yayınları. EventEmitter tarzı.
 */
export interface CallerIdListenerEvents {
  call: (event: ParsedCallerIdEvent) => void;
  raw: (hex: string) => void;
  status: (status: CallerIdStatus) => void;
  error: (err: Error) => void;
}

export type CallerIdStatus =
  | { kind: "disconnected"; reason?: string }
  | { kind: "searching" }
  | { kind: "connected"; product?: string; manufacturer?: string; serial?: string }
  | { kind: "test-mode" }; // ayar paneli "Test" tıkladığında ham hex akar
