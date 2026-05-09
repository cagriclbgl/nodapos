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

## Mevcut Durum (son güncelleme: 2026-05-09, gün)

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

### Sırada (gün sonu durumu — yarın buradan devam)

**Bugün (2026-05-09) son durum:**
- Sprint 0-6 tamamlandı (multi-provider backend + outbox/sync + Electron iskelet + shadcn tasarım sistemi + UI v1 yenilemesi).
- `npm install` + `npm run build` + backend `dotnet build` (Postgres mode) hepsi **0 hata** ile geçti.
- Backend (5000) + frontend dev server (3000) **paralel çalışır durumda doğrulandı** (health check 200 + 200).
- Brand renk default sıcak portakal (`--primary: 24 95% 53%`) uygulandı.
- Görsel test (kullanıcı tarayıcıda) bugün başladı; bulgular yarın işlenecek.

**Yarın başlanacak:**

1. **Görsel test bulgularını işle** — kullanıcının tarayıcıda gördüğü bug/iyileştirme isteklerini düzelt. Öncelik: `/login`, `/admin` (KPI dashboard), `/pos` masa ızgarası, `/pos/table/[id]` sipariş ekranı.

2. **Diğer admin sayfaları → ui-v2 migration (opsiyonel, brand uyumlu olduğu için aciliyet yok):**
   - Pilot: `/admin/orders` (en sık bakılan tablo).
   - Sıra: `/admin/products` (product-options-editor dahil) → `/admin/customers` (CustomerSearch dahil) → `/admin/categories`, `/admin/tables`, `/admin/users`.
   - Tüm form'larda `react-hook-form + zod` kullanmaya geçiş (zaten dependency var).
   - Tabloları `shadcn DataTable` pattern'ine çevir (sortable, filterable).

3. **Modal dialog'ları Sheet'e çevir (kasa UX):**
   - `pos/table/[id]/options-dialog.tsx` → `Sheet side="bottom"` (mobil-style).
   - `pos/table/[id]/payment-dialog.tsx` ve `details-dialog.tsx` → `Dialog` (shadcn ui-v2).
   - Eski `components/ui/Modal.tsx`'i tamamen kaldır.

4. **SQLite migration üretimi (kasa offline ilk başlatma için):**
   ```powershell
   cd backend\PizzaPos.Api
   $env:DOTNET_ROLL_FORWARD = "Major"; $env:Database__Provider = "Sqlite"; $env:Database__SqlitePath = "pos.db"
   # Postgres snapshot'ını yedekle, sonra:
   dotnet ef migrations add SqliteInitialCreate -o Migrations/Sqlite
   # Snapshot'ı geri al (üst yedekle değiştir).
   dotnet ef database update
   ```
   `Migrations/Sqlite/README_TODO.md` detayı içerir. Snapshot çakışması açıklanmış.

5. **Electron'u uçtan uca dene:**
   - `electron/` klasöründe `npm install` + `npm run build`.
   - `npm run publish-api` ile .NET self-contained binary üret (`electron/resources/api/PizzaPos.Api.exe`).
   - Frontend dev server açıkken `npm start` — Electron penceresi `http://localhost:3000`'e bağlansın, child process API SQLite mode'da `pos.db` üretmeli.
   - Sync test: `appsettings.Development.json`'a `Sync:HmacSecret` (32+ char) + `Sync:CloudBaseUrl` ekle, `Sync:Enabled = true`. Lokal kasada birkaç sipariş aç, `outbox_events` tablosunu kontrol et, cloud'a gitti mi.

6. **Önceden ertelenen Faz C/D/E (ileri):**
   - **Faz C — Paket & Kurye Akışı:** `/pos` ana ekranına 3 sekme (Masalar / Paket / Kurye), `OrderType=Takeaway/Delivery`, `Order.FulfillmentStatus` enum + `AssignedDriverUserId` + `OutForDeliveryAt` + `DeliveredAt`, `POST /api/orders/{id}/advance` + `assign-driver`.
   - **Faz D — Raporlar & Vardiya:** `CashierSession` entity, vardiya aç/kapat zorunlu, Z-Rapor (`/admin/reports/z-report`), İndirim akışı + Manager PIN, İptal/iade sebep zorunlu (`Order.CancelReason`).
   - **Faz E — Operasyonel polish:** `/admin/settings`, stok ışığı (`Product.StockOnHand` + `MinStockThreshold`), ürün resmi (Supabase Storage), ürün uygunluk takvimi (`AvailableFromHour/ToHour`).

