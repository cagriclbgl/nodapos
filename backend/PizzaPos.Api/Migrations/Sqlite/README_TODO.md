# SQLite Migrations

Bu klasör **boş** olarak başlar. SQLite migration'ı sabah aşağıdaki komutla üretilir:

```powershell
cd C:\Users\w11\Desktop\menu\backend\PizzaPos.Api
$env:DOTNET_ROLL_FORWARD = "Major"
$env:Database__Provider = "Sqlite"
$env:Database__SqlitePath = "pos.db"

# Migration adı 'InitialCreate' Postgres tarafında zaten kullanılıyor;
# çakışmamak için 'SqliteInitialCreate' kullanılır:
dotnet ef migrations add SqliteInitialCreate -o Migrations/Sqlite

# Sonra lokal pos.db'ye uygula:
dotnet ef database update
```

## ⚠️ Önemli: Snapshot çakışması

Bu repoda **iki migration provider'ı yan yana yaşıyor** (`Migrations/Postgres/` + `Migrations/Sqlite/`). EF Core tooling tek bir `AppDbContextModelSnapshot` arar ve **Postgres snapshot'ı** baz alır.

SQLite migration'ı üretirken EF tool, Postgres-spesifik annotation'ları (`Npgsql:ValueGenerationStrategy` vb.) snapshot'tan kaybedebilir. Bu durumda gerçekleşmesi gereken adımlar:

1. SQLite migration'ını ürettikten sonra `Migrations/Postgres/AppDbContextModelSnapshot.cs`'i **git'ten geri al** (commit edilmediyse manuel tut).
2. Veya `Migrations/Sqlite/`'a kendi snapshot'ını üretmek için `--namespace PizzaPos.Api.Migrations.Sqlite` ekle.

## Provider switch

```powershell
# Postgres mode (cloud)
$env:Database__Provider = "Postgres"
dotnet run

# Sqlite mode (offline kasa)
$env:Database__Provider = "Sqlite"
$env:Database__SqlitePath = "pos.db"
$env:Sync__Enabled = "true"   # opsiyonel — outbox'ı cloud'a göndermek için
dotnet run
```

## Decimal hassasiyeti notu

Postgres `numeric(18,2)` SQLite'da REAL (double) olarak saklanır. Para hassasiyeti için ileride decimal → string value converter eklenebilir; MVP için yeterli.
