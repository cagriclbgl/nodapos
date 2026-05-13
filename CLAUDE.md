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
- **Multi-tenancy:** Her tabloda `StoreId`, `AppDbContext` reflection ile otomatik Global Query Filter uygular.
- **Audit:** `Order.CreatedByUserId`, `Payment.CreatedByUserId` (FK yok, kullanıcı silinse de tutulur).
- **EF Core + Postgres pooler kuralı:** `OrderService.AddItemAsync` / `CompleteAsync` / `CancelAsync` change-tracker UPDATE yerine **`ExecuteUpdateAsync`** kullanır (tracker UPDATE pooler altında `DbUpdateConcurrencyException (0 rows affected)` veriyor). Yeni Order alanları eklenirse aynı pattern korunmalı.

## Sync Mimarisi (Outbox)

- **Kasa → Cloud (push):** `OutboxEvent` entity her write transaction'ında emit edilir. `SyncWorker` BackgroundService 10 sn polling, batch 50, HMAC-SHA256 imzalı `POST /api/sync/ingest`, idempotent (`OutboxEvent.Id` cloud'da unique).
- **Cloud → Kasa (pull):** `SyncPullWorker` 30 sn polling, `GET /api/sync/changes?since=&aggregates=Product,Category,Store,User,Customer,CustomerAddress`.
- **Single-writer per domain:** Orders/Payments/IncomingCalls kasada yazılır; Products/Categories/Users/Store ayarları cloud admin'de yazılır. Çakışma engine'i yok.
- **Customer çift yönlü:** `UpdatedAt` ile last-writer-wins.
- **Bootstrap:** Yeni kasa ilk açılışta splash + full pull (`since=null`), tüm menü+kullanıcı+müşteri inene kadar UI hazır demez.

---

## ÖNCELİK 1 — Caller ID Parser (Cidshow C812A)

**Durum:** Cihaz fiziksel olarak takılı, sistemde "Bağlı" görünüyor, test çağrısı tetikleniyor. Parser hâlâ STUB. En büyük açık iş.

**Cihaz bilgisi:**
- VID:PID = `1a86:e008` (WCH/QinHeng HID-based serial adapter)
- Üretici: Cidshow.com, Ürün: C812A, Seri: 922FB1623
- Fiziksel olarak USB-Serial çevirici, gerçek Caller ID modülü içeride serial üzerinden konuşuyor. Payload muhtemelen length-prefixed serial stream.

**Ham veri örneği (idle):**
```
251302911873c41fa3fa6cc097708b457667630e0cc78b1508f98b4f8fdb56cfd2a9f524b6fea57700ff7d54f9a8941
2c6b5d1396f2289f077c94dc872b2f1a33269a2b8fea58c75fc9e31d1d128fb74dd0d867296bfbcef6189b5320132a0d
```
- **Gerçek frame boyutu: 64 byte** (2026-05-13 kayıt analizinden — eski 48 byte tahmini yanlıştı)
- ~500 frame/sn sabit hız (USB HID polling, event-driven değil)
- Ortalama entropy ~2.6 bit/pos (constrained value set, random değil ama yapılandırılmış)
- **2026-05-13 RING testi sonucu:** Idle ve RING1/RING2 fazları arasında byte dağılımı, entropy ve frame imzaları **aynı**. RING marker'ından önce ve sonra cihaz aynı heartbeat'i yolluyor. Hatta numara verisi gelmiyor.
- En olası neden: operatörden "arayan numara gösterme" servisi aktif değil (TR Caller ID Type II). İkinci olası: cihaz init komutu bekliyor (vendor-specific HID feature report).

**Açık kaynak parser yok** — reverse engineer etmemiz lazım.

**Onaylanan plan (2026-05-13):**

