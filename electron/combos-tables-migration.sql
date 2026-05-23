-- Combos + ComboItems + Tables migration for Fresh Pizza
-- StoreId: 33420AB3-5349-422C-838C-15DBC6E94730
-- Combos: 12, Items: 1, Tables: 8

BEGIN;

-- COMBOS (12)
INSERT INTO combos ("Id", "StoreId", "Name", "Description", "Price", "DeliveryPrice", "IsActive", "DisplayOrder", "CreatedAt", "UpdatedAt") VALUES
  ('41b5e7cd-e4c7-4f10-ad62-1c2a48866d41', '33420ab3-5349-422c-838c-15dbc6e94730', 'Büyük Boy Menü', NULL, 450, 550, TRUE, 0, '2026-05-12 10:27:04.7672963', '2026-05-12 13:27:00.4976909'),
  ('94ff7c26-ff2c-4575-9bcc-ce72c45e1130', '33420ab3-5349-422c-838c-15dbc6e94730', 'Orta Menü', NULL, 350, 450, TRUE, 1, '2026-05-12 10:27:57.7986832', NULL),
  ('0eebd783-1ccd-4fba-87b4-53e359bb6783', '33420ab3-5349-422c-838c-15dbc6e94730', 'Mini İkizler', NULL, 470, 580, TRUE, 2, '2026-05-12 10:28:52.4010793', NULL),
  ('83191f0e-363c-4003-a3b5-6bf96d0bbdaf', '33420ab3-5349-422c-838c-15dbc6e94730', 'Duble Menü', NULL, 750, 850, TRUE, 3, '2026-05-12 10:29:34.830038', NULL),
  ('625c65cd-cd44-4112-9a8d-f7a327c70c87', '33420ab3-5349-422c-838c-15dbc6e94730', 'Orta İkizler', NULL, 600, 700, TRUE, 4, '2026-05-12 10:30:13.2066779', '2026-05-12 16:12:47.4317952'),
  ('9c5ad6e8-0713-480b-a634-c4b9e1d4c5da', '33420ab3-5349-422c-838c-15dbc6e94730', 'Ufak Duble', NULL, 650, 750, TRUE, 5, '2026-05-12 10:30:29.5929814', NULL),
  ('a1fec580-e33d-45ce-a94d-f823b7d52ade', '33420ab3-5349-422c-838c-15dbc6e94730', 'Aile Boyu', NULL, 999, 1350, TRUE, 6, '2026-05-12 10:30:53.637292', NULL),
  ('20820b2b-cef7-4f93-89bd-09336618561b', '33420ab3-5349-422c-838c-15dbc6e94730', 'Genç Ortalar', NULL, 800, 950, TRUE, 7, '2026-05-12 10:31:22.445208', NULL),
  ('eb212240-4220-498a-a52c-494deb3f5bef', '33420ab3-5349-422c-838c-15dbc6e94730', 'Küçük Special', NULL, 400, 500, TRUE, 8, '2026-05-12 10:31:48.0221673', NULL),
  ('af89eb7a-4b1b-4793-9353-64587620e37d', '33420ab3-5349-422c-838c-15dbc6e94730', 'Special Menü', NULL, 550, 650, TRUE, 9, '2026-05-12 10:32:03.5984314', NULL),
  ('47ceb2cc-3ce1-4e65-951f-26ea82cfb88e', '33420ab3-5349-422c-838c-15dbc6e94730', 'Orta Special', NULL, 450, 550, TRUE, 10, '2026-05-12 10:32:16.4365317', NULL),
  ('84c43a6d-6185-4ff6-af8a-33145dc8da4c', '33420ab3-5349-422c-838c-15dbc6e94730', 'Tek Kişilik Special', NULL, 385, 485, TRUE, 11, '2026-05-12 10:32:35.3283554', NULL)
