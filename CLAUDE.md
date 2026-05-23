# NodaPos — Pizza POS

Restoranlar için (öncelikle pizza dükkanı) **hibrit POS sistemi**: kasa = Electron + lokal SQLite (offline-first primary store), bulut = Hetzner Postgres + Next.js admin paneli. Kasa → bulut tek yönlü outbox sync; menü/ürün/kullanıcı yazımı sadece cloud admin'den, kasada read-only.

## Teknoloji Yığını

- **Backend:** .NET 10 Web API, EF Core 9, multi-provider (`Database:Provider` = `Postgres` | `Sqlite`).
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui (brand orange-600).
- **Desktop kasa:** Electron 33, Windows NSIS .exe (electron-builder), tek installer içinde .NET API + Next.js standalone iki child process.
- **Cloud altyapı:** Hetzner Ubuntu 24.04 (IP `178.104.44.239`), Docker Compose ile: `postgres:16-alpine` + `pizzapos-api` (.NET 10) + `caddy:2-alpine` (Let's Encrypt auto-SSL). Domain: `api.nodapos.com` (Cloudflare DNS).
- **Frontend host:** Vercel (`nodapos.com` admin paneli).

**Önemli:** Supabase artık KULLANILMIYOR. Eski commit'lerde/migration history'sinde "Supabase" geçiyor olabilir — şu an cloud = Hetzner.

## Kritik İş Kuralları

- **Snapshot logic:** Order yaratılırken `OrderItem` tablosuna `ProductName`, `UnitPrice`, `LineTotal`; `OrderItemOption`'a `GroupName`, `OptionName`, `AdditionalPrice` kopyalanır. Sonraki fiyat/menü değişiklikleri geçmişi etkilemez.
- **Paket servis fiyat ayrımı (2026-05-22):** `Product.DeliveryPrice` (base) + `ProductOption.DeliveryAdditionalPrice` (boyut/ekstra ek fiyatı) + `Combo.DeliveryPrice` — hepsi nullable, null ise normal fiyata fallback. `OrderType.Delivery`'de `OrderService.EffectivePrice` / `EffectiveOptionPrice` / `EffectiveComboPrice` helper'ları snapshot'larda doğru fiyatı seçer. Gel-al (Takeaway) ve dine-in her zaman normal fiyatı kullanır. Admin product-options-editor satırlarında her option için iki ayrı input: `+Gel-Al` ve `+Paket` (boş = gel-al'a fallback). Frontend'te `OptionsDialog` prop'ları (`effectivePrice`, `resolveOptionPrice`) ile çağıran ekran sipariş tipine göre doğru fiyatı geçirir; masa ekranı default'a (product.price + option.additionalPrice) düşer.
- **Multi-tenancy:** Her tabloda `StoreId`, `AppDbContext` reflection ile otomatik Global Query Filter uygular.
- **Audit:** `Order.CreatedByUserId`, `Payment.CreatedByUserId` (FK yok, kullanıcı silinse de tutulur).
- **EF Core + Postgres pooler kuralı:** `OrderService.AddItemAsync` / `CompleteAsync` / `CancelAsync` change-tracker UPDATE yerine **`ExecuteUpdateAsync`** kullanır (tracker UPDATE pooler altında `DbUpdateConcurrencyException (0 rows affected)` veriyor). Yeni Order alanları eklenirse aynı pattern korunmalı.

## Sync Mimarisi (Outbox)

- **Kasa → Cloud (push):** `OutboxEvent` entity her write transaction'ında emit edilir. `SyncWorker` BackgroundService 10 sn polling, batch 50, HMAC-SHA256 imzalı `POST /api/sync/ingest`, idempotent (`OutboxEvent.Id` cloud'da unique).
- **Cloud → Kasa (pull):** `SyncPullWorker` 30 sn polling, `GET /api/sync/changes?since=&aggregates=Product,Category,Store,User,Customer,CustomerAddress`.
- **Single-writer per domain:** Orders/Payments/IncomingCalls kasada yazılır; Products/Categories/Users/Store ayarları cloud admin'de yazılır. Çakışma engine'i yok.
- **Customer çift yönlü:** `UpdatedAt` ile last-writer-wins.
- **Bootstrap:** Yeni kasa ilk açılışta splash + full pull (`since=null`), tüm menü+kullanıcı+müşteri inene kadar UI hazır demez.

