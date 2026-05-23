-- ============================================================================
-- NodaPos Menu Migration: Kasa SQLite → Cloud Postgres
-- ============================================================================
-- Kaynak SQLite : C:\Users\w11\Desktop\pos.db
-- Üretildi      : 2026-05-15T17:58:34.845Z
-- StoreId       : 33420AB3-5349-422C-838C-15DBC6E94730
-- Sayım         : 4 kategori, 23 ürün, 21 opsiyon
-- ============================================================================
--
-- Bu script idempotent — birden fazla kez çalıştırmak güvenli, aynı ID'ler
-- update olur (insert değil). BEGIN/COMMIT içinde, hata olursa rollback.
--
-- Cloud StoreId'sinin yukarıdaki ile eşleştiğini önce doğrula:
--   SELECT "Id", "Name" FROM stores;
-- Eşleşmiyorsa cloud'da farklı bir mağaza var demek — migration yapma.

BEGIN;

-- ----------------------------------------------------------------------------
-- KATEGORİLER (4)
-- ----------------------------------------------------------------------------
INSERT INTO categories ("Id", "StoreId", "Name", "Description", "DisplayOrder", "IsActive", "CreatedAt", "UpdatedAt") VALUES
  ('2038b015-e6df-4ed2-b211-547a8fc4f111', '33420ab3-5349-422c-838c-15dbc6e94730', 'PİZZALAR', '', 0, TRUE, '2026-05-12 09:03:48.8128059', NULL),
  ('e187f4bd-775a-4340-a6c5-b6a17a8756ac', '33420ab3-5349-422c-838c-15dbc6e94730', 'İÇECEKLER', '', 1, TRUE, '2026-05-12 09:03:48.8128059', NULL),
  ('9a6f4b8b-d84c-4fd3-bfed-0f8e484bab3f', '33420ab3-5349-422c-838c-15dbc6e94730', 'APARATİFLER', '', 2, TRUE, '2026-05-12 09:03:48.8128059', NULL),
  ('8f0ade6b-cc11-4ee8-8b24-19c3804529eb', '33420ab3-5349-422c-838c-15dbc6e94730', 'TATLILAR', '', 3, TRUE, '2026-05-12 09:03:48.8128059', NULL)
ON CONFLICT ("Id") DO UPDATE SET
  "StoreId" = EXCLUDED."StoreId",
  "Name" = EXCLUDED."Name",
  "Description" = EXCLUDED."Description",
  "DisplayOrder" = EXCLUDED."DisplayOrder",
  "IsActive" = EXCLUDED."IsActive",
  "UpdatedAt" = NOW();

