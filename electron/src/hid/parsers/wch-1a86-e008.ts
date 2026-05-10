/**
 * WCH (VID 1A86, PID E008) 4 hatlı USB HID Caller ID box parser — STUB.
 *
 * Protokol kapalı. `hid-probe.ts` ile cihaz çalarken ham raporu yakaladıktan
 * sonra burayı doldur. Şu an her gelen rapor için "unknown" event üretir;
 * listener bu event'i tek başına backend'e POST etmez, yalnızca debug log'a
 * + IPC ile renderer'a (test paneli aktifse) iletir.
 *
 * Tipik HID Caller ID raporu deseni:
 *   [reportId, line, eventCode, d0, d1, ..., dN, checksum?]
 *   - eventCode: 0x01=RING, 0x02=NUMBER (BCD packed digits), 0x03=END
 * VEYA
 *   ASCII payload: "RING\r" + "NMBR=05551234567\r" + "END\r"
 *
 * Doldururken yapılacaklar:
 *  1. report id varsa atla (Buffer[0])
 *  2. event code byte'ından "ring" / "number" / "end" ayır
 *  3. line byte'ı varsa lineNumber'a koy
 *  4. number digit'lerini BCD veya ASCII'den çıkar — uyguladığın yorum şekli
 *     hangi protokole uyduğuysa
 *  5. ParsedCallerIdEvent döner; partial state için sınıf field'ları kullan
 */

import type { CallerIdParser, ParsedCallerIdEvent } from "../types";

export class Wch1A86E008Parser implements CallerIdParser {
  readonly name = "wch-1a86-e008";

  // Ring tetiklenmişse line + zaman tutulur, numara raporuyla birleştirilir.
  private pendingRing: { lineNumber?: number; receivedAt: Date } | null = null;

  initialize(write: (bytes: number[]) => void): void {
    // Bazı WCH HID cihazları açılışta wakeup feature reportu bekler. Probe
    // sırasında demo exe'nin USB trafiği görüldükten sonra burası doldurulur.
    // Şu an no-op — cihaz default mode'da rapor yayınlamıyorsa burayı eklemek
    // gerekecek.
    void write;
  }

  feed(reportBytes: Buffer): ParsedCallerIdEvent | undefined {
    const rawHex = reportBytes.toString("hex");

    // TODO(protocol): aşağıdaki blok "unknown" event üreterek probe sırasında
    // raporları görünür kılıyor. Protokol netleşince burayı gerçek parse
    // mantığıyla değiştir; ring/number birleştirme örneği `combine()` helper'ında.
    return {
      type: "unknown",
      receivedAt: new Date(),
      rawHex,
    };
  }

  reset(): void {
    this.pendingRing = null;
  }

  /**
   * Ring + Number raporları ayrı geldiğinde çağrıları birleştirme yardımcısı.
   * Gerçek protokol ortaya çıktığında feed() bu helper'ı çağırır.
   */
  protected combine(
    line: number | undefined,
    phone: string,
    rawHex: string
  ): ParsedCallerIdEvent {
    const ring = this.pendingRing;
    this.pendingRing = null;
    return {
      type: "number",
      phone,
      lineNumber: line ?? ring?.lineNumber,
      receivedAt: ring?.receivedAt ?? new Date(),
      rawHex,
    };
  }

  /**
   * BCD packed digit decoder — birçok HID Caller ID kutusu numarayı 4-bit
   * nibble'lar olarak gönderir. Örn: 0x12 0x34 0x56 → "123456". 0xF nibble
   * "padding" anlamına gelir (numara tek haneliyse).
   */
  protected decodeBcd(bytes: Buffer, offset: number, length: number): string {
    let out = "";
    for (let i = 0; i < length; i++) {
      const b = bytes[offset + i];
      const high = (b >>> 4) & 0xf;
      const low = b & 0xf;
      if (high <= 9) out += String(high);
      if (low <= 9) out += String(low);
    }
    return out;
  }
}

export default Wch1A86E008Parser;