ON CONFLICT ("Id") DO UPDATE SET
  "StoreId" = EXCLUDED."StoreId",
  "Name" = EXCLUDED."Name",
  "Description" = EXCLUDED."Description",
  "Price" = EXCLUDED."Price",
  "DeliveryPrice" = EXCLUDED."DeliveryPrice",
  "IsActive" = EXCLUDED."IsActive",
  "DisplayOrder" = EXCLUDED."DisplayOrder",
  "UpdatedAt" = NOW();

-- COMBO_ITEMS (1)
INSERT INTO combo_items ("Id", "StoreId", "ComboId", "ProductId", "Quantity", "DisplayOrder", "CreatedAt", "UpdatedAt") VALUES
  ('c82b4cdd-5041-4b79-8592-305f2e6a1c19', '33420ab3-5349-422c-838c-15dbc6e94730', '625c65cd-cd44-4112-9a8d-f7a327c70c87', '506a12bd-1f26-433c-9c29-23e083f956c8', 2, 0, '2026-05-12 16:12:47.4972526', NULL)
ON CONFLICT ("Id") DO UPDATE SET
  "StoreId" = EXCLUDED."StoreId",
  "ComboId" = EXCLUDED."ComboId",
  "ProductId" = EXCLUDED."ProductId",
  "Quantity" = EXCLUDED."Quantity",
  "DisplayOrder" = EXCLUDED."DisplayOrder",
  "UpdatedAt" = NOW();

-- TABLES / masalar (8)
INSERT INTO tables ("Id", "StoreId", "Name", "Capacity", "Status", "DisplayOrder", "IsActive", "CreatedAt", "UpdatedAt") VALUES
  ('ff2f60c3-1d16-41be-be2a-267d226a5d25', '33420ab3-5349-422c-838c-15dbc6e94730', 'Masa 2', 4, 0, 1, TRUE, '2026-05-12 09:18:49.6815047', '2026-05-15 11:00:04.7020041'),
  ('ec5b2f51-f09a-478a-968f-68f9b0d58920', '33420ab3-5349-422c-838c-15dbc6e94730', 'Masa 3', 4, 0, 2, TRUE, '2026-05-12 09:18:53.9278276', '2026-05-13 15:32:44.5818508'),
  ('ea440083-0e33-4487-8a83-877982b1a939', '33420ab3-5349-422c-838c-15dbc6e94730', 'Masa 4', 4, 0, 3, TRUE, '2026-05-12 09:18:58.0850687', NULL),
  ('3291a6aa-05f8-4e9c-a737-9e776acbbbb6', '33420ab3-5349-422c-838c-15dbc6e94730', 'Masa 5', 4, 0, 4, TRUE, '2026-05-12 09:19:01.9764488', NULL),
  ('abc2d82b-fed6-48ff-b39a-f8d7022b6adc', '33420ab3-5349-422c-838c-15dbc6e94730', 'Masa 6', 4, 0, 5, TRUE, '2026-05-12 09:19:10.5439367', NULL),
  ('a5b06dee-3db4-4c8e-8272-70631296b432', '33420ab3-5349-422c-838c-15dbc6e94730', 'Masa 7', 4, 0, 6, TRUE, '2026-05-12 09:19:15.6896685', NULL),
  ('a60802a3-9f6c-44e1-89f4-270c8c0f5348', '33420ab3-5349-422c-838c-15dbc6e94730', 'Masa 8', 4, 0, 7, TRUE, '2026-05-12 09:19:20.8324713', NULL),
  ('b55caa86-dac4-42ff-b9bc-5f5f268dc680', '33420ab3-5349-422c-838c-15dbc6e94730', 'Masa 1', 4, 1, 0, TRUE, '2026-05-12 09:03:48.8128059', '2026-05-15 14:40:28.591704')
ON CONFLICT ("Id") DO UPDATE SET
  "StoreId" = EXCLUDED."StoreId",
  "Name" = EXCLUDED."Name",
  "Capacity" = EXCLUDED."Capacity",
  "DisplayOrder" = EXCLUDED."DisplayOrder",
  "IsActive" = EXCLUDED."IsActive",
  "UpdatedAt" = NOW();
  -- Status hariç (runtime durumu — Status sıfırlamayı istemiyoruz)

COMMIT;