1. **Test panelini kayıt cihazına çevir** (`/admin/settings/caller-id`, ~30 dk):
   - State: `recording`, `frames: Array<{ts, hex, marker?: "RING"}>`
   - 3 buton: **"Kayıt Başlat/Durdur"** (`window.callerId.on("raw"/"call")` listener), **"ŞİMDİ ÇALDI"** (son frame'e RING marker), **"Logu İndir"** (JSON blob + `<a download>`)
   - Mevcut "Test Modu" toggle'ı zaten ham frame yayınlıyor; kayıt aynı stream'i dinler.
   - Backend POST gerekmez, sadece UI state.

2. **Kullanıcı test çağrısı yapar** (~5 dk): Test Modu aç → Kayıt Başlat → 5 sn idle → cep'ten ara → çaldığı an "ŞİMDİ ÇALDI" → 5-10 sn ring → kapat → 5 sn idle → Durdur → Logu İndir → JSON'u sohbete yapıştır.

3. **Offline analiz + parser yaz** (Claude tarafında, ~1 saat):
   - RING marker'ından önce/sonra hangi byte'lar değişti
   - Length-prefix hipotezini test et: `frame[0] = N`, `frame[1..N+1]` payload
   - Numara byte'larını ASCII veya BCD olarak bul
   - `electron/src/hid/parsers/wch-1a86-e008.ts feed()` doldur (şu an "unknown" döndürüyor; `decodeBcd()` helper'ı stub'ta zaten var)
   - Listener `event.type === "number"` görünce zaten `emit("call")` ediyor → bridge backend'e POST → popup hazır.

4. **Doğrulama** (~10 dk): Yeni test çağrısı → popup açılıyor mu, doğru numarayla mı.

**Olası tıkanma:** Türkiye'de Caller ID Type II hizmeti operatöre/aboneliğe bağlı. Hattın bu hizmeti yoksa cihazdan numara hiç gelmez (sadece RING sinyali) → operatöre arama gerekir.

**Fallback (parser çıkmazsa):** USBPcap + Wireshark ile Cidshow'un kendi Windows yazılımının USB trafiğini yakala (~2-3 saat ama protokol kesin çıkar).

**İlgili dosyalar:**
- `electron/src/hid/caller-id-listener.ts` — VID/PID auto-discover, hot-plug reconnect (exponential backoff), 5sn debounce, test modu
- `electron/src/hid/parsers/wch-1a86-e008.ts` — STUB parser, `feed()` doldurulacak
- `electron/src/hid/types.ts` — `IncomingCallEvent`, `ParseResult`
- `electron/src/services/incoming-call-bridge.ts` — backend POST + session.cookies + IPC broadcast
- `electron/src/scripts/hid-probe.ts` — bağımsız RE aracı (`npm run hid-probe`), cihaz listesi + ham hex+ASCII log
- `frontend/src/app/admin/settings/caller-id/page.tsx` — test paneli (kayıt butonları buraya eklenecek)
- Backend: `IncomingCall` entity + `IncomingCallStatus` enum, `IncomingCallService`, `IncomingCallsController`

---

## ÖNCELİK 2 — Kasa Cloud Sync Çalışmıyor

**Durum:** Kasa'da oluşturulan siparişler/müşteriler cloud'a (`api.nodapos.com`) ulaşmıyor. Outbox + SyncWorker kodu yazılı ama E2E test edilmedi.

**Doğrulama gereken noktalar:**

1. **Kasa `appsettings.Development.json` (veya Electron'un set ettiği env):**
   - `Sync:Enabled = true`
   - `Sync:CloudBaseUrl = "https://api.nodapos.com"`
   - `Sync:HmacSecret` — 32+ char (cloud ile aynı olmalı)
   - `Sync:PullPollingSeconds` (default 30)

2. **Cloud (Hetzner) tarafında aynı `Sync:HmacSecret` env var olarak set edilmiş mi.**

3. **Diagnostic:**
   - Lokal kasada birkaç sipariş aç, SQLite `outbox_events` tablosunda satır var mı?
   - SyncWorker logları (`<userData>/logs/main.log`) — `POST /api/sync/ingest` istekleri atılıyor mu, dönen status code ne?
   - Cloud Hetzner container loglarında ingest isteği görünüyor mu, HMAC verify geçiyor mu?
   - Cloud DB'de `outbox_events_applied` (veya benzeri) tracking tablosu var, satır artıyor mu?

4. **Olası nedenler:**
   - HMAC secret eşleşmiyor → cloud 401 döner
   - Kasa `Sync:Enabled = false` (default `false`)
   - CloudBaseUrl yanlış (HTTP/HTTPS, port)
   - Pull yönünde: cloud'dan menü değişikliği yapılınca kasa `SyncPullWorker` çekiyor mu

**İlgili dosyalar:**
- `backend/PizzaPos.Api/Sync/SyncWorker.cs` (push)
- `backend/PizzaPos.Api/Sync/SyncPullWorker.cs` (pull)
- `backend/PizzaPos.Api/Sync/HmacSignature.cs`
- `backend/PizzaPos.Api/Sync/IngestApplyService.cs`
- `backend/PizzaPos.Api/Controllers/SyncController.cs`
- `backend/PizzaPos.Api/Services/OutboxEmitter.cs`

---

## ÖNCELİK 3 — Printer Windows Dialog (DOKUNMA, parked)

Termal yazıcı (Rongta RP80) şu an Windows print dialog akışıyla çalışıyor — kullanıcı her fişte dialog'u onaylıyor. Silent print'e geri dönmedik (v0.1.15-18 boyunca denenip vazgeçildi).

**Şimdilik müdahale edilmeyecek.** Caller ID ve sync bittikten sonra bakılabilir.

İlgili kod: `frontend/src/app/print/receipt/[orderId]/...` ve `frontend/src/app/print/courier-slip/[orderId]/...` — auto `window.print()` 200ms gecikmeli, "Tekrar Yazdır" butonları print:hidden.

---

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

**Hetzner / Docker deploy:**
- SSH ile Hetzner kutusuna bağlan, `docker compose up -d` ile postgres + pizzapos-api + caddy ayağa kalkar.
- `docker compose logs -f pizzapos-api` — backend log
- `docker compose logs -f postgres` — DB log
- Caddy Let's Encrypt sertifikalarını otomatik yönetir; DNS değişikliği Cloudflare panelinden.
- Env var'lar `docker-compose.yml` veya `.env` dosyasında: `ConnectionStrings__Default`, `Sync__HmacSecret`, `Auth__Jwt__Secret`.
- Backup: `postgres:16-alpine` volume `pg_data` — periyodik dump alınmalı (henüz cron yok).

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

---

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
├── src/hid/parsers/wch-1a86-e008.ts   STUB (öncelik 1)
├── src/services/incoming-call-bridge.ts   backend POST + IPC
├── src/scripts/hid-probe.ts     RE aracı
├── scripts/publish-api.ps1      .NET self-contained win-x64 single-file
├── scripts/publish-frontend.ps1 Next standalone → resources/frontend/
└── electron-builder.yml         NSIS, asar + asarUnpack (node-hid/usb)

frontend/src/
├── app/admin/                   layout (sidebar), KPI dashboard, categories, tables,
│                                products (+product-options-editor: Boyut/Ekstra preset),
│                                orders, users, customers, combos, calls,
│                                settings/caller-id (öncelik 1 kayıt UI buraya)
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

## Bilinen Borçlar

- **Migration manuel atılanlar:** `AddCustomers`, `AddCombos`, `AddIncomingCallsAndDeliveryFields` — Hetzner DB'sine elle SQL ile uygulandı + `__EFMigrationsHistory`'e manuel insert. Production'da fark etmez, Down rollback yapılamaz. Temiz DB'de EF tool otomatik uygular.
- **Production `PendingModelChangesWarning` Ignore:** Snapshot drift bilinen durum. Dev'de fail-fast kalır.
- **`UpdateOrderDetailsRequest.customerId?` yok:** Mevcut siparişe sonradan müşteri linkleme yapılmıyor (sadece create'te).
- **Fiş header'ı sadece `store.name`:** Adres/telefon/vergi no için `LoginResponse.store` genişletilmeli.
- **Backend assembly adı hâlâ `PizzaPos.Api`** (rebrand sadece UI). `NodaPos.Api`'ye taşımak büyük çaplı find/replace.
- **`electron/resources/frontend/` `.gitignore`'a eklenmeli** (build çıktısı ~100MB+, yanlışlıkla commit edilmesin).
- **Eski `components/ui/{Button,Card,Input,Modal,Select}.tsx`** hâlâ kullanılıyor (admin tabloları + 3 kasa dialog'u). Brand uyumlu, aciliyet yok.
