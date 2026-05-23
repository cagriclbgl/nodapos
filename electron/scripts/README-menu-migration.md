# Kasa → Cloud Menü Migration

Bu klasördeki `export-menu-to-cloud.mjs`, kasa SQLite'taki **kategori + ürün + ürün opsiyonu** verilerini cloud Postgres'e bir kerelik taşımak için. Cloud devreye girmeden önce kasada yaratılmış menü (lazy-backfill ile cloud'da sadece placeholder olarak gözüküyor) cloud'a bu script ile aktarılır. Sonrasında mimari kural devreye girer: **menü değişiklikleri yalnızca cloud admin panelinden yapılır**, kasa pull eder.

## Akış Özeti

```
[kasa SQLite]                      [Hetzner sunucu]                  [cloud Postgres]
  pos.db   ──→ menu-migration.sql ──→ /tmp/migration.sql ──→ docker exec psql -f
  (script)                                                      (idempotent UPSERT)
```

## Önkoşullar

- **Kasa makinesinde:**
  - Node.js (Electron kullandığımız için zaten var, `node --version` ile teyit et)
  - SSH erişimi (`ssh root@178.104.44.239` çalışıyor olmalı)
  - `scp` (Windows 10+ varsayılan, yoksa OpenSSH client kurulu)
- **Hetzner'da:** docker, docker compose, çalışan `pizzapos-postgres` container'ı

## Adımlar

### 1. Kasa'da: bağımlılığı kur

```powershell
cd C:\Users\w11\Desktop\menu\electron
npm install --no-save better-sqlite3
```

`--no-save` flag'i, `package.json`'a yazmaması için (bu sadece migration için, runtime bağımlılığı değil).

> Eğer `better-sqlite3` native build hatası verirse: bu makinede zaten node-hid/usb prebuilt'leri kullanıyoruz, build toolchain'i olmalı. Yine de patlarsa prebuilt sürümü zorla: `npm install --no-save better-sqlite3@latest --build-from-source=false`.

### 2. Kasa'da: SQL dosyasını üret

```powershell
cd C:\Users\w11\Desktop\menu\electron
node scripts/export-menu-to-cloud.mjs
```

Default kaynak: `%APPDATA%\pizzapos-desktop\pos.db` (Electron `app.getName()` `package.json` `name` alanından okur, `pizzapos-desktop`). Farklıysa:

```powershell
node scripts/export-menu-to-cloud.mjs -i "C:\başka\yol\pos.db"
```

Çıktı: `menu-migration.sql` (electron/ klasöründe). Konsola sayım yazar:

```
Kaynak: C:\Users\<kullanıcı>\AppData\Roaming\pizzapos-desktop\pos.db
Çıktı:  menu-migration.sql
StoreId: <guid>
Kategori: 4, Ürün: 23, Opsiyon: 67
✓ menu-migration.sql yazıldı (12.4 KB)
```

### 3. SQL dosyasını gözden geçir

Üretilen `menu-migration.sql`'i bir editörde aç:

- Üst kısımdaki **StoreId** değerini not et. Cloud'da `SELECT "Id", "Name" FROM stores;` ile eşleşip eşleşmediğini doğrula. Eşleşmiyorsa **DUR**, migration yapma — sorunlu durum.
- INSERT bloklarındaki ürün isimlerine göz at, mantıklı mı.
- En alttaki "CLEANUP" bölümü yorumlu (`-- DELETE …`) — eski dev test verisini silmek istiyorsan o iki satırın başındaki `-- `'i kaldır. Şüphedeyken bırak, sonra admin panelden tek tek temizle.

### 4. Hetzner'a yükle

Kasa terminalinden:

```powershell
scp menu-migration.sql root@178.104.44.239:/tmp/
```

### 5. Hetzner'da: psql ile uygula

```bash
ssh root@178.104.44.239
docker cp /tmp/menu-migration.sql pizzapos-postgres:/tmp/menu-migration.sql

# Credentials (env var olarak set et, parola plain text görünmesin)
export PGUSER=$(grep POSTGRES_USER /opt/pizzapos/cloud/.env | cut -d= -f2)
export PGDB=$(grep POSTGRES_DB /opt/pizzapos/cloud/.env | cut -d= -f2)

# Uygula
docker exec -i pizzapos-postgres psql -U "$PGUSER" -d "$PGDB" -f /tmp/menu-migration.sql
```

Beklenen çıktı (örnek):

```
BEGIN
INSERT 0 4
INSERT 0 23
INSERT 0 67
COMMIT
```

Hata olursa `BEGIN/COMMIT` içinde otomatik rollback olur, hiçbir değişiklik yapılmaz. Hatayı düzelt, baştan dene.

### 6. Doğrula

```bash
docker exec -i pizzapos-postgres psql -U "$PGUSER" -d "$PGDB" -c \
  'SELECT '"'"'categories'"'"' AS tablo, COUNT(*) FROM categories
   UNION ALL SELECT '"'"'products'"'"', COUNT(*) FROM products
   UNION ALL SELECT '"'"'product_options'"'"', COUNT(*) FROM product_options;'
```

Sayılar artmış olmalı. Placeholder ürünler (Büyük Boy Menü, Ayran, vb.) artık `IsAvailable=true`, `DisplayOrder` gerçek değerinde, doğru kategorisinde.

### 7. Admin panelden kontrol

`https://nodapos.com/admin/products` — listede bütün gerçek menü gözükmeli, hepsi "Satışta". Test verisi (denenne, tset, kavurma, lahmacun, Su) hâlâ duruyorsa elle "Sil" tıkla (sipariş yoksa silinir, varsa cleanup SQL'ini kullan).

### 8. Kasa pull doğrulaması

Kasa Electron uygulaması arka planda `SyncPullWorker` ile 30 saniyede bir cloud'dan menü çekiyor. Migration sonrası ilk pull'da:

- Kasada zaten olan ürünler `UpdatedAt`'leri güncellenir (no-op effectively)
- Opsiyonlar wholesale replace olur (`SyncPullWorker.cs:245`) — aynı veri olduğu için yine no-op

Beklemek istemezsen kasa Electron'unu kapat-aç (30 sn polling yerine startup pull tetiklenir).

## Tekrar Çalıştırma

Script idempotent — aynı veriyle çalıştırırsan ikinci kez aynı sonucu üretir. Yeni ürün eklersen veya bir şey değişirse:

1. Script'i baştan çalıştır (yeni `menu-migration.sql` üretir)
2. scp + docker exec'i tekrar yap
3. ON CONFLICT DO UPDATE sayesinde sadece değişenler güncellenir

Ama dikkat: bu **bir kerelik** bir köprü. Migration sonrası yeni bir ürün eklemen gerekirse **kasa'da değil, cloud admin panelinden** ekle. Kasa ürün yazımı için tek otorite cloud, kasa sadece pull eder.

## Sorun Giderme

**"SqliteException: database is locked"** — Kasa Electron çalışırken SQLite'a tek yazıcı bağlanabilir; readonly script okur ama bazen WAL mode'da kilit çakışması olabilir. Önce Electron'u kapat, script'i çalıştır, sonra Electron'u tekrar aç.

**"better-sqlite3 native build failed"** — Bu makinede VS 2026 + node-gyp uyumsuzluğu node-hid/usb'de de yaşanıyordu (electron-builder.yml:42-45). Prebuilt binary'i zorla:
```powershell
npm install --no-save better-sqlite3 --ignore-scripts
node -e "require('better-sqlite3')"  # gerçek hatayı görmek için
```

**"duplicate key value violates unique constraint"** — ON CONFLICT yazımı yanlış gitmiş veya başka bir unique constraint var. SQL dosyasındaki INSERT bloğunun başındaki `ON CONFLICT ("Id")` ifadesini incele.

**Cloud'da hâlâ kayıp ürünler var** — Script kasa SQLite'tan ne okuduysa o gider. Kasa'da o ürün **gerçekten var mı?** `sqlite3 pos.db "SELECT Name FROM products"` ile doğrula (veya DBeaver'da SQLite tarafına da bağlan).
