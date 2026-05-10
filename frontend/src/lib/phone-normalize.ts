/**
 * Telefon görüntüleme yardımcısı. Backend (IncomingCallService.NormalizePhone)
 * de aynı kuralı uygular — bu modül sadece UI gösterimi için. Kayıt formatına
 * dokunmaz; "+905551234567" → "+90 555 123 45 67" gibi okunabilir hale getirir.
 */

export function formatPhoneForDisplay(raw: string | null | undefined): string {
  if (!raw) return "—";
  const trimmed = raw.trim();
  // Sadece rakam + baştaki + işareti.
  const digits = trimmed.replace(/[^\d+]/g, "");

  // Türkiye uluslararası: +90 5XX XXX XX XX
  if (digits.startsWith("+90") && digits.length === 13) {
    return `+90 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9, 11)} ${digits.slice(11, 13)}`;
  }
  // Türkiye yerel: 0 5XX XXX XX XX
  if (digits.startsWith("0") && digits.length === 11) {
    return `0${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  }
  // Türkiye yerel kısa: 5XX XXX XX XX
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }
  return trimmed;
}

/**
 * Eşleştirme öncesi normalize: backend ile aynı algoritma (+ ve digits dışındaki
 * her şeyi at). Frontend'de Customer kaydı yaparken kullanılabilir.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (i === 0 && c === "+") out += "+";
    else if (c >= "0" && c <= "9") out += c;
  }
  return out.length === 0 ? null : out;
}
