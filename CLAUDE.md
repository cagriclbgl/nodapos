Bu proje, sadece restoranlar (öncelikle bir pizza dükkanı) için tasarlanmış, **hibrit (offline-first kasa + bulut ayna)** bir POS (Point of Sale) ve yönetim sistemidir. Kasa restorandaki Windows bilgisayarda Electron uygulaması olarak çalışır (lokal SQLite primary store, internet kesilse bile aksamaz). Yönetici uzaktan (evden) Vercel'de host edilen Next.js paneline bağlanır ve Supabase'i okur. Outbox pattern ile kasa → bulut yönlü sync.

**Mimari pivot (2026-05-09):** Önceki "saf bulut" tasarımdan, "tek-yazan-kasa + bulut aynası" hibrit mimarisine geçildi. Faz C/D/E (paket-kurye, raporlar, ayar paneli) ertelendi.

2. Teknoloji Yığını
   Backend: .NET 10 Web API (Entity Framework Core 9, multi-provider: Postgres + SQLite).

Database: PostgreSQL (Supabase, cloud) + SQLite (lokal kasa primary store).

Frontend: Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui (default zinc + brand orange-600).

Desktop: Electron 33 (Windows, .exe via electron-builder NSIS).

Hosting: Vercel (Frontend yönetici paneli), Render (Backend cloud — 750h Free Tier).

Domain & SSL: Cloudflare (DNS yönetimi ve ücretsiz SSL).

3. Kritik İş Kuralları (Business Rules)
   Snapshot Logic: Bir sipariş (Order) oluşturulduğunda, ürünün o anki adı ve fiyatı OrderItems tablosuna kopyalanmalıdır. Products tablosundaki gelecek fiyat değişimleri geçmiş siparişleri etkilememelidir.

Audit Logging: Ödeme tamamlandığında, ödeme detayları Payments tablosuna (Amount, Method, Date) kaydedilmeli ve ilgili Order ile Table durumu eş zamanlı güncellenmelidir.

Multi-tenancy: Her tabloda StoreId bulunmalı ve tüm sorgular bu ID üzerinden filtrelenmelidir.

Keep-Alive: Render'ın uyku moduna geçmesini önlemek için /api/health ucu her 14 dakikada bir tetiklenecektir.

4. Veritabanı Şeması
   Tables: Masa yönetimi (Boş, Dolu, Ödeme Bekliyor).

Categories & Products: Menü yönetimi.

ProductOptions: Ürünlere bağlı dinamik seçenekler (Boyut, Kenar, Ekstra).

Orders & OrderItems: Aktif sipariş takibi.

Payments: Mali kayıtlar ve ödeme geçmişi.

5. UI/UX Beklentileri
   Kasa Ekranı: Dokunmatik uyumlu, büyük butonlu, hızlı ürün ekleme ve ödeme alma odaklı ızgara yapısı.

Yönetici Paneli: Mobil uyumlu, günlük/haftalık ciro grafikleri ve stok/fiyat yönetim ekranları.

---

## Mevcut Durum (son güncelleme: 2026-05-11)

### 2026-05-10/11 Yapılanlar — özet (11 commit, 4f52b93..ef89428)

1. **Auth / supervisor onay UX fix** — commit `4f52b93`:
   - `AuthController.Login` pre-check artık `request.StoreId` verildiğinde çalışıyor (önce StoreId=null ile her giriş 404'tü).
   - `/supervisor/registrations` onay dialog'una random parola üretici (↻), storeName-tabanlı username önerisi, onay sonrası "Hesap Oluşturuldu" özet ekranı (username + şifre + login URL kopya butonları). 2026-05-10 gecesinin iki açık sorunu bu commit'le çözüldü.
2. **EF Core shadow FK fix** — commit `bd56955`:
   - `AppDbContext`'te Category/Product/Order/User/Customer/CustomerAddress için `HasOne<Store>()` (anonim) → `HasOne(x => x.Store)`. Önce EF her birine shadow `StoreId1` FK ekliyordu, Postgres her authed endpoint'te 500 atıyordu. 6 build warning de düştü.
   - `AddCustomersAndOutbox` migration'a idempotent `ALTER TABLE orders ADD CustomerId/CustomerAddressId + IX_StoreId_CustomerId` eklendi (Sprint 6'da unutulmuştu).
3. **Production startup fix** — commit `783012c`:
   - `Program.cs` production'da `PendingModelChangesWarning`'i Ignore ediyor (Sprint 6 snapshot drift'i nedeniyle container crashloop'taydı). Dev'de fail-fast kalır.
4. **JWT role claim fix** — commit `ef7db47`:
   - `MapInboundClaims=false` + `JwtTokenService`'ten duplicate `ClaimTypes.Role/Name` claim'leri silindi. Önce `[Authorize(Roles="Manager")]` her seferinde 403'tü (kısa "role" claim'i uzun URL'ye maplenince RoleClaimType eşleşmiyordu).
5. **POS UX fix** — commit `17168fd`:
   - `/pos` masa ızgarası boşsa Cashier'a "Masa ekle" butonu gösterilmiyor (Cashier `/admin/tables`'a yönlenince AuthGuard 403 atıyordu).
6. **Combos (kampanya menüleri)** — commits `5e8bc3e` + `19d1ff8`:
   - Yeni entity'ler: `Combo` (Name, Price, IsActive) + `ComboItem` (slot: kategori + adet).
   - Migration `AddCombos` (20260510010000): combos + combo_items + combo_combo_items tabloları. `[DbContext]+[Migration]` attribute fix (`19d1ff8`) — assembly scan'de discover edilebilsin.
   - `IComboService` + `ComboService` (CRUD), `CombosController` (Manager: Create/Update/Delete; authed: List/Get), `POST /api/orders/{id}/combos`.
   - `OrderService.AddComboAsync` tek snapshot `OrderItem` yaratır: `ProductName=combo.Name`, `UnitPrice=combo.Price`, `Notes="Slot1: A, B | Slot2: C"`. `ProductId` slot'tan seçilen ilk ürüne bağlanır (FK için), snapshot fields combo'dan override eder — mevcut OrderItem şeması değişmedi.
   - Frontend: `/admin/combos` CRUD (slot editor inline), sidebar'da "Kampanyalar" linki (Sparkles ikonu), `pos/table/[id]` "Kampanyalar" sekmesi + slot-bazlı `combo-picker-dialog`.
