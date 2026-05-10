/**
 * API_BASE_URL'in runtime detection'ı:
 *
 * - SSR (Node, build / page-data toplama): `process.env.NEXT_PUBLIC_API_BASE_URL`
 *   (Vercel build için cloud API; başka her yerde varsayılan localhost).
 * - Browser (Next standalone içinde, Electron Kasa veya cloud Vercel):
 *   - `localhost` / `127.0.0.1` üzerinde çalışıyorsak → `http://<host>:5000`
 *     (Kasa Electron'da .NET API aynı makinede 5000'de çalışır).
 *   - Aksi halde build-time env (cloud Vercel için `https://api.nodapos.com`).
 *
 * Bu sayede tek frontend build'i hem cloud Vercel'de hem Kasa Electron'unda
 * doğru API'ye işaret eder. NEXT_PUBLIC_API_BASE_URL build-time'da gömülmüş
 * olmasına rağmen, browser'da window kontrolü ile override ediyoruz.
 */
function resolveApiBaseUrl(): string {
  const envValue = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

  if (typeof window === "undefined") {
    // Server-side render. Build sırasında bu çalışır; cloud build env doğru.
    return envValue || "http://localhost:5000";
  }

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return `${window.location.protocol}//${host}:5000`;
  }

  return envValue || `${window.location.protocol}//api.${host}`;
}

export const API_BASE_URL = resolveApiBaseUrl();
