# PizzaPos Cloud Deployment

Hetzner Ubuntu 24.04 sunucusunda Docker Compose üzerinden çalışan üç-konteynerli stack: **PostgreSQL 16 + .NET 10 API + Caddy (auto-HTTPS)**.

Her kasanın (Electron) push/pull yöneldiği "cloud" instance burası. Frontend (yönetici paneli) Vercel'de host edilir — bu sunucuda frontend YOK.

## Bir Kerelik Kurulum

### 1) DNS

Cloudflare'de A kaydı:
- `api.nodapos.com` → `178.104.44.239` (proxy KAPALI olsun ki Caddy ACME challenge'ı çalışsın; cert alındıktan sonra istersen aç)

### 2) Repo'yu sunucuya çek

```bash
cd /opt
git clone <repo-url> pizzapos
cd pizzapos/cloud
```

### 3) `.env` doldur

```bash
cp .env.example .env
nano .env
# - POSTGRES_PASSWORD: openssl rand -base64 32
# - JWT_SECRET:        openssl rand -hex 48
# - HMAC_SECRET:       openssl rand -hex 48   ← BU değeri bir yere not et,
#                                               her kasaya aynısını vereceğiz
chmod 600 .env
```

### 4) Stack'i ayağa kaldır

```bash
docker compose up -d --build
docker compose ps        # üç container 'running' / 'healthy' olmalı
docker compose logs -f api
```

İlk açılışta API:
- Postgres'e bağlanır
- Schema yoksa `EnsureCreated` ile kurar (sonra ilk migration'ı manuel uygulayacağız — aşağı bak)
- Supervisor user'ı bootstrap eder

### 5) İlk Postgres migration'ı

İlk açılışta `EnsureCreated` çalıştığı için tablolar var. Production'da migration disiplinine geçmek için:

```bash
docker compose exec api dotnet ef migrations script -o /tmp/init.sql
# (geliştirme makinende üretilen migration .sql'i de kullanabilirsin)
```

> Not: İlk dağıtımda EnsureCreated yeterli. Sonraki schema değişiklikleri için her zaman migration üretilip `dotnet ef database update` ile uygulanmalı.

## Operasyonel İşler

### Loglar
```bash
docker compose logs -f api
docker compose logs -f caddy
```

### Backup (Postgres)
```bash
docker compose exec postgres pg_dump -U pizzapos -d pizzapos -F c -f /tmp/backup.dump
docker cp pizzapos-postgres:/tmp/backup.dump ./backup-$(date +%F).dump
```

Restore:
```bash
docker cp backup.dump pizzapos-postgres:/tmp/restore.dump
docker compose exec postgres pg_restore -U pizzapos -d pizzapos --clean --if-exists /tmp/restore.dump
```

### Update (yeni kod deploy)
```bash
cd /opt/pizzapos
git pull
cd cloud
docker compose build api
docker compose up -d api
docker compose logs -f api
```

### Sertifika

Caddy ilk açılışta `api.nodapos.com` için Let's Encrypt'ten cert alır. `/data` volume'ünde saklanır — yeniden başlatmalarda kaybolmaz. Otomatik yenileme.

DNS daha hazır değilse veya port 80 kapalıysa Caddy hata verir; önce A kaydı + 80 erişimi doğrula.

## Kasa Tarafı

Her Electron kurulumunda (`%APPDATA%\pizzapos-desktop\` makinesinde):

```powershell
# Kalıcı env vars
[Environment]::SetEnvironmentVariable("PIZZAPOS_CLOUD_URL", "https://api.nodapos.com", "User")
[Environment]::SetEnvironmentVariable("PIZZAPOS_HMAC_SECRET", "<HMAC_SECRET değeri>", "User")
```

Sonra Electron'u başlat. `main.ts` bu env'leri okuyup .NET API'ye `Sync__CloudBaseUrl` ve `Sync__HmacSecret` olarak iletir. SyncWorker (push) ve SyncPullWorker (pull) otomatik aktif olur.

## Mimari Notlar

- **Tek yön**: kasa Postgres'e doğrudan bağlanmaz. Sadece `https://api.nodapos.com` üzerinden HMAC imzalı sync çağrıları.
- **Caddy iç ağ**: API 5000 portu sadece docker network'ünde açık, dışarıdan erişilemez.
- **Postgres dışa kapalı**: 5432 expose'lanmıyor. Backup için `docker compose exec` kullan.
- **HMAC secret**: kasa ve cloud'un aynı string'i bilmesi lazım. Kaybedersen rotate etmek için yeni HMAC üret + tüm kasalara dağıt.
