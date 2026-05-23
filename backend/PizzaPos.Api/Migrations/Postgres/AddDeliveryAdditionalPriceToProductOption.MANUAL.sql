-- Manuel uygulama (Hetzner Postgres'e) — paket servis option ek fiyatı ayrımı.
-- API container'ı zaten Database.MigrateAsync ile bu kolonu otomatik ekler;
-- bu SQL sadece manuel teyit/rollback senaryoları için.

BEGIN;

ALTER TABLE product_options
    ADD COLUMN IF NOT EXISTS "DeliveryAdditionalPrice" numeric(18,2) NULL;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260522180000_AddDeliveryAdditionalPriceToProductOption', '9.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;

COMMIT;
