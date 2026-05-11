/**
 * Kopya bu dosyayı `config.ts` olarak kaydet ve gerçek değerleri yaz.
 * `config.ts` gitignored — repo'ya checkin EDİLMEMELİ.
 *
 * Production binary'sine bake edilecek değerler:
 * - CLOUD_API_BASE_URL: Hetzner cloud API'sinin public adresi.
 * - HMAC_SECRET: cloud Sync__HmacSecret ile aynı 32-byte hex string.
 */
export const CLOUD_API_BASE_URL = "https://api.nodapos.com";
export const HMAC_SECRET = "<openssl rand -hex 32 ile uret, ayni degeri Hetzner Sync__HmacSecret env'ine de yaz>";