**Backlog (sunum / canlıya çıkma sonrası):**
- Vercel'e frontend deploy + Render'a backend deploy + keep-alive cron (14dk, GitHub Actions).
- Cloud Supabase'de outbox_events + sync endpoint (Render'da host edilen ayrı API instance veya Supabase Edge Function).
- KDS (mutfak ekranı) — kullanıcı listeden çıkardı, sunumdan sonra konuşulabilir.
- `/api/reports/revenue` aggregate endpoint (hacim büyüyünce client-side gruplama yetmediğinde).

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

- **Migration `AddCustomers.cs` dosyası eksik:** Sprint 6 sırasında EF tool yan etkisi olarak silindi. Supabase'in `__EFMigrationsHistory` tablosunda kayıt duruyor, runtime'da pending değil olarak görülüyor. Sadece rollback senaryosunda Down çalıştırılamaz (production'da gerek yok). Restore istenirse `dotnet ef migrations script` ile mevcut Supabase şemasından SQL üretip yeni bir migration .cs olarak yapay üretmek mümkün.
- **`UpdateOrderDetailsRequest.customerId?` yok:** Mevcut siparişe sonradan müşteri linkleme yapılmıyor (sadece create'te). Faz C'de düzeltilecek.
- **Fiş header'ı sadece `store.name` gösteriyor:** Adres/telefon için `LoginResponse.store`'u `StoreSummaryDto` → tam `StoreDto`'ya genişletmek gerek (Faz E ayar paneli ile).
- **Eski `components/ui/{Button,Card,Input,Modal,Select}.tsx` hala kullanılıyor:** /admin tablo sayfaları ve dialog'lar bu eski componentleri kullanıyor. Brand uyumlu (orange-600), aciliyet yok ama tam tutarlılık için sonraki iterasyonda ui-v2'ye taşı.
- **OptionsDialog Modal'da kaldı:** Bottom Sheet'e geçiş kasiyer UX'ini iyileştirir, yarın yapılacak.
- **Render keep-alive cron yok:** Production deploy edilince eklenecek.
- **Cloud Supabase'de outbox_events tablosu henüz yok:** Backend `AddCustomersAndOutbox` migration'ı henüz Supabase'e uygulanmadı (kullanıcı `dotnet ef database update` çalıştırmalı). Ayrıca cloud taraftaki SyncController için ayrı API instance veya Supabase Edge Function kurulumu sırada.
- **Sync HMAC secret henüz set edilmedi:** `appsettings.Development.json`'a `Sync:HmacSecret` (32+ char) + `Sync:CloudBaseUrl` eklenmeli. Şu an `Sync:Enabled = false` default.

### Dosya Haritası (referans)

```
backend/PizzaPos.Api/
├── Entities/                    BaseEntity, TenantEntity, Store, Table, Category,
│                                Product, ProductOption, Order, OrderItem,
│                                OrderItemOption, Payment, User, Customer,
│                                CustomerAddress, OutboxEvent, Enums
├── Data/                        AppDbContext, ITenantProvider,
│                                SessionTenantProvider, HeaderTenantProvider,
│                                DesignTimeDbContextFactory (provider-aware)
├── DTOs/                        Store/Table/Category/Product/Order/Payment/
│                                User/Customer/Auth Dtos
├── Services/                    I*Service + *Service, IOutboxEmitter +
│                                OutboxEmitter, DomainException,
│                                DomainExceptionHandler
├── Auth/                        JwtTokenService, BCryptPasswordHasher,
│                                AuthService, JwtOptions, claim helpers
├── Sync/                        OutboxEvent (Entities), SyncOptions,
│                                HmacSignature, SyncWorker (BackgroundService)
├── Controllers/                 Health, Stores, Tables, Categories, Products,
│                                Orders, Auth, Users, Customers,
│                                CustomerAddresses, Sync (ingest + changes)
├── Migrations/
│   ├── Postgres/                InitialCreate, AddUsersAndAuditUser,
│   │                            AddCustomersAndOutbox + Designer + ModelSnapshot
│   └── Sqlite/                  README_TODO.md (ilk migration sabah üretilecek)
├── Program.cs                   provider-aware DB registration, JWT bearer,
│                                SyncWorker conditional registration
├── appsettings.json             Database:* + Sync:* + Auth:Jwt:* placeholder
└── appsettings.Development.json gitignore'da, gerçek Supabase pooler connection

electron/                        (Sprint 2 — yeni)
├── package.json                 electron 33 + electron-builder 25 + ts 5.6
├── tsconfig.json
├── electron-builder.yml         NSIS installer, asar, extraResources resources/api
├── src/main.ts                  child process orchestrator + crash recovery
├── src/preload.ts               contextBridge minimal
├── scripts/publish-api.ps1      .NET self-contained win-x64 single-file publish
├── resources/api/               (publish-api.ps1 buraya çıkarır — gitignore)
└── README.md                    dev workflow + production build

frontend/src/
├── app/
│   ├── layout.tsx + globals.css AuthProvider, Tailwind v4 + shadcn HSL token,
│   │                            tw-animate-css, brand orange (--primary)
│   ├── page.tsx                 landing redirect (auth role'üne göre)
│   ├── design/page.tsx          shadcn primitive showcase (preview)
│   ├── login/page.tsx           ui-v2 (Card + Input + Label + Select + Pizza)
│   ├── setup/page.tsx           ui-v2 (Card + Input + Label + Pizza)
│   ├── admin/
│   │   ├── layout.tsx           sidebar lucide ikonları + brand "P" logo
│   │   ├── page.tsx             KPI Card + Skeleton + recharts
│   │   ├── revenue-charts.tsx
│   │   ├── categories/page.tsx  (eski ui/ — ui-v2 migration sırada)
│   │   ├── tables/page.tsx
│   │   ├── products/{page,product-options-editor}.tsx
│   │   ├── orders/page.tsx
│   │   ├── customers/page.tsx
│   │   └── users/page.tsx
│   ├── pos/
│   │   ├── layout.tsx           AuthGuard role=Cashier
│   │   ├── page.tsx             masa ızgarası (kart + durum şeridi + Badge)
│   │   └── table/[id]/
│   │       ├── page.tsx                   async params (Next 16)
│   │       ├── order-screen.tsx           ui-v2 Button (touch) + Badge
│   │       ├── options-dialog.tsx         (eski Modal — Sheet'e migrate sırada)
│   │       ├── payment-dialog.tsx         (eski Modal)
│   │       └── details-dialog.tsx         (eski Modal + CustomerSearch)
│   └── print/receipt/[orderId]/  80mm fiş layout, auto window.print()
├── components/
│   ├── AuthGuard, UserMenu, CustomerSearch
│   ├── ui/                      eski sistem (Button, Card, Input, Modal, Select)
│   │                            — orange brand, ui-v2 migration sırada
│   └── ui-v2/                   shadcn primitive (Sprint 3 — yeni)
│       button, card, dialog, sheet, input, label, badge, skeleton,
│       separator, tabs, select, empty-state, toaster
├── lib/                         api, env, format, auth-context, store-context,
│                                use-store-api, utils (cn helper)
└── types/api.ts                 backend DTO'larını birebir aynalar
```

### Rapor Dosyaları (repo kökü)

- `REPORT_BACKEND.md` — Sprint 0+1+2 detayı, sabah komutları, karar noktaları (gece çalışmasından).
- `REPORT_FRONTEND.md` — Sprint 3 detayı, shadcn kurulumu (gece çalışmasından).
- `REPORT_FINAL.md` — Sprint 0-6 toplu özet, test sonuçları, sonraki sprint önerileri.
