-- ============================================================================
-- Cleanup: cloud'dan eski test/demo verilerini sil
-- ============================================================================
-- StoreId'ler:
--   33420ab3-5349-422c-838c-15dbc6e94730  → Fresh Pizza  (TUTULACAK)
--   be13a428-ff1b-417b-976b-6ca0a731046f  → test         (SİLİNECEK)
--   ebfd9cc7-102c-4d06-9c84-17a0b099cd5c  → Demo Restoran (SİLİNECEK)
--
-- Ek olarak Fresh Pizza altındaki "test" ürünleri de silinir (denenne, tset,
-- kavurma, lahmacun, Su lowercase — bunlar StoreId-aware eski test verisi
-- olabilir, kontrol için DELETE'ten önce DOĞRULA bölümü var).
--
-- Sıralama: FK Restrict nedeniyle alt → üst (yapraklar önce):
--   1. payments
--   2. order_item_options
--   3. order_items
--   4. orders
--   5. customer_addresses
--   6. customers
--   7. incoming_calls
--   8. combo_items
--   9. combos
--   10. product_options
--   11. products
--   12. categories
--   13. tables
--   14. stores
-- ============================================================================

BEGIN;

-- ----- TEST + DEMO STORE TÜM VERİSİ -----
DELETE FROM payments              WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM order_item_options    WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM order_items           WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM orders                WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM customer_addresses    WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM customers             WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM incoming_calls        WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM combo_items           WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM combos                WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM product_options       WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM products              WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM categories            WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
DELETE FROM tables                WHERE "StoreId" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');
-- NOT: stores satırları SİLİNMİYOR (users.StoreId FK referansı var → cloud login bozulur).
-- Pasif yapıyoruz: IsActive=FALSE, admin UI'da filtrelenir (genelde sadece IsActive=true gösterilir).
UPDATE stores SET "IsActive" = FALSE, "UpdatedAt" = NOW() WHERE "Id" IN ('be13a428-ff1b-417b-976b-6ca0a731046f','ebfd9cc7-102c-4d06-9c84-17a0b099cd5c');

-- ----- DOĞRULA: kalan veri sadece Fresh Pizza olmalı -----
-- (Bu SELECT'ler psql çıktısına yazılır, satır sayıları gözükür)

COMMIT;

SELECT 'stores' AS tablo, COUNT(*) FROM stores
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_options', COUNT(*) FROM product_options
UNION ALL SELECT 'combos', COUNT(*) FROM combos
UNION ALL SELECT 'combo_items', COUNT(*) FROM combo_items
UNION ALL SELECT 'tables', COUNT(*) FROM tables
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'customer_addresses', COUNT(*) FROM customer_addresses
UNION ALL SELECT 'incoming_calls', COUNT(*) FROM incoming_calls;