## Operasyonel Notlar

**.NET runtime (lokal makinede sadece .NET 8 ve 10 kurulu):**
```powershell
$env:DOTNET_ROLL_FORWARD = "Major"
$env:ASPNETCORE_ENVIRONMENT = "Development"
```
Her `dotnet run` ve `dotnet ef` komutundan önce. Hetzner Docker image'ı net10 olduğu için orada gerek yok.

**Database provider switch:**
```powershell
# Postgres (cloud / dev local)
$env:Database__Provider = "Postgres"   # default
# SQLite (offline kasa — Electron child process otomatik bunu set eder)
$env:Database__Provider = "Sqlite"
$env:Database__SqlitePath = "pos.db"
```
Migration üretimi: Postgres → `Migrations/Postgres/`, SQLite → `Migrations/Sqlite/`. SQLite migration üretirken Postgres-specific Npgsql annotation'lar kaybolma riski var → `Migrations/Postgres/AppDbContextModelSnapshot.cs`'i önce yedekle.

**Migration snapshot drift uyarısı:** `AppDbContextModelSnapshot.cs` model'in gerisinde kalmış (`DeliveryPrice`, combos table, `StoreId1` shadow drop'ları, vs. snapshot'a yansımamış). `dotnet ef migrations add` çağırırsan kümülatif diff oluşturur ve canlı DB'ye uygulanmaz olur. **Pattern:** Yeni kolon eklerken otomatik scaffolder'ı kullanma — `AddDeliveryPrice` / `AddDeliveryAdditionalPriceToProductOption` örneklerindeki gibi manuel migration .cs dosyası yaz (`migrationBuilder.Sql` ile `ADD COLUMN IF NOT EXISTS`), yanına `XX.MANUAL.sql` koy, SQLite tarafı için `Program.cs` schema bootstrap'ında `TryAddColumn(...)` satırı ekle. Postgres tarafında `Database.MigrateAsync()` `__EFMigrationsHistory`'ye bakıp idempotent uygular.

**Hetzner / Docker deploy:**
- SSH ile Hetzner kutusuna bağlan, `docker compose up -d` ile postgres + pizzapos-api + caddy ayağa kalkar.
- `docker compose logs -f pizzapos-api` — backend log
- `docker compose logs -f postgres` — DB log
- Caddy Let's Encrypt sertifikalarını otomatik yönetir; DNS değişikliği Cloudflare panelinden.
- Env var'lar `docker-compose.yml` veya `.env` dosyasında: `ConnectionStrings__Default`, `Sync__HmacSecret`, `Auth__Jwt__Secret`.
- Backup: `postgres:16-alpine` volume `pg_data` — periyodik dump alınmalı (henüz cron yok).
- **Volume snapshot tek seferlik:** `docker run --rm -v cloud_pizzapos-pgdata:/data:ro -v /root:/backup alpine tar czf /backup/pgdata-$(date +%Y%m%d-%H%M).tar.gz -C /data .`

**DBeaver ile cloud DB erişimi (SSH tunnel):**
- Önkoşul: `docker-compose.yml`'de postgres servisinde `ports: - "127.0.0.1:5432:5432"` olmalı (sadece host localhost'una bind, internete kapalı). UFW'de 5432 izni **olmamalı**.
- Credentials: `grep POSTGRES /opt/pizzapos/cloud/.env` veya `docker exec pizzapos-postgres env | grep POSTGRES`.
- DBeaver → New Connection → PostgreSQL:
  - Main: Host=`localhost`, Port=`5432`, Database/User/Password = .env değerleri
  - SSH: Host=`178.104.44.239`, User=`root`, Authentication = Password (veya Public Key + key path)
- Main'deki `localhost:5432` Hetzner perspektifinden; DBeaver kendi başına random lokal port seçer, lokal makinedeki başka Postgres (5432'de) ile çakışmaz.
- Geçmiş tuzak: doğrudan `docker run -p 5432:5432 ...` ile postgres'i compose dışına çıkarmayın — compose network kaybolur, DNS resolution patlar, API 500 döner.

**Cloudflare:** `nodapos.com` (Vercel) + `api.nodapos.com` (Hetzner) DNS. SSL/TLS modu "Full (strict)" — Caddy Let's Encrypt sertifikası sunar.