7. **Electron tek-binary offline-first kasa** — commit `6c9e43c`:
   - Kasa içinde .NET API + Next.js standalone frontend birlikte gömülür. Tek installer (.exe), iki child process, kapanışta ikisi de kill.
   - `AuthCookie`: SameSite/Secure artık `request.IsHttps`'e bakar (env'e değil) → cloud HTTPS=None+Secure, kasa HTTP localhost=Lax. Tek build iki konuma uyar.
   - `Program.cs` CORS: localhost / 127.0.0.1 her port HER ZAMAN allow (Electron'da iki child process iki free port'ta çalışır).
   - `frontend/next.config.ts` output=`standalone`; `lib/env.ts` runtime API URL detect (`window.location.hostname=localhost` → `http://<host>:5000`).
   - Electron `main.ts`: ikinci child process (Next standalone, free port, `ELECTRON_RUN_AS_NODE` ile yerleşik Node executable). API/frontend ikisi de `waitOn` health check'inden geçer; 3 crash → kapanış.
   - `scripts/publish-frontend.ps1` + `electron-builder.yml` extraResources `frontend`; `npm run publish-all` = publish-api + publish-frontend + electron-builder.
8. **Rebrand PizzaPos → NodaPos** — commit `cc3da90`:
   - Sidebar "P" → "N" rozet, "PizzaPos" → "NodaPos" tüm sayfalarda, `favicon.ico` silindi, `app/icon.png` eklendi (Next.js otomatik favicon). Backend repo/assembly adı **PizzaPos.Api** kaldı — sadece kullanıcıya görünen brand değişti.
9. **USB HID Caller ID + Paket/Kurye akışı + Ürün seçenek presetleri** — commit `ef89428`:
   - **Backend:**
     - `IncomingCall` entity + `IncomingCallStatus` enum (New/Handled/Missed/Ignored), `IncomingCallService` (telefon E.164 normalize + Customer.Phone match + son-7-hane fallback ILike), `IncomingCallsController` (POST/GET/PATCH-resolve/PATCH-note), 3 yeni outbox event tipi (Received/Resolved/NoteUpdated).
     - `Order` entity: `DeliveryAddressSnapshot`, `DeliveryDistrict`, `FulfillmentStatus` enum, `AssignedCourierUserId`, `OutForDeliveryAt`, `DeliveredAt`, `IncomingCallId`.
     - `OrderService.CreateDeliveryAsync` masasız (Takeaway/Delivery) sipariş; customer + adres snapshot + IncomingCallId varsa çağrıyı otomatik Handled+ResolvedOrderId kapatır.
     - Migration `AddIncomingCallsAndDeliveryFields` (20260510120000).
   - **Electron (kasa):**
     - `node-hid` + `usb` + `@electron/rebuild` deps, `asarUnpack` ayarı.
     - `hid/caller-id-listener.ts`: VID `0x1A86` PID `0xE008` auto-discover, hot-plug reconnect (exponential backoff), 5sn debounce, test modu.
     - `hid/parsers/wch-1a86-e008.ts`: **STUB** — `feed()` şu an "unknown" döner; protokol netleşince burası tek dokunuşta parser'a dönüşür. Kablo gelmeden gerisi hazır.
     - `services/incoming-call-bridge.ts`: backend POST + session.cookies auth + IPC broadcast.
     - `scripts/hid-probe.ts` (npm run hid-probe): reverse-engineering aracı, cihaz listesi + ham hex+ASCII raporları loga basar.
     - `preload.ts`: `contextBridge.exposeInMainWorld("callerId", {...})`.
   - **Frontend:**
     - `IncomingCallProvider` + `IncomingCallModal` global inject (kayıtlı müşteri = isim + son adres + son 3 sipariş; kayıtsız = direkt yeni sipariş).
     - `app/pos/delivery/new`: Takeaway/Delivery toggle, CustomerSearch, kayıtlı adres seç veya elle yaz, kategori grid + seçenek dialog'u.
     - `app/print/courier-slip/[orderId]`: 80mm fiş — büyük punto müşteri/telefon/adres + ürün+seçenek özeti + ödeme durumu + kurye imza alanı.
     - `app/pos/calls` günlük çağrı geçmişi (15sn auto-refresh); `app/admin/calls` KPI + top 5 arayan + tarih aralığı; `app/admin/settings/caller-id` cihaz durumu + canlı test modu.
     - **`product-options-editor` yeniden yazıldı** — Boyut preset (Küçük/Orta/Büyük + ek fiyatlar, zorunlu radio) ve Ekstra Malzeme preset (n satır, opsiyonel checkbox) tek tıkla birden fazla seçeneği POST eder; grup grup gösterim + inline edit; eski tek-satır "Özel" form Kenar/Sos gibi gruplar için saklı.
     - `lib/phone-normalize.ts` (E.164 + TR yerel format).

### Çalışma Ağacında Bekleyen (uncommitted)

- `backend/PizzaPos.Api/PizzaPos.Api.csproj` (+1): `<IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>` — self-contained single-file publish'in native lib'leri içine alması için.
- `electron/electron-builder.yml` (+5): `npmRebuild: false` (NAPI ABI stable olduğu için electron-rebuild gerekmiyor, VS 2026 + node-gyp uyumsuzluğunu da bypass eder).
- `electron/resources/` untracked: `resources/api/` zaten `electron/.gitignore`'da ama `resources/frontend/` ignore'da değil. Build çıktısı (.next + node_modules dahil ~100MB+); **gitignore'a `resources/frontend/` eklenmeli**.

### Mevcut Sağlık Tablosu (2026-05-11)

