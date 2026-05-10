# PizzaPos Desktop (Electron)

Offline-first **tek-binary** restoran kasası. Tek `.exe` installer içinde:

- .NET 10 self-contained API (SQLite mode, lokal `pos.db`)
- Next.js 16 standalone frontend (lokal Node sunucusu, browser'a Electron yükler)
- Electron orchestrator: ikisini child process olarak başlatır, kapanışta öldürür

İnternet kesilse bile kasa çalışmaya devam eder. Outbox event'leri arka planda Sync Worker tarafından `https://api.nodapos.com/api/sync/ingest`'a HMAC ile gönderilir, internet gelir gelmez tetiklenir.

## Lokal Geliştirme

```powershell
cd electron
npm install
npm run build         # tsc once

# Backend self-contained .exe (ilk kez veya değişiklikten sonra)
npm run publish-api   # -> resources/api/PizzaPos.Api.exe

# Frontend dev server (ayrı terminalde)
cd ..\frontend
npm run dev           # http://localhost:3000

# Electron'u dev modda başlat (frontend dev server'a bağlanır)
cd ..\electron
npm start
```

## Production — Tek Installer Üretmek

Tek komutla `.exe` installer çıkar:

```powershell
cd electron
npm install         # ilk kez
npm run make        # publish-api + publish-frontend + electron-builder
```

`make` script'i sırayla:

1. `publish-api`   → `resources/api/PizzaPos.Api.exe` (.NET self-contained)
2. `publish-frontend` → `resources/frontend/server.js` (Next standalone + static)
3. `electron-builder` → `dist-installer/PizzaPos-Setup-<version>.exe` (NSIS installer)

Çıkan installer'ı restoran bilgisayarına götür, kur. Masaüstü kısayolu otomatik açılır → API + frontend + Electron birlikte ayağa kalkar.

### Cloud Sync için Env

Kasayı cloud'a bağlamak için Electron'u ilk başlatmadan önce sistem env'lerine:

```powershell
[System.Environment]::SetEnvironmentVariable("PIZZAPOS_CLOUD_URL", "https://api.nodapos.com", "User")
[System.Environment]::SetEnvironmentVariable("PIZZAPOS_HMAC_SECRET", "<64-char-hex>", "User")
```

Boş bırakılırsa kasa tamamen offline çalışır, sync devre dışıdır (loglarda `SyncWorker disabled` yazar).

## Logs / Data

- Userdata kökü: `%APPDATA%\PizzaPos\` (Windows)
- SQLite DB: `<userData>\pos.db`
- JWT secret: `<userData>\auth.json` (otomatik üretilir, 0o600 perm)
- Log: `<userData>\logs\main.log` — API stdout/stderr + frontend stdout/stderr + Electron olayları tek dosyada

## Mimari

```
[Electron main process]
   ├─ spawn PizzaPos.Api.exe ── HTTP :5000 (SQLite)
   │       └─ SyncWorker → Cloud /api/sync/ingest (HMAC)
   ├─ spawn node server.js   ── HTTP :3000 (Next standalone)
   │       └─ runtime API URL = http://localhost:5000 (lib/env.ts)
   └─ BrowserWindow.loadURL(http://127.0.0.1:3000)
```

`before-quit` event'i her iki child process'i sıralı kill eder (önce SIGTERM, 5sn sonra SIGKILL).

## Cookie / Auth Notu

Backend `AuthCookie` artık `request.IsHttps`'e bakıyor:

- Cloud (HTTPS) → `SameSite=None + Secure` (cross-subdomain için)
- Kasa (HTTP localhost) → `SameSite=Lax` (Secure kullanılamaz HTTP'de)

Aynı backend binary hem cloud hem kasa için çalışır.

## Tek-yazan-kasa Modeli

Kasa: Orders, Payments, Customers/Addresses → cloud'a aktarılır
Cloud: Products, Categories, Combos, Tables, Users → kasaya pull edilir
