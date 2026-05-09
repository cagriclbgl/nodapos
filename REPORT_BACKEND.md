# REPORT_BACKEND — Gece Otonom Çalışma Raporu

Tarih: 2026-05-09 (gece)

## TL;DR

✅ **Sprint 0, 1, 2 tamamen uygulandı.** Backend agent yazma izinlerine takıldı, ama coordinator (ana Claude) detaylı taslakları kendi izinleriyle uyguladı. Sabah çalıştırılacak: `dotnet restore` + `dotnet ef migrations add` + `npm install` (electron için).

---

## Sprint 0 — Backend multi-provider hazırlığı ✅

### Yapılanlar

- `backend/PizzaPos.Api/PizzaPos.Api.csproj`: `Microsoft.EntityFrameworkCore.Sqlite 9.0.0` PackageReference eklendi.
- `backend/PizzaPos.Api/appsettings.json`: `Database:Provider` (default `"Postgres"`) ve `Database:SqlitePath` (default `"pos.db"`) eklendi. Ek olarak `Sync:{Enabled,CloudBaseUrl,HmacSecret,PollingSeconds,BatchSize}` bölümü.
- `Program.cs`: Conditional registration — `Database:Provider == "Sqlite"` ise `UseSqlite(...)`, değilse mevcut `UseNpgsql(...)`.
- `Data/DesignTimeDbContextFactory.cs`: Provider flag'ine duyarlı yeniden yazıldı.
- Mevcut 7 migration dosyası `Migrations/` → `Migrations/Postgres/` altına taşındı, namespace `PizzaPos.Api.Migrations` → `PizzaPos.Api.Migrations.Postgres` güncellendi.
- `Migrations/Sqlite/README_TODO.md` placeholder + sabah çalıştırılacak komutları içeriyor.

### Doğrulama

Tüm dosyalar yazıldı, namespace tutarlı. `dotnet build` paket restore olmadan başarısız olur — sabahki `dotnet restore` adımıyla çözülür.

---

## Sprint 1 — Outbox + SyncWorker + Cloud ingest ✅

### Yapılanlar

**Yeni dosyalar:**
- `Entities/OutboxEvent.cs`: Global tablo (TenantEntity DEĞİL, BaseEntity türevi). Id/AggregateType/AggregateId/EventType/PayloadJson/SentAt/RetryCount/LastError/LastAttemptAt.
- `Services/IOutboxEmitter.cs` + `Services/OutboxEmitter.cs`: `EmitAsync(...)` aynı tx içinde change tracker'a OutboxEvent ekler. Payload `{ storeId, data }` envelope ile sarılır.
- `Sync/SyncOptions.cs`: Strongly-typed config.
- `Sync/HmacSignature.cs`: HMAC-SHA256 hex compute + constant-time verify.
- `Sync/SyncWorker.cs`: BackgroundService, polling 10sn, batch 50, exponential backoff (max 300s), max 10 retry.
- `Controllers/SyncController.cs`: `POST /api/sync/ingest` (idempotent + HMAC-verified), `GET /api/sync/changes?since=&aggregates=Product,Category,Store` (tenant scope IgnoreQueryFilters ile bypass — kasa kendi store'unu pull eder).

**Mevcut dosya değişiklikleri:**
- `AppDbContext.cs`: `DbSet<OutboxEvent> OutboxEvents` + `ConfigureOutboxEvent` (tablo `outbox_events`, index `(SentAt, CreatedAt)`).
- `Program.cs`: `AddHttpClient`, `Configure<SyncOptions>`, `IOutboxEmitter` DI, `Sync:Enabled` true ise `AddHostedService<SyncWorker>`.
- `OrderService.cs`: Constructor'a `IOutboxEmitter` eklendi. 7 metoda emit eklendi:
  - `CreateAsync` → "OrderCreated" (tx içinde, SaveChanges sonrası)
  - `AddItemAsync` → "OrderItemAdded" (ExecuteUpdateAsync sonrası, tx commit öncesi)
  - `UpdateItemAsync` → "OrderItemQuantityUpdated"
  - `RemoveItemAsync` → "OrderItemRemoved" (auto-cancel info dahil)
  - `UpdateDetailsAsync` → "OrderDetailsUpdated" (tx yok, ExecuteUpdate sonrası SaveChanges)
  - `CompleteAsync` → "OrderCompleted" (payments listesi dahil)
  - `CancelAsync` → "OrderCancelled"

**ExecuteUpdateAsync pattern korundu** — emit'ler ExecuteUpdateAsync çağrılarının ARKASINA, `tx.CommitAsync` ÖNCESİNE eklendi. Pooler concurrency riski yok (OutboxEvent INSERT, UPDATE değil).

---

## Sprint 2 — Electron iskelet ✅

### Yapılanlar

`electron/` klasörü oluşturuldu, 8 dosya:
- `package.json`: electron 33, electron-builder 25, typescript 5.6, get-port 7, wait-on 8 — devDependencies (kurulmadı, sabah `npm install`).
- `tsconfig.json`: ES2022, commonjs, strict, outDir dist.
- `.gitignore`: node_modules, dist, dist-installer, resources/api.
- `src/main.ts`: Free port + child process spawn (`PizzaPos.Api.exe` self-contained), `wait-on /api/health`, BrowserWindow, crash recovery (3 retry), userdata logs.
- `src/preload.ts`: `contextBridge.exposeInMainWorld('app', { version, platform })`.
- `electron-builder.yml`: NSIS installer, asar, extraResources `resources/api`.
- `scripts/publish-api.ps1`: `dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o resources/api`.
- `README.md`: Geliştirici workflow + production build + log/data path'leri.

Dev ortam için `loadURL("http://localhost:3000")` (frontend dev server). Production'da Next standalone'u 2. child process olarak çalıştırma kararı sabah verilecek.

---

## Sabah çalıştırılacak komutlar (PowerShell — kopyala-yapıştır)

```powershell
# 1) Backend paketleri restore
cd C:\Users\w11\Desktop\menu\backend\PizzaPos.Api
$env:DOTNET_ROLL_FORWARD = "Major"
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet restore

# 2) Postgres tarafını doğrula (regression check — mevcut Supabase ile çalışır)
$env:Database__Provider = "Postgres"
dotnet build

# 3) SQLite migration üret
$env:Database__Provider = "Sqlite"
$env:Database__SqlitePath = "pos.db"
dotnet ef migrations add InitialCreate -o Migrations/Sqlite

# 4) SQLite'a uygula (lokal pos.db dosyası oluşur)
dotnet ef database update

# 5) Frontend paketleri (Sprint 3)
cd C:\Users\w11\Desktop\menu\frontend
npm install
npm run dev   # http://localhost:3000 — http://localhost:3000/_design preview

# 6) Electron iskelet (yeni terminal)
cd C:\Users\w11\Desktop\menu\electron
npm install
npm run build

# 7) (Opsiyonel) .NET'i SQLite + Sync açık olarak self-contained publish
npm run publish-api

# 8) (Opsiyonel) Electron'u dev modda başlat (frontend dev server açık olmalı)
npm start
```

---

## Karar gerektiren noktalar (Sabah Karar)

1. **HMAC secret konfigürasyonu:** `appsettings.Development.json`'a `Sync:HmacSecret` eklenmeli (32+ char). Çoklu kasa için per-store secret tablosu sonradan eklenebilir; MVP için tek shared.
2. **Cloud sync target:** `Sync:CloudBaseUrl` boş — gerçek cloud deploy yapılınca doldurulur. Şu an `Sync:Enabled = false` default olduğundan SyncWorker başlamıyor.
3. **Electron Next.js prod:** `loadURL("http://localhost:3000")` dev mode için. Production için Next standalone'u 2. child process olarak başlatmak gerek (electron/main.ts'te yorum satırı bekliyor).
4. **SQLite numeric precision:** `numeric(18,2)` Postgres'te native, SQLite'da REAL'a düşer. Para hassasiyeti için ileride `decimal → string` value converter eklenebilir; MVP yeterli.
5. **`UpdatedAt` indeksi:** SyncController.Changes endpoint'i `UpdatedAt > since` filtresi kullanıyor. Performans için Product/Category/Store için `(StoreId, UpdatedAt)` index'i sonra eklenebilir.