**Lokal çalıştırma:**
```powershell
# Backend (Postgres / dev → Hetzner DB'sine bağlanır)
cd C:\Users\w11\Desktop\menu\backend\PizzaPos.Api
$env:DOTNET_ROLL_FORWARD = "Major"; $env:ASPNETCORE_ENVIRONMENT = "Development"; $env:Database__Provider = "Postgres"
dotnet run
# → http://localhost:5000/swagger

# Frontend (ayrı terminal)
cd C:\Users\w11\Desktop\menu\frontend
npm run dev
# → http://localhost:3000

# Electron kasa
cd C:\Users\w11\Desktop\menu\electron
npm run dev          # TypeScript watch (electron/src → dist)
npm run start        # dev mode — electron .
npm run publish-all  # SADECE resources doldur: publish-api + publish-frontend
npm run make         # TAM build: build (tsc) + publish-all + electron-builder NSIS .exe
npm run hid-probe    # Caller ID reverse-engineering aracı (CLI)
```

**Connection string** `appsettings.Development.json`'da (gitignore'da, repo'da yok). Hetzner Postgres'e bağlanır.

## Dosya Haritası (özet)

```
backend/PizzaPos.Api/
├── Entities/         Store, Table, Category, Product, ProductOption, Order, OrderItem,
│                     OrderItemOption, Payment, User, Customer, CustomerAddress,
│                     OutboxEvent, SyncState, Combo+ComboItem, IncomingCall
├── Data/             AppDbContext (multi-provider + Global Query Filter)
│                     SessionTenantProvider (JWT claim), HeaderTenantProvider
├── Auth/             JwtTokenService (MapInboundClaims=false), BCryptPasswordHasher,
│                     AuthCookie (IsHttps-aware: cloud=None+Secure, kasa=Lax)
├── Sync/             SyncWorker (push 10sn), SyncPullWorker (pull 30sn),
│                     HmacSignature, IngestApplyService
├── Controllers/      Health, Stores, Tables, Categories, Products, Orders (+combos),
│                     Auth, Users, Customers, CustomerAddresses, Combos,
│                     IncomingCalls, Sync
├── Migrations/Postgres/  InitialCreate, AddUsersAndAuditUser, AddCustomersAndOutbox,
│                         AddSyncStates, AddOutboxApplyTracking, AddCombos,
│                         AddIncomingCallsAndDeliveryFields
└── Migrations/Sqlite/    kasa için (README_TODO.md)

electron/
├── src/main.ts                  iki child process (API + Next standalone),
│                                wait-on health, crash recovery (max 3)
├── src/preload.ts               contextBridge: window.callerId.*
├── src/hid/caller-id-listener.ts   VID 0x1A86 PID 0xE008 auto-discover
├── src/hid/parsers/wch-1a86-e008.ts   Cidshow C812A parser
├── src/services/incoming-call-bridge.ts   backend POST + IPC
├── src/scripts/hid-probe.ts     RE aracı
├── scripts/publish-api.ps1      .NET self-contained win-x64 single-file
├── scripts/publish-frontend.ps1 Next standalone → resources/frontend/
└── electron-builder.yml         NSIS, asar + asarUnpack (node-hid/usb)

frontend/src/
├── app/admin/                   layout (sidebar), KPI dashboard, categories, tables,
│                                products (+product-options-editor: Boyut/Ekstra preset),
│                                orders, users, customers, combos, calls,
│                                settings/caller-id
├── app/pos/                     layout (AuthGuard Cashier + IncomingCallProvider),
│                                masa ızgarası, table/[id] (order-screen, options/payment/
│                                details dialog, combo-picker), delivery/new, calls
├── app/print/                   receipt/[orderId], courier-slip/[orderId] (80mm)
├── app/supervisor/              login, registrations (approve + random parola)
├── components/                  AuthGuard, UserMenu, CustomerSearch,
│                                incoming-call/IncomingCallModal,
│                                ui/ (eski Modal/Button/Input/Card/Select),
│                                ui-v2/ (shadcn primitives)
├── lib/                         api (credentials: include, X-Store-Id), env (runtime
│                                API URL detect), auth-context, phone-normalize
└── types/                       api.ts (DTO mirror), electron.d.ts (window.callerId)
```
