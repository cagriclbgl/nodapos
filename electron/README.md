# PizzaPos Desktop (Electron)

Offline-first desktop shell. Wraps the .NET backend (SQLite mode) and the Next.js frontend in a single Electron window. Outbox events are relayed to the cloud Supabase mirror by the SyncWorker hosted in the .NET process.

## Dev workflow

```powershell
cd electron
npm install
npm run build         # tsc once
npm run dev           # tsc --watch (ayrı terminal)

# Backend'i SQLite modunda önce publish et:
npm run publish-api   # -> resources/api/PizzaPos.Api.exe

# Frontend dev server'ı ayrı terminalde çalışmalı:
cd ..\frontend
npm run dev           # http://localhost:3000

# Electron'u başlat:
cd ..\electron
npm start             # PIZZAPOS_DEV_URL ile farklı URL set edebilirsin
```

## Production build

```powershell
npm run publish-api
npm run build
npm run make          # NSIS installer dist-installer/
```

## Logs / data

- Userdata: `%APPDATA%\PizzaPos\` (Windows)
- Database: `<userData>\pos.db`
- Logs: `<userData>\logs\main.log`

## Mimari

```
[Electron main]
    spawns -> PizzaPos.Api.exe (Sqlite + Sync worker)
    loads  -> http://localhost:3000 (Next.js dev) / http://127.0.0.1:<port> (prod)
                               |
                               v
                    Outbox -> Cloud /api/sync/ingest (HMAC)
```

Tek-yazan-kasa modeli: kasa Orders/Payments yazar, cloud admin Products/Categories/Settings yazar. Pull tarafı `/api/sync/changes` üzerinden 30sn'de bir taranır.