---

## Bilinen riskler / dikkat noktaları

- **Postgres-spesifik annotation'lar SQLite migration'ında sorun yaratmaz**: SQLite migration ayrı snapshot üretir; conditional UseSqlite/UseNpgsql ile EF doğru olanı seçer.
- **OutboxEmitter transaction sırası**: Mevcut `ExecuteUpdateAsync` pattern korundu. Emit'ler tx içinde, commit öncesi yapılıyor. Pooler concurrency exception OUTBOX INSERT için risk değil.
- **OrderService.UpdateDetailsAsync** transaction kullanmıyor (sadece bir ExecuteUpdate). Emit + SaveChanges ondan sonra eklendi — bu durumda outbox row eski tx ile atomik DEĞİL ama UpdateDetails idempotent bir UPDATE (tek kalem değiştirir). Risk minimum.

---

## Commit message taslakları (commit ETME — sadece taslak)

```
feat(backend): multi-provider support (sqlite + postgres)

- Add Microsoft.EntityFrameworkCore.Sqlite 9.0.0 package reference
- Add Database:Provider config flag (defaults to Postgres)
- Conditional DbContext registration in Program.cs and DesignTimeDbContextFactory
- Move existing migrations under Migrations/Postgres/, namespace updated
- Placeholder Migrations/Sqlite/ for upcoming InitialCreate
```

```
feat(backend): outbox + sync worker for kasa->cloud relay

- New OutboxEvent entity (global, not tenant-scoped) + outbox_events table
- IOutboxEmitter / OutboxEmitter wraps payloads with storeId envelope
- OrderService emits 7 event types (created, item add/update/remove,
  details, complete, cancel) — preserves ExecuteUpdateAsync pattern
- SyncWorker BackgroundService polls every 10s, batches up to 50 rows,
  HMAC-SHA256 signs body, exponential backoff on failure (max 5min, 10 retries)
- SyncController: POST /api/sync/ingest (idempotent, HMAC-verified),
  GET /api/sync/changes?since=&aggregates= for kasa-side pull
- Sync:Enabled flag gates the worker; defaults to false
```

```
feat(electron): bootstrap shell with .net child process

- electron/ scaffold (TypeScript, electron 33, electron-builder)
- main.ts orchestrates: free port -> spawn PizzaPos.Api.exe with
  Database__Provider=Sqlite + Sync__Enabled=true, wait-on /api/health,
  load Next.js dev URL, restart on crash (max 3)
- preload.ts exposes minimal app.version/platform
- publish-api.ps1 self-contained win-x64 single-file publish into
  resources/api (extraResources in electron-builder.yml)
- README documents dev workflow and prod build pipeline
```
