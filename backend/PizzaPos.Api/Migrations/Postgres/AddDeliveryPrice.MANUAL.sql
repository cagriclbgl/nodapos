-- Manuel uygulama (Hetzner Postgres'e) — v0.1.9 cloud deploy öncesi.
-- CLAUDE.md'deki pattern: migration'ları EF'le otomatik değil, SQL ile elle
-- atıyoruz; sonra __EFMigrationsHistory'ye kayıt ekliyoruz ki bir sonraki
-- container start'ında EF "applied" sayıp tekrar denemesin.

BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS "DeliveryPrice" numeric(18,2) NULL;
ALTER TABLE combos   ADD COLUMN IF NOT EXISTS "DeliveryPrice" numeric(18,2) NULL;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260512100000_AddDeliveryPrice', '9.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;

COMMIT;