-- ----------------------------------------------------------------------------
-- ÜRÜNLER (23)
-- Lazy-backfill placeholder'lar (cloud'da DisplayOrder=9999, IsAvailable=false)
-- bu UPSERT ile yerinde güncellenir: doğru fiyat, kategori, sıra, IsAvailable=true.
-- ----------------------------------------------------------------------------
INSERT INTO products ("Id", "StoreId", "CategoryId", "Name", "Description", "Price", "DeliveryPrice", "ImageUrl", "IsAvailable", "DisplayOrder", "CreatedAt", "UpdatedAt") VALUES
  ('826b04c2-669c-46e8-a1a2-2ece02aa6def', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Su', NULL, 10, NULL, NULL, FALSE, 9999, '2026-05-12 09:34:08.2578796', '2026-05-15 11:49:43.0311472'),
  ('1aa8197d-abe8-4821-af94-62076da1dfe3', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Soğan Halkası', NULL, 30, NULL, NULL, FALSE, 9999, '2026-05-12 09:35:48.3517288', '2026-05-15 10:36:25.3837913'),
  ('506a12bd-1f26-433c-9c29-23e083f956c8', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Büyük Boy Menü', '', 450, NULL, '', TRUE, 9999, '2026-05-12 09:21:07.0416307', '2026-05-14 08:27:29.7459831'),
  ('8d6ded05-26f6-4165-96fb-303be378442b', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Margarita Pizza', 'Pizza sosu, duble mozzarella peynir', 150, '180.0', '', TRUE, 1, '2026-05-12 09:22:45.5927507', '2026-05-12 10:34:03.9907849'),
  ('adc3b9c3-fc25-4cf4-8a99-a4b7c1b86f9c', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Vejeteryan Pizza', '', 150, NULL, '', TRUE, 9999, '2026-05-12 09:23:47.3769195', '2026-05-14 08:27:42.4970755'),
  ('ba306672-106e-44ff-856a-b6324e28b6ac', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Mantarlı Sucuklu Pizza', 'Pizza sosu, duble mozzarella peyniri, mantar', 250, '320.0', '', TRUE, 3, '2026-05-12 09:24:45.425037', '2026-05-12 10:34:28.0557043'),
  ('672a09c5-86a2-4c3f-ade1-feb1ed3f1e64', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Kavurmalı Pizza', 'Mozzarella peynir, kavurma, kekik', 400, NULL, '', TRUE, 4, '2026-05-12 09:25:31.7125085', NULL),
  ('33f04f86-1e59-46ee-8229-dfc2eb65fe44', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Küp Sucuklu Pizza', 'Pizza sosu, mozzarella peyniri, sucuk', 250, '320.0', '', TRUE, 5, '2026-05-12 09:27:05.0259012', '2026-05-12 10:34:40.7891386'),
  ('37931918-bcb4-4316-8785-b6b11307d55d', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Ton Balıklı Pizza', 'Pizza sosu, mozzarella peyniri, ton balığı, mantar, mısır', 300, NULL, '', TRUE, 6, '2026-05-12 09:27:49.7456638', NULL),
  ('7d5a5146-d900-4c22-b29a-38f0c04a082f', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Tavuklu Pizza', 'Pizza sosu, duble mozzarella, tavuk ', 300, NULL, '', TRUE, 7, '2026-05-12 09:28:24.4096615', NULL),
  ('01745b56-cb17-4fa6-ab33-3ae06011350a', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Ayran', '', 30, NULL, '', TRUE, 9999, '2026-05-12 09:31:16.2021844', '2026-05-14 08:27:25.1139695'),
  ('a9c9e2e4-bae9-40f0-baf7-28444a89264c', '33420ab3-5349-422c-838c-15dbc6e94730', 'e187f4bd-775a-4340-a6c5-b6a17a8756ac', 'Pepsi Kutu', '', 50, NULL, '', TRUE, 1, '2026-05-12 09:32:49.7316802', NULL),
  ('d7f9be42-b31e-4874-a0ae-c50c7399b6fa', '33420ab3-5349-422c-838c-15dbc6e94730', 'e187f4bd-775a-4340-a6c5-b6a17a8756ac', 'Lipton Ice Tea', '', 50, NULL, '', TRUE, 2, '2026-05-12 09:33:30.3464614', NULL),
  ('eae76c77-4b79-4660-bbd3-8b07c7e4fb52', '33420ab3-5349-422c-838c-15dbc6e94730', 'e187f4bd-775a-4340-a6c5-b6a17a8756ac', 'Gazoz', '', 40, NULL, '', TRUE, 3, '2026-05-12 09:33:50.4802859', NULL),
  ('2633c408-5ac3-4b06-a00c-85885aa59d5a', '33420ab3-5349-422c-838c-15dbc6e94730', 'e187f4bd-775a-4340-a6c5-b6a17a8756ac', 'Soda', '', 30, NULL, '', TRUE, 4, '2026-05-12 09:33:58.0247226', NULL),
  ('4920deff-c176-40e1-bc55-e84a3e99dc1c', '33420ab3-5349-422c-838c-15dbc6e94730', 'e187f4bd-775a-4340-a6c5-b6a17a8756ac', 'Kutu Meyve Suyu', '', 50, NULL, '', TRUE, 5, '2026-05-12 09:34:28.7526594', '2026-05-12 09:35:17.3458827'),
  ('ac653580-4f35-4800-b5e7-796a14a1fad0', '33420ab3-5349-422c-838c-15dbc6e94730', 'e187f4bd-775a-4340-a6c5-b6a17a8756ac', 'Şişe Pepsi', '', 35, NULL, '', TRUE, 1, '2026-05-12 09:34:49.7708784', '2026-05-12 09:35:11.3643826'),
  ('c0eb9028-383c-4bc5-899a-7615ed0ed869', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'Tavuk Parçacıkları', '', 79.99, NULL, '', TRUE, 9999, '2026-05-12 09:36:30.847727', '2026-05-14 08:27:37.3634754'),
  ('cb17c054-73b4-423e-97f0-1bab6ae4faa5', '33420ab3-5349-422c-838c-15dbc6e94730', '9a6f4b8b-d84c-4fd3-bfed-0f8e484bab3f', 'Patates', '', 120, NULL, '', TRUE, 2, '2026-05-12 09:36:56.3949739', NULL),
  ('440d508b-c097-4c64-87c9-bfc506e52785', '33420ab3-5349-422c-838c-15dbc6e94730', '9a6f4b8b-d84c-4fd3-bfed-0f8e484bab3f', 'Sarımsaklı Mozzarella''lı Ekmek', '', 140, NULL, '', TRUE, 3, '2026-05-12 09:37:10.2655645', NULL),
  ('53b7d1ba-21e7-4cb6-99c3-ef4b428a4683', '33420ab3-5349-422c-838c-15dbc6e94730', '9a6f4b8b-d84c-4fd3-bfed-0f8e484bab3f', 'Nugget', '', 40, NULL, '', TRUE, 4, '2026-05-12 09:37:19.4984039', NULL),
  ('d9bac2ea-e317-4557-9f4e-ef5a35f76709', '33420ab3-5349-422c-838c-15dbc6e94730', '8f0ade6b-cc11-4ee8-8b24-19c3804529eb', 'Sufle', '', 130, NULL, '', TRUE, 0, '2026-05-12 10:33:23.0325095', NULL),
  ('851f66e3-e81a-4e90-82ef-7e977f249154', '33420ab3-5349-422c-838c-15dbc6e94730', '2038b015-e6df-4ed2-b211-547a8fc4f111', 'KARIŞIK', '', 150, '0.0', '', TRUE, 9999, '2026-05-14 08:25:09.0755203', '2026-05-15 14:38:25.7312277')
ON CONFLICT ("Id") DO UPDATE SET
  "StoreId" = EXCLUDED."StoreId",
  "CategoryId" = EXCLUDED."CategoryId",
  "Name" = EXCLUDED."Name",
  "Description" = EXCLUDED."Description",
  "Price" = EXCLUDED."Price",
  "DeliveryPrice" = EXCLUDED."DeliveryPrice",
  "ImageUrl" = EXCLUDED."ImageUrl",
  "IsAvailable" = EXCLUDED."IsAvailable",
  "DisplayOrder" = EXCLUDED."DisplayOrder",
  "UpdatedAt" = NOW();

-- ----------------------------------------------------------------------------
-- ÜRÜN OPSİYONLARI (21)
-- Çakışma davranışı: aynı ID → update. Cloud'da kasadaki ID ile eşleşmeyen ama
-- aynı ürüne bağlı eski/farklı opsiyonlar varsa burada silinmez — SyncPullWorker
-- bir sonraki pull'da o ürünü pull edip "wholesale replace" yapacağı için kasa'dakine
-- eşitlenir (SyncPullWorker.cs:245). Cloud'da takılan eski option ID'lerini admin
-- panelinden manuel temizle.
-- ----------------------------------------------------------------------------
INSERT INTO product_options ("Id", "StoreId", "ProductId", "GroupName", "Name", "AdditionalPrice", "IsRequired", "IsActive", "DisplayOrder", "CreatedAt", "UpdatedAt") VALUES
  ('ce89f6bf-f1d4-45d4-8761-2182b572010f', '33420ab3-5349-422c-838c-15dbc6e94730', '33f04f86-1e59-46ee-8229-dfc2eb65fe44', 'Boyut', 'Orta', 0, TRUE, TRUE, 0, '2026-05-12 09:27:16.8892455', NULL),
  ('7559b7a7-0c01-4346-8b87-dd79c31fd38e', '33420ab3-5349-422c-838c-15dbc6e94730', '33f04f86-1e59-46ee-8229-dfc2eb65fe44', 'Boyut', 'Büyük', 70, TRUE, TRUE, 1, '2026-05-12 09:27:16.8942502', NULL),
  ('7440d75c-5f09-4450-81f8-bde1ffe765ec', '33420ab3-5349-422c-838c-15dbc6e94730', '37931918-bcb4-4316-8785-b6b11307d55d', 'Boyut', 'Orta', 0, TRUE, TRUE, 0, '2026-05-12 09:27:57.5853357', NULL),
  ('1e54a155-6147-4649-a6d0-934e8bb2798a', '33420ab3-5349-422c-838c-15dbc6e94730', '37931918-bcb4-4316-8785-b6b11307d55d', 'Boyut', 'Büyük', 150, TRUE, TRUE, 1, '2026-05-12 09:27:57.5908729', NULL),
  ('b128c5ea-ce70-4e8c-848e-c31a77011f27', '33420ab3-5349-422c-838c-15dbc6e94730', '53b7d1ba-21e7-4cb6-99c3-ef4b428a4683', 'Boyut', '3''lü', 0, TRUE, TRUE, 0, '2026-05-12 09:37:36.2187774', NULL),
  ('f5a9b343-25c6-4b14-85a9-02169be538a8', '33420ab3-5349-422c-838c-15dbc6e94730', '53b7d1ba-21e7-4cb6-99c3-ef4b428a4683', 'Boyut', '6''lı', 20, TRUE, TRUE, 1, '2026-05-12 09:37:36.2273294', NULL),
  ('c52e178f-e8d5-4dcc-8eed-db374b4a721e', '33420ab3-5349-422c-838c-15dbc6e94730', '53b7d1ba-21e7-4cb6-99c3-ef4b428a4683', 'Boyut', '9''lu', 45, TRUE, TRUE, 2, '2026-05-12 09:37:36.2385072', NULL),
  ('31602ea5-3e71-423f-95ef-27d3d6061f01', '33420ab3-5349-422c-838c-15dbc6e94730', '672a09c5-86a2-4c3f-ade1-feb1ed3f1e64', 'Boyut', 'Orta', 0, TRUE, TRUE, 0, '2026-05-12 09:26:40.2722364', NULL),
  ('ece8a28c-f81c-4fa6-8013-3ffef5ebfa95', '33420ab3-5349-422c-838c-15dbc6e94730', '672a09c5-86a2-4c3f-ade1-feb1ed3f1e64', 'Boyut', 'Büyük', 100, TRUE, TRUE, 1, '2026-05-12 09:26:40.2781381', NULL),
  ('af87b8ad-32ac-48db-905e-75b95b5f8d9e', '33420ab3-5349-422c-838c-15dbc6e94730', '7d5a5146-d900-4c22-b29a-38f0c04a082f', 'Boyut', 'Orta', 0, TRUE, TRUE, 0, '2026-05-12 09:28:33.8813859', NULL),
  ('e5843d3a-5f27-48e1-ac01-243aa75cdcef', '33420ab3-5349-422c-838c-15dbc6e94730', '7d5a5146-d900-4c22-b29a-38f0c04a082f', 'Boyut', 'Büyük', 90, TRUE, TRUE, 1, '2026-05-12 09:28:33.8866488', NULL),
  ('10c454d4-b103-40c9-a75c-393143ac32d9', '33420ab3-5349-422c-838c-15dbc6e94730', '851f66e3-e81a-4e90-82ef-7e977f249154', 'Boyut', 'Küçük', 0, TRUE, TRUE, 0, '2026-05-15 14:40:11.27169', NULL),
  ('97256202-237d-4782-b37c-1c93e4549408', '33420ab3-5349-422c-838c-15dbc6e94730', '851f66e3-e81a-4e90-82ef-7e977f249154', 'Boyut', 'Orta', 50, TRUE, TRUE, 1, '2026-05-15 14:40:11.3220607', NULL),
  ('a2948f87-cd6f-4483-8560-9b2487580671', '33420ab3-5349-422c-838c-15dbc6e94730', '851f66e3-e81a-4e90-82ef-7e977f249154', 'Boyut', 'Büyük', 150, TRUE, TRUE, 2, '2026-05-15 14:40:11.3289672', NULL),
  ('c0c1800a-7be8-460b-a213-b85939c53d1c', '33420ab3-5349-422c-838c-15dbc6e94730', '8d6ded05-26f6-4165-96fb-303be378442b', 'Boyut', 'Küçük', 0, TRUE, TRUE, 0, '2026-05-12 09:23:04.2408178', NULL),
  ('35709cbb-078d-4771-bbfd-8c4149182b99', '33420ab3-5349-422c-838c-15dbc6e94730', '8d6ded05-26f6-4165-96fb-303be378442b', 'Boyut', 'Orta', 40, TRUE, TRUE, 1, '2026-05-12 09:23:04.2476265', NULL),
  ('b6a72105-5b2f-4554-84b8-4bd7957537d7', '33420ab3-5349-422c-838c-15dbc6e94730', '8d6ded05-26f6-4165-96fb-303be378442b', 'Boyut', 'Büyük', 140, TRUE, TRUE, 2, '2026-05-12 09:23:04.254074', NULL),
  ('3bebc877-8e31-4116-b72a-d81617c4a644', '33420ab3-5349-422c-838c-15dbc6e94730', 'a9c9e2e4-bae9-40f0-baf7-28444a89264c', 'Boyut', '330 Ml', 0, TRUE, TRUE, 0, '2026-05-12 09:33:09.6814765', NULL),
  ('bddaed4f-cda4-4117-8d8c-377dcb0bf4f2', '33420ab3-5349-422c-838c-15dbc6e94730', 'a9c9e2e4-bae9-40f0-baf7-28444a89264c', 'Boyut', '1 Litre', 30, TRUE, TRUE, 1, '2026-05-12 09:33:09.6882214', NULL),
  ('cbe0fa16-be11-4527-a111-8e00c531fb89', '33420ab3-5349-422c-838c-15dbc6e94730', 'ba306672-106e-44ff-856a-b6324e28b6ac', 'Boyut', 'Orta', 0, TRUE, TRUE, 0, '2026-05-12 09:24:58.9770001', NULL),
  ('b0aab14d-dfc3-4d69-9820-774e74be30bd', '33420ab3-5349-422c-838c-15dbc6e94730', 'ba306672-106e-44ff-856a-b6324e28b6ac', 'Boyut', 'Büyük', 70, TRUE, TRUE, 1, '2026-05-12 09:24:58.9824186', NULL)
ON CONFLICT ("Id") DO UPDATE SET
  "StoreId" = EXCLUDED."StoreId",
  "ProductId" = EXCLUDED."ProductId",
  "GroupName" = EXCLUDED."GroupName",
  "Name" = EXCLUDED."Name",
  "AdditionalPrice" = EXCLUDED."AdditionalPrice",
  "IsRequired" = EXCLUDED."IsRequired",
  "IsActive" = EXCLUDED."IsActive",
  "DisplayOrder" = EXCLUDED."DisplayOrder",
  "UpdatedAt" = NOW();

-- ----------------------------------------------------------------------------
-- CLEANUP (OPSİYONEL — uncomment'lemeden önce gözden geçir)
-- ----------------------------------------------------------------------------
-- Cloud'da kalan eski dev/test verisi. Sipariş referansı olanlar silinmez
-- (FK Restrict). Eğer test ürünlerinin siparişi varsa DELETE patlar — o zaman
-- cleanup'ı atla, admin panelinden tek tek pasifleştir.
--
-- DELETE FROM products WHERE "Name" IN ('denenme','tset','kavurma','lahmacun','Su') AND "StoreId" = '33420ab3-5349-422c-838c-15dbc6e94730';
-- DELETE FROM categories WHERE "Name" IN ('test','yemek','içecek') AND "StoreId" = '33420ab3-5349-422c-838c-15dbc6e94730';

COMMIT;

-- Doğrulama sorgusu — script bitince çalıştır:
-- SELECT 'categories' AS tablo, COUNT(*) FROM categories WHERE "StoreId" = '33420ab3-5349-422c-838c-15dbc6e94730'
-- UNION ALL SELECT 'products', COUNT(*) FROM products WHERE "StoreId" = '33420ab3-5349-422c-838c-15dbc6e94730'
-- UNION ALL SELECT 'product_options', COUNT(*) FROM product_options WHERE "StoreId" = '33420ab3-5349-422c-838c-15dbc6e94730';