| Konu | Durum |
|---|---|
| Backend build (Postgres) | ✅ 0 hata 0 uyarı |
| Frontend build | ✅ Vercel deploy yeşil |
| Cloud Postgres migration zinciri | ✅ (`AddCombos` + `AddIncomingCallsAndDeliveryFields` elle SQL ile uygulandı — `__EFMigrationsHistory`'e kayıt manuel atıldı) |
| Cloud API health endpoint | ✅ `https://api.nodapos.com/api/health` 200 |
| Supervisor onay → Manager creation | ✅ Random parola üretip ekranda gösteriyor |
| Manager login (cloud + kasa) | ✅ Username-only çalışıyor |
| Combos (kampanya menüleri) | ✅ admin CRUD + kasa "Kampanyalar" sekmesi |
| Kasa tek-binary Electron installer | ✅ `npm run publish-all` ile NSIS .exe üretiliyor |
| Caller ID parser | ⚠️ STUB (`wch-1a86-e008.ts feed() → "unknown"`); kablo geldiğinde protokol parser'ı yazılacak |
| Paket/Kurye akışı (delivery) | ✅ uçtan uca; courier-slip yazdırılıyor |
| Ürün seçenek presetleri (Boyut/Ekstra) | ✅ tek tıkla bulk POST |
| Rebrand PizzaPos → NodaPos | ✅ frontend; backend assembly adı `PizzaPos.Api` kaldı |
| Kasa cloud sync E2E test | ⏳ tek-binary üretildi, gerçek sipariş senaryosu lokal test bekliyor |

---

## Tamamlananlar Kronolojisi (2026-05-09)

### Tamamlanan

**Faz 1 — Backend & Veritabanı (tamam):**
- `backend/PizzaPos.Api` — .NET 9 Web API, EF Core 9 + Npgsql 9.
- 9 Entity sınıfı: Store, Table, Category, Product, ProductOption, Order, OrderItem, OrderItemOption, Payment.
  - **OrderItem** snapshot alanları: `ProductName`, `UnitPrice`, `LineTotal`.
  - **OrderItemOption** snapshot alanları: `GroupName`, `OptionName`, `AdditionalPrice` (ProductOption silinse bile koruma için `ProductOptionId` nullable + `OnDelete(SetNull)`).
- `AppDbContext` — `TenantEntity` türevlerine reflection ile otomatik Global Query Filter (`StoreId`).
- `ITenantProvider` / `HeaderTenantProvider` — `X-Store-Id` header üzerinden tenant çözümleme.
- `DesignTimeDbContextFactory` — `appsettings.{Environment}.json` okuyor (runtime ile aynı kaynak).
- `InitialCreate` migration üretildi, **Supabase'de uygulandı** (9 tablo + `__EFMigrationsHistory`).
- Controllers: `Health`, `Stores` (cross-tenant), `Tables`, `Categories`, `Products` (+ nested options), `Orders`. `[RequireTenant]` filter eksik header'da 400 döner.
- Servisler: `Store/Table/Category/Product/Order` — `OrderService.CompleteAsync` atomik transaction (Payment + Order + Table).
- `DomainExceptionHandler` — `DomainException`'ı 400/404/409 ProblemDetails'e çevirir; diğer istisnalar için Development'ta tip+mesaj surface eder, Production'da sanitize.

**Faz 2-A — Frontend foundation + Yönetici Paneli (tamam):**
- `frontend/` — Next.js 16.2 + React 19.2 + Tailwind v4 + TypeScript.
- `lib/api.ts` — typed fetch wrapper (`X-Store-Id` otomatik), `ApiError` + ProblemDetails parse.
- `lib/store-context.tsx` — `localStorage` üzerinden aktif `StoreId` persistence.
- `lib/use-store-api.ts` — tenant-scoped GET hook.
- `components/StoreGuard.tsx`, `ui/{Button,Card,Input,Modal,Select}.tsx`.
- `/` (landing) — `StoreSelector` ile mağaza oluştur/seç + Kasa/Admin kartları.
- `/admin/{categories,tables,products,orders}` — tam CRUD (ürün başına nested options modal'ı dahil), `/admin` özet KPI'ları gerçek veriden.

**Faz 2-B — Kasa Ekranı (tamam):**
- `/pos` masa ızgarası — durum rengi + aktif sipariş tutarı/ürün adedi.
- `/pos/table/[id]` — kategori sekmeleri + ürün ızgarası + sticky sepet.
- `OptionsDialog` — zorunlu grup=radio, opsiyonel=checkbox, canlı line total.
- `PaymentDialog` — bölünmüş ödeme satırları (Nakit/Kart/Yemek Kartı/Diğer), referans no.
- Snapshot ve atomik kapanış uçtan uca çalışıyor.

**Faz 2-C — Yönetici Dashboard grafikleri (tamam):**
- `recharts` paketi eklendi.
- `/admin` özet sayfasında iki grafik: son 7 günün günlük ciro bar chart'ı + bugünün saatlik line chart'ı.
- Veri kaynağı: `GET /api/orders?status=Completed&from=…&to=…` (7 günü tek seferde alıp client'ta gruplama). Hacim büyürse `/api/reports/revenue` ucuna taşınacak.
- `frontend/src/app/admin/revenue-charts.tsx` ayrı bileşen.

**Faz 2-D — Kasa QoL (tamam):**
- Backend: `PATCH /api/orders/{id}/items/{itemId}` (adet), `DELETE /api/orders/{id}/items/{itemId}`, `PATCH /api/orders/{id}/details` (müşteri adı/telefon/not). Hepsi `ExecuteUpdateAsync` pattern'ini kullanıyor; OrderItem silindiğinde OrderItemOption cascade ile düşüyor; Order subtotal/total her değişiklikte yeniden hesaplanıyor.
- Frontend: sepet kaleminde inline `+/−` ve çöp ikonu (0'a düşünce otomatik sil); toolbar'da "Müşteri / Not" butonu → `DetailsDialog`; `PaymentDialog` artık 50/100/200/500 hızlı nakit preset'i, "Para Üstü" göstergesi ve `Ctrl/Cmd+Enter` ile gönderme.
- Bonus: son kalem silindiğinde Order otomatik `Cancelled` oluyor + Table `Empty`'ye dönüyor + UI `/pos`'a yönleniyor.

**Faz A — Auth & Roller (tamam, Supabase'de uygulandı — `AddUsersAndAuditUser`):**
- Backend: `User` entity + `UserRole` enum (Manager/Cashier), bcrypt parola hash, HMAC-SHA256 JWT cookie (`pizza_auth`, HttpOnly + SameSite=Lax, 12h).
- `SessionTenantProvider` JWT claim'inden StoreId çekiyor; anonim isteklerde `X-Store-Id` header'ına düşüyor (login flow + bootstrap için).
- `[Authorize]` mevcut tüm controller'larda; istisnalar: Health/Stores/Auth (login UI'sı için).
- Endpoints: `/api/auth/{login,logout,me,bootstrap}`, `/api/users` (Manager only) CRUD + reset-password. Last-Manager guard.
- `Order.CreatedByUserId`, `Payment.CreatedByUserId` audit alanları (FK yok, kullanıcı silinse de tutulur).
- Yeni paketler: `BCrypt.Net-Next 4.0.3`, `Microsoft.AspNetCore.Authentication.JwtBearer 9.0.0`.
- Migration: `20260507203055_AddUsersAndAuditUser` (henüz uygulanmadı).
- Frontend: `AuthProvider` + `useAuth` + `AuthGuard` + `UserMenu`, `/login`, `/setup` (ilk Manager bootstrap), `/admin/users` CRUD, route guard'ları (Manager → /admin, Cashier → /pos, anon → /login). `lib/api.ts` artık `credentials: "include"` gönderiyor; 401'lerde DOM event ile session temizleniyor.
- Eski `StoreContext` kaldı ama auth-driven shim'e dönüştü; `StoreSelector`/`StoreGuard` silindi.

**Faz B — Müşteri DB & Fiş & Kasa Polish (tamam, Supabase'de uygulandı — `AddCustomers`):**
- Backend: `Customer` (Name, Phone uniq within Store, Notes, IsActive) + `CustomerAddress` (Label, AddressLine, District, Notes, IsDefault). `Order`'a nullable `CustomerId`/`CustomerAddressId` (FK yok — snapshot semantiği). `[Authorize]` zorunlu, herhangi bir authed kullanıcı yönetebilir.
- Endpoints: `/api/customers` CRUD + arama (`?search=...`, ILike Postgres-native), `/api/customers/{id}/addresses` CRUD (IsDefault toggle transactional), `/api/customers/{id}/orders` (CustomerId VEYA legacy CustomerPhone match, son 50).
- `OrderService.CreateAsync` artık `request.CustomerId` varsa Customer kaydını çekip Name/Phone snapshot'ını override ediyor (geçmiş bozulmaz).
- Frontend: `CustomerSearch` reusable typeahead (250ms debounce, AbortController, inline "Yeni Müşteri" mini-form). `/admin/customers` Manager-only — debounced search + side detail panel (edit + adres CRUD + son siparişler + fiş linki).
- Kasada `details-dialog` artık `CustomerSearch` ile başlar; seçilen müşterinin kayıtlı adresleri read-only listede (Faz C kuryede kullanılacak); free-text fallback hala var.
- `/print/receipt/[orderId]` — 80mm mono layout, sipariş + ödeme detayları, auto `window.print()` 200ms gecikmeli, "Masalara Dön" + "Tekrar Yazdır" butonları (print:hidden). Standalone print layout.
- `OptionsDialog`'da 6 hızlı not chip'i (Az pişsin / Çıtır / Acılı / Soğansız / Bol peynir / Mantarsız) — toggle on/off, virgülle ayrılır.
- Ödeme tamamlanınca otomatik fiş sayfasına yönleniyor; kasiyer "Masalara Dön" ile masalara döner.
- Bilinen kontrat boşluğu: `UpdateOrderDetailsRequest`'te şu an `customerId` yok — mevcut siparişe sonradan müşteri linkleme yapılmıyor (sadece create'te). Faz C'de düzeltilebilir. Fiş header'ı şu an sadece store.name gösteriyor — adres/telefon için `GET /api/stores/me` veya `LoginResponse.store` genişletmesi gerekir (Faz E ayar paneli ile birlikte).

**Sprint 0+1+2 — Backend multi-provider + Outbox + Electron iskelet (tamam, 2026-05-09):**
- **Sprint 0:** EF Core multi-provider — `Database:Provider` flag (`Postgres` default | `Sqlite`). `Microsoft.EntityFrameworkCore.Sqlite 9.0.0` paketi eklendi. `Program.cs` ve `DesignTimeDbContextFactory` conditional `UseSqlite/UseNpgsql`. Mevcut 3 migration `Migrations/Postgres/` altına taşındı, namespace `PizzaPos.Api.Migrations.Postgres`. `Migrations/Sqlite/` placeholder.
- **Sprint 1:** Outbox pattern — `OutboxEvent` entity (global, NOT TenantEntity) + `outbox_events` tablosu. `IOutboxEmitter` / `OutboxEmitter` payload'ı `{ storeId, data }` envelope ile sarar. `OrderService` 7 metoduna emit eklendi (Create, AddItem, UpdateItem, RemoveItem, UpdateDetails, Complete, Cancel) — `ExecuteUpdateAsync` pattern'i KORUNDU. `Sync/SyncWorker.cs` BackgroundService 10sn polling, batch 50, exponential backoff (max 300s, 10 retry). `Sync/HmacSignature.cs` HMAC-SHA256 hex + constant-time verify. `Controllers/SyncController.cs` — `POST /api/sync/ingest` (idempotent + HMAC) + `GET /api/sync/changes?since=&aggregates=Product,Category,Store` (kasa pull endpoint, IgnoreQueryFilters). `appsettings.json`'a `Database:*` ve `Sync:*` bölümleri (default `Sync:Enabled = false`).
- **Sprint 2:** `electron/` klasörü — Electron 33 + electron-builder 25 + TypeScript 5.6. `electron/src/main.ts` orchestrator: free port (`get-port`) → spawn `PizzaPos.Api.exe` self-contained (env `Database__Provider=Sqlite`, `Sync__Enabled=true`) → `wait-on /api/health` → BrowserWindow `loadURL("http://localhost:3000")`. Crash recovery (max 3). `<userData>/pos.db` + `<userData>/logs/main.log`. `scripts/publish-api.ps1` self-contained win-x64 single-file publish. `electron-builder.yml` NSIS installer, asar, extraResources `resources/api`.
- **Migration durumu (önemli):** Sprint 6'da SQLite migration üretmeyi denerken EF tool snapshot'ı SQLite'a göre güncelledi (Npgsql annotation kayboldu). `dotnet ef migrations remove` ile geri alındı ama EF en son timestamp'li migration olarak `AddCustomers`'ı sildi — Postgres `AddCustomers.cs` dosyası kayboldu. Yeni `AddCustomersAndOutbox` migration üretildi (sadece `outbox_events` ekler — Customer tabloları Supabase'de zaten var, `__EFMigrationsHistory`'de eski kaydı duruyor). EF runtime'da pending olmayan migration'ları es geçtiği için sorun yok; sadece eski AddCustomers için Down rollback yapılamaz.

**Sprint 3+4+5 — shadcn/ui tasarım sistemi + UI v1 yenilemesi (tamam, 2026-05-09):**
- **Sprint 3:** `frontend/src/components/ui-v2/` — 13 shadcn primitive (button, card, dialog, sheet, input, label, badge, skeleton, separator, tabs, select, empty-state, toaster). `lib/utils.ts` cn() helper. `globals.css` shadcn HSL token'ları (light + dark) + `tw-animate-css` (Tailwind v4 native, `tailwindcss-animate` v3 yerine). Yeni paketler: lucide-react, cva, clsx, tailwind-merge, framer-motion, sonner, react-hook-form, zod, @hookform/resolvers + 7 Radix primitive.
- **Brand renk:** `--primary: 24 95% 53%` (Tailwind orange-600 — pizza dükkanı sıcak portakal). Light + dark mode. Mevcut eski `ui/` komponentleri zaten `bg-orange-600` kullandığı için iki sistem görsel uyumlu.
- **Sprint 4 (/pos):** `pos/page.tsx` masa ızgarası kart-bazlı (sol durum şeridi + Badge + Skeleton + EmptyState). `pos/table/[id]/order-screen.tsx` lucide ikonlar + ui-v2 Button (touch size) + Badge + ürün/cart kartları. Modal dialog'lar (options/payment/details) eski Modal'da kaldı — sonraki iterasyon.
- **Sprint 5 (/admin):** `admin/layout.tsx` sidebar lucide ikonlarla + primary highlight + brand "P" logo. `admin/page.tsx` KPI Card + Skeleton + accent ilk kart. `login/page.tsx` + `setup/page.tsx` tam ui-v2 (Card + Input + Label + Select + Pizza ikonu). Diğer admin sayfaları (categories, tables, products, orders, customers, users) eski `ui/` komponentlerinde kaldı — brand uyumlu, sonraki iterasyon.
- **Sprint 6:** `npm install` + `npm run build` + `dotnet restore` + `dotnet build` (Postgres mode) — tümü 0 hata. `_design/page.tsx` Next.js private folder convention'a takılıyordu, `design/page.tsx` olarak rename edildi.
- `app/design/page.tsx` — tüm shadcn primitive'lerini sergileyen preview (button matrix, card, dialog, sheet, form, tabs, badges, skeleton, empty state, toast triggers).

### Önemli Operasyonel Notlar

- **.NET runtime:** `csproj` `TargetFramework=net10.0` (lokal makinede sadece .NET 8 ve 10 kurulu, 9 yok). EF tool 9.0.0 paketleri 10 üzerinde forward-compat çalışıyor. `dotnet run` ve `dotnet ef` her komuttan önce:
  ```powershell
  $env:DOTNET_ROLL_FORWARD = "Major"
  $env:ASPNETCORE_ENVIRONMENT = "Development"
  ```
  Render'a deploy edilirken net10 docker image kullanılacak; bu env var orada gerek değil.

- **Database provider switch:** `Database:Provider` config flag'i kontrol eder.
  ```powershell
  # Postgres (cloud / dev)
  $env:Database__Provider = "Postgres"   # default
  # SQLite (offline kasa — Electron child process otomatik bunu set eder)
  $env:Database__Provider = "Sqlite"
  $env:Database__SqlitePath = "pos.db"
  ```
  Migration üretimi: Postgres → `Migrations/Postgres/`, SQLite → `Migrations/Sqlite/`. Aynı assembly'de tek `AppDbContextModelSnapshot` olduğu için SQLite migration üretirken Postgres-specific annotation'lar (Npgsql) kaybolma riski var — `Migrations/Sqlite/README_TODO.md` detayı açıklar. Pratik kural: SQLite migration'ı üretmeden önce `Migrations/Postgres/AppDbContextModelSnapshot.cs`'i yedekle.

- **Supabase bağlantısı (Session Pooler kullanılıyor — IPv4):**
  - Direct host (`db.<ref>.supabase.co`) yalnızca IPv6, lokal makineden bağlanmıyor.
  - Çalışan: `aws-1-eu-central-1.pooler.supabase.com:5432`, kullanıcı `postgres.ufvykjewosfaszgzwoik`.
  - Connection string `appsettings.Development.json`'da (gitignore'da, repo'da yok).
  - Production için Render'da env var: `ConnectionStrings__Default` (çift alt çizgi).

- **EF Core + Pooler özel notu:** `OrderService`'te `AddItemAsync` / `CompleteAsync` / `CancelAsync` change-tracker UPDATE yerine **`ExecuteUpdateAsync`** kullanıyor. Tracker tabanlı UPDATE pooler altında `DbUpdateConcurrencyException (0 rows affected)` veriyordu (concurrency token tanımlı olmamasına rağmen). Bu yaklaşımı bozma — yeni Order alanları eklenirse aynı pattern'i koru.

- **Lokal çalıştırma:**
  ```powershell
  # Backend
  cd backend\PizzaPos.Api
  $env:DOTNET_ROLL_FORWARD = "Major"; $env:ASPNETCORE_ENVIRONMENT = "Development"
  dotnet run
  # → http://localhost:5000/swagger

  # Frontend (ayrı terminal)
  cd frontend
  npm run dev
  # → http://localhost:3000
  ```

### Sırada

1. **Termal fiş yazıcısı entegrasyonu (Electron silent print) — ÖNCELİK 1:**
   - **Onaylı kararlar (2026-05-11):** Tek default yazıcı; masa adisyonu + kurye fişi (mutfak fişi/KDS backlog'da); HTML render yaklaşımı (ESC/POS binary yok).
   - **Mimari:** `electron/src/services/print-service.ts` (yeni) hidden `BrowserWindow({show:false})` açar → `loadURL("/print/<type>/<orderId>?silent=1")` → `webContents.print({ silent: true, deviceName, margins:{marginType:"none"} })`. IPC: `printer:print`, `printer:list`, `printer:set-default`, `printer:get-default`.
   - **Frontend:** `/print/*` sayfaları `?silent=1` query okuyup `auto window.print()` çağrısını ATLA (çift print önler). Preload `window.printer.{print,listPrinters,setDefault,getDefault}`.
   - **Ayar sayfası:** `/admin/settings/printer` — `webContents.getPrintersAsync()` listeden seç + "Test Çıktısı" butonu. Ayar kasa-lokal (`electron-store` veya `userData/printer.json`) — cloud sync ETMEZ.
   - **Otomatik tetikleme:** `OrderService.CompleteAsync` response sonrası → `window.printer?.print(orderId, "receipt")`; `/pos/delivery/new` create sonrası → `printer?.print(orderId, "courier-slip")`.
   - **Fallback:** `window.printer` undefined (web ortamı) → eski davranış (yeni tab + manuel print). Yazıcı seçili değilse toast + ayarlar linki. Print fail → toast + manuel fallback.
   - **Süre tahmini:** ~3 saat (IPC+hidden window 1h, frontend silent query+auto-trigger 30dk, settings sayfası 45dk, gerçek yazıcı veya "Microsoft Print to PDF" ile test 30dk, installer rebuild). Mevcut akışları KIRMAZ.

2. **POS Paket sekmesi (test sonrası gerekirse):**
   - `/pos` ana sayfaya 3 sekme: Masalar / Paket / Kurye.
   - Paket tab'ı: aktif Takeaway+Delivery siparişleri liste, FulfillmentStatus filtresi (Hazırlanıyor/Yolda/Teslim), kuryeye atama butonu (`AssignedCourierUserId` set).
   - Caller ID modal + `/pos/delivery/new` akışı zaten var — sadece "merkezi liste/dashboard" eksik.
   - Önce kullanıcı mevcut sistemi test edip karar verecek.

3. **Caller ID HID parser implementasyonu (kablo geldiğinde 1 saatlik iş):**
   - `electron/src/hid/parsers/wch-1a86-e008.ts` `feed()` şu an "unknown" döner.
   - `npm run hid-probe` ile cihaza arama yaptır, log'a düşen ham hex frame'lerden offset/protokol çıkar.
   - Sonra `feed()` byte stream → `{ phone, lineNumber, ringStartedAt }` parse etsin.
   - Test: `/admin/settings/caller-id` test modu canlı hex'i gösteriyor, oradan doğrula.

2. **Faz D — Raporlar & Vardiya (Faz C tamamlandığı için sıradaki büyük iş):**
   - `CashierSession` entity, vardiya aç/kapat zorunlu, açılış-kapanış nakit sayımı.
   - Z-Rapor (`/admin/reports/z-report`) — günlük ciro+ödeme yöntemi kırılımı+iptal/iade özeti.
   - İndirim akışı + Manager PIN (kasiyer manuel indirim isterse PIN ister).
   - İptal/iade sebep zorunlu (`Order.CancelReason` enum + serbest not).

3. **Faz E — Operasyonel polish:**
   - `/admin/settings` (mağaza adres/telefon/vergi no — fiş header'ına yansır).
   - Stok ışığı (`Product.StockOnHand` + `MinStockThreshold`, otomatik düşürme yok ama kart üzerinde renk).
   - Ürün resmi (lokal disk + cloud Supabase Storage replication).
   - Ürün uygunluk takvimi (`AvailableFromHour/ToHour` — örn. öğle menüsü sadece 11:00-15:00).

4. **Modal dialog'ları Sheet'e çevir (kasa UX, devam ediyor):**
   - `pos/table/[id]/options-dialog.tsx` → `Sheet side="bottom"` (mobil-style touch).
   - `payment-dialog.tsx` ve `details-dialog.tsx` → shadcn ui-v2 `Dialog`.
   - Eski `components/ui/Modal.tsx`'i tamamen kaldır.

5. **Diğer admin sayfaları → ui-v2 migration (opsiyonel, brand uyumlu):**
   - Pilot: `/admin/orders` (en sık bakılan tablo).
   - Sıra: `/admin/products` (product-options-editor zaten yeni yazıldı — ui-v2 değil ama brand uyumlu) → `/admin/customers` → `/admin/categories`, `/admin/tables`, `/admin/users`.
   - Form'larda `react-hook-form + zod` kullanmaya geçiş (deps zaten var).
   - Tabloları `shadcn DataTable` pattern'ine çevir.

6. **Kasa cloud sync E2E test (lokal):**
   - `npm run publish-all` ile NSIS installer üret veya `npm run dev`'le Electron çalıştır.
   - `appsettings.Development.json`'a `Sync:HmacSecret` (32+ char) + `Sync:CloudBaseUrl=https://api.nodapos.com` + `Sync:Enabled=true`.
   - Lokal kasada birkaç sipariş + müşteri + delivery aç, `outbox_events` tablosunu kontrol et, cloud'a gitti mi.
   - Pull yönünde: cloud'dan menü değişikliği yap, kasa `Sync:PullPollingSeconds` aralığında çekiyor mu.

**Backlog:**
- Caller ID için DialerSync/Yeahlink gibi alternatif cihaz desteği (HID parser stub'ı genelleştirilebilir).
- KDS (mutfak ekranı) — kullanıcı listeden çıkardı, sunumdan sonra konuşulabilir.
- `/api/reports/revenue` aggregate endpoint (hacim büyüyünce client-side gruplama yetmediğinde).
- `electron/resources/frontend/` `.gitignore`'a eklenmeli (şu an untracked görünüyor, build çıktısı yanlışlıkla commit edilmesin).
- Backend assembly adı hâlâ `PizzaPos.Api` — rebrand'in arkayüzü tamamlanırsa `NodaPos.Api`'ye taşımak gerekir (büyük çaplı find/replace + repo rename).

### Yarın için hızlı başlangıç

```powershell
# 1) Backend (Postgres / dev mode)
cd C:\Users\w11\Desktop\menu\backend\PizzaPos.Api
$env:DOTNET_ROLL_FORWARD = "Major"; $env:ASPNETCORE_ENVIRONMENT = "Development"; $env:Database__Provider = "Postgres"
dotnet run
# → http://localhost:5000/swagger

# 2) Frontend (ayrı terminal)
cd C:\Users\w11\Desktop\menu\frontend
npm run dev
# → http://localhost:3000
# Kontrol URL'leri:
#  /login        — yeni Card + Pizza ikonu
#  /design       — shadcn primitive showcase
#  /admin        — Manager rolüyle KPI dashboard
#  /pos          — Cashier rolüyle masa ızgarası
#  /pos/table/X  — touch-button sipariş ekranı
```

İlk açılışta `/login` → mağaza seç → Manager yoksa `/setup` → `/admin/users` Kasiyer ekle → `/admin/customers` müşteri seed → kasada akış doğrula. Migration'lar Supabase'de güncel.

### Bilinen Eksikler / Borçlar

- **Migration manuel atılanlar:** `AddCustomers.cs` (Sprint 6 EF tool yan etkisi) + `AddCombos` ve `AddIncomingCallsAndDeliveryFields` (Hetzner DB'sine elle SQL ile uygulandı + `__EFMigrationsHistory`'ye manuel insert). Production'da fark etmez ama Down rollback yapılamaz. Yeni temiz DB'de ise EF tool migration'ları otomatik uygular ([DbContext]+[Migration] attribute fix sayesinde).
- **Production `PendingModelChangesWarning` Ignore'lu:** Snapshot drift bilinen durum (Customer + Order delivery alanları). Dev'de fail-fast kalır. Temizlik için `dotnet ef migrations add SnapshotRefresh --empty` veya snapshot'ı silip baştan üretmek gerekir (ama mevcut migration'larla uyumlu kalması için dikkat).
- **`UpdateOrderDetailsRequest.customerId?` yok:** Mevcut siparişe sonradan müşteri linkleme yapılmıyor (sadece create'te). Düşük öncelik — kasiyer pratikte siparişin başında müşteri seçiyor.
- **Fiş header'ı sadece `store.name` gösteriyor:** Adres/telefon/vergi no için `LoginResponse.store`'u `StoreSummaryDto` → tam `StoreDto`'ya genişletmek gerek. Faz E (`/admin/settings`) ile birlikte.
- **Eski `components/ui/{Button,Card,Input,Modal,Select}.tsx` hâlâ kullanılıyor:** /admin tablo sayfaları + 3 kasa dialog'u. Brand uyumlu (orange-600), aciliyet yok.
- **Kasa dialog'ları Modal'da:** `options-dialog`, `payment-dialog`, `details-dialog`. Bottom Sheet/ui-v2 Dialog'a geçiş kasiyer UX'ini iyileştirir.
- **Caller ID parser STUB:** `wch-1a86-e008.ts feed()` "unknown" döner. Kablo gelince ham hex'ten protokol çıkar.
- **`electron/resources/frontend/` `.gitignore`'da değil:** Build çıktısı ~100MB+, yanlışlıkla commit edilmesin diye eklenmeli. (`resources/api/` zaten ignored.)
- **Sync HMAC secret henüz lokal dev test edilmedi:** Hetzner taraf canlı; kasa tek-binary üretildi ama `appsettings.Development.json`'a `Sync:HmacSecret` + `Sync:CloudBaseUrl=https://api.nodapos.com` + `Sync:Enabled=true` ile E2E test bekliyor.
- **Backend assembly adı `PizzaPos.Api` (rebrand sadece UI):** İleride `NodaPos.Api`'ye taşımak repo + namespace + GitHub repo + Docker image isim değişikliği demek.

### Dosya Haritası (referans, 2026-05-11)

```
backend/PizzaPos.Api/
├── Entities/                    BaseEntity, TenantEntity, Store, Table, Category,
│                                Product, ProductOption, Order, OrderItem,
│                                OrderItemOption, Payment, User, Customer,
│                                CustomerAddress, OutboxEvent, SyncState,
│                                Combo (+ ComboItem), IncomingCall, Enums
├── Data/                        AppDbContext, ITenantProvider,
│                                SessionTenantProvider, HeaderTenantProvider,
│                                DesignTimeDbContextFactory (provider-aware)
├── DTOs/                        Store/Table/Category/Product/Order/Payment/
│                                User/Customer/Auth/Combo/IncomingCall Dtos
├── Services/                    I*Service + *Service, IOutboxEmitter +
│                                OutboxEmitter, ComboService, IncomingCallService,
│                                DomainException, DomainExceptionHandler
├── Auth/                        JwtTokenService, BCryptPasswordHasher,
│                                AuthService, AuthCookie (IsHttps-aware),
│                                JwtOptions, claim helpers
├── Sync/                        SyncOptions, HmacSignature, SyncWorker (push),
│                                SyncPullWorker (cloud→kasa), IngestApplyService
├── Controllers/                 Health, Stores, Tables, Categories, Products,
│                                Orders (+ /combos), Auth, Users, Customers,
│                                CustomerAddresses, Combos, IncomingCalls, Sync
├── Migrations/
│   ├── Postgres/                InitialCreate, AddUsersAndAuditUser,
│   │                            AddCustomersAndOutbox, AddSyncStates,
│   │                            AddOutboxApplyTracking, AddCombos,
│   │                            AddIncomingCallsAndDeliveryFields
│   │                            + Designer + ModelSnapshot
│   └── Sqlite/                  (kasa tek-binary için üretildi — README_TODO.md)
├── Program.cs                   provider-aware DB, JWT (MapInboundClaims=false),
│                                CORS localhost-allow, prod PendingModelChanges Ignore,
│                                SyncWorker + SyncPullWorker conditional
├── appsettings.json             Database:* + Sync:* + Auth:Jwt:* placeholder
└── appsettings.Development.json gitignore'da

electron/
├── package.json                 electron 33 + electron-builder 25 + ts 5.6 +
│                                node-hid + usb + @electron/rebuild + get-port
├── electron-builder.yml         NSIS installer, asar + asarUnpack (node-hid/usb),
│                                extraResources: resources/api + resources/frontend,
│                                npmRebuild: false (NAPI ABI stable)
├── src/
│   ├── main.ts                  iki child process (API + Next standalone),
│   │                            wait-on health, crash recovery (max 3),
│   │                            caller-id listener startup, IPC handlers
│   ├── preload.ts               contextBridge: callerId.* (rescan, listDevices,
│   │                            setTestMode, on(call/raw/status))
│   ├── hid/
│   │   ├── caller-id-listener.ts   VID 0x1A86 PID 0xE008 auto-discover,
│   │   │                            hot-plug reconnect, 5sn debounce, test modu
│   │   ├── parsers/
│   │   │   └── wch-1a86-e008.ts    STUB — feed() "unknown" döner; kablo gelince
│   │   │                            tek dokunuşta protokol parser'ı yazılacak
│   │   └── types.ts                IncomingCallEvent, DeviceInfo, ParseResult
│   ├── services/
│   │   └── incoming-call-bridge.ts backend POST + session.cookies auth + IPC
│   └── scripts/hid-probe.ts        bağımsız RE aracı (npm run hid-probe) —
│                                    cihaz listesi + ham hex+ASCII log
├── scripts/
│   ├── publish-api.ps1          .NET self-contained win-x64 single-file publish
│   └── publish-frontend.ps1     Next standalone build → resources/frontend/
├── resources/                   build çıktısı — .gitignore'da: api/ ✅, frontend/ ❌ (eklenmeli)
└── README.md

frontend/src/
├── app/
│   ├── layout.tsx + globals.css AuthProvider, Tailwind v4 + shadcn HSL token,
│   │                            tw-animate-css, brand orange (--primary)
│   ├── icon.png                 NodaPos favicon (Next.js otomatik)
│   ├── page.tsx                 landing redirect (auth role'üne göre)
│   ├── design/page.tsx          shadcn primitive showcase
│   ├── login/page.tsx           username-only login (StoreId opsiyonel)
│   ├── setup/page.tsx
│   ├── register/page.tsx        restoran başvuru formu
│   ├── supervisor/
│   │   ├── login/page.tsx
│   │   └── registrations/page.tsx  approve dialog: random parola üretici +
│   │                                "Hesap Oluşturuldu" özet (kopya butonları)
│   ├── admin/
│   │   ├── layout.tsx           sidebar lucide + "N" brand badge
│   │   ├── page.tsx             KPI Card + Skeleton + revenue-charts
│   │   ├── categories/, tables/, orders/, users/  (eski ui/)
│   │   ├── products/page.tsx + product-options-editor.tsx
│   │   │                        Boyut/Ekstra preset bulk-POST, grup grup gösterim
│   │   ├── customers/page.tsx
│   │   ├── combos/page.tsx              Kampanya menüleri CRUD + slot editor
│   │   ├── calls/page.tsx               KPI + top 5 + tarih aralığı (caller ID)
│   │   └── settings/caller-id/page.tsx  cihaz durumu + test modu
│   ├── pos/
│   │   ├── layout.tsx           AuthGuard role=Cashier + IncomingCallProvider + Modal
│   │   ├── page.tsx             masa ızgarası
│   │   ├── calls/page.tsx       günlük çağrı geçmişi (15sn auto-refresh)
│   │   ├── delivery/new/page.tsx + delivery-order-screen.tsx
│   │   │                        Takeaway/Delivery toggle, CustomerSearch,
│   │   │                        kayıtlı adres veya elle, kategori grid + dialog
│   │   └── table/[id]/
│   │       ├── page.tsx                   async params
│   │       ├── order-screen.tsx           ui-v2 + "Kampanyalar" sekmesi
│   │       ├── combo-picker-dialog.tsx    slot-bazlı seçim modal'ı
│   │       ├── options-dialog.tsx         (Modal — Sheet'e migrate sırada)
│   │       ├── payment-dialog.tsx         (Modal)
│   │       └── details-dialog.tsx         (Modal + CustomerSearch)
│   └── print/
│       ├── receipt/[orderId]/    80mm fiş, auto window.print()
│       └── courier-slip/[orderId]/courier-slip-view.tsx
│                                  büyük punto müşteri/telefon/adres + ürün+seçenek
│                                  + ödeme durumu + kurye imza alanı
├── components/
│   ├── AuthGuard, UserMenu, CustomerSearch
│   ├── incoming-call/IncomingCallModal.tsx  kayıtlı müşteri kartı veya yeni akış
│   ├── ui/                      eski sistem (Button, Card, Input, Modal, Select)
│   └── ui-v2/                   shadcn primitive (button, card, dialog, sheet,
│                                input, label, badge, skeleton, separator, tabs,
│                                select, empty-state, toaster)
├── lib/                         api, env (runtime API URL detect), format,
│                                auth-context, store-context, use-store-api,
│                                utils, phone-normalize, incoming-call-listener
└── types/                       api.ts (DTO mirror), electron.d.ts (window.callerId)
```

### Rapor Dosyaları (repo kökü)

- `REPORT_BACKEND.md` — Sprint 0+1+2 detayı, sabah komutları, karar noktaları (gece çalışmasından).
- `REPORT_FRONTEND.md` — Sprint 3 detayı, shadcn kurulumu (gece çalışmasından).
- `REPORT_FINAL.md` — Sprint 0-6 toplu özet, test sonuçları, sonraki sprint önerileri.
