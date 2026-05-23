#!/usr/bin/env node
// Kasa SQLite → Cloud Postgres bir kerelik menü migration üretici.
//
// Üretir: menu-migration.sql — idempotent UPSERT'lerle kategoriler, ürünler
// ve ürün opsiyonlarını cloud Postgres'e taşır. Aynı ID'leri kullanır →
// lazy-backfill placeholder'lar (DisplayOrder=9999, IsAvailable=false) yerinde
// güncellenir; OrderItem.ProductId FK Restrict olduğu için silme yapamayız.
//
// Kullanım (electron/ klasöründen):
//   npm install --no-save better-sqlite3
//   node scripts/export-menu-to-cloud.mjs               # default: %APPDATA%\pizzapos-desktop\pos.db
//   node scripts/export-menu-to-cloud.mjs -i <path>     # özel kasa db yolu
//   node scripts/export-menu-to-cloud.mjs -o out.sql    # çıktı dosyası (default menu-migration.sql)
//
// Sonraki adım (üretilen .sql dosyasını uygulamak): scripts/README-menu-migration.md

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
let inputPath = null;
let outputPath = "menu-migration.sql";
let filterStoreId = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-i" || args[i] === "--input") inputPath = args[++i];
  else if (args[i] === "-o" || args[i] === "--output") outputPath = args[++i];
  else if (args[i] === "-s" || args[i] === "--store-id") filterStoreId = args[++i];
  else if (args[i] === "-h" || args[i] === "--help") {
    console.log("Usage: node export-menu-to-cloud.mjs [-i <pos.db>] [-o <out.sql>] [-s <store-id>]");
    process.exit(0);
  } else if (!inputPath) inputPath = args[i];
}

if (!inputPath) {
  inputPath = process.env.POS_DB_PATH
    || path.join(os.homedir(), "AppData", "Roaming", "pizzapos-desktop", "pos.db");
}

if (!fs.existsSync(inputPath)) {
  console.error(`HATA: SQLite dosyası bulunamadı: ${inputPath}`);
  console.error("Kasa Electron uygulamasını en az bir kez çalıştırdığından emin ol,");
  console.error("veya -i flag ile dosya yolunu ver:");
  console.error("  node scripts/export-menu-to-cloud.mjs -i \"C:\\path\\to\\pos.db\"");
  process.exit(1);
}

console.error(`Kaynak: ${inputPath}`);
console.error(`Çıktı:  ${outputPath}`);

const db = new Database(inputPath, { readonly: true, fileMustExist: true });

const whereStore = filterStoreId ? `WHERE StoreId = ?` : ``;
const bindStore = filterStoreId ? [filterStoreId] : [];
const categories = db.prepare(`SELECT * FROM categories ${whereStore}`).all(...bindStore);
const products = db.prepare(`SELECT * FROM products ${whereStore}`).all(...bindStore);
const options = db.prepare(`SELECT * FROM product_options ${whereStore}`).all(...bindStore);

// Tek store kontrolü — multi-tenancy mantıken tek mağaza, doğrula.
const storeIds = new Set([
  ...categories.map(c => c.StoreId),
  ...products.map(p => p.StoreId),
  ...options.map(o => o.StoreId),
]);
if (storeIds.size === 0) {
  console.error("HATA: Kasada hiç menü verisi yok. Migration gerekmiyor.");
  process.exit(1);
}
if (storeIds.size > 1) {
  console.error(`UYARI: Kasada birden fazla StoreId var (${[...storeIds].join(", ")}).`);
  console.error("Bu beklenmedik — single-tenant kasada bu olmamalı. Devam ediliyor.");
}
const storeId = [...storeIds][0];

console.error(`StoreId: ${storeId}`);
console.error(`Kategori: ${categories.length}, Ürün: ${products.length}, Opsiyon: ${options.length}`);

// SQL escape — değer null/sayı/bool/string olabilir.
function sqlVal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "bigint") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

// SQLite bool, INTEGER (0/1) olarak gelir. EF Core'da Postgres BOOLEAN
// olarak yazıyoruz, dönüştür.
function sqlBool(v) {
  return v ? "TRUE" : "FALSE";
}

// SQLite, EF Core'da Guid'i TEXT (lowercase, hyphenated) olarak yazar.
// Postgres UUID aynı formatı kabul eder — pass-through güvenli.
function sqlGuid(v) {
  if (!v) return "NULL";
  const s = String(v).toLowerCase();
  // Format doğrulama: 36 karakter, 4 tire — bozuksa hata yerine raw yaz, psql reddeder.
  return `'${s.replace(/'/g, "''")}'`;
}

// SQLite DateTime, TEXT (ISO 8601, "Z" suffix olabilir veya olmayabilir).
// Postgres `timestamp with time zone` ISO 8601'i kabul eder.
function sqlTs(v) {
  if (!v) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

const out = [];
const ts = new Date().toISOString();

out.push(`-- ============================================================================`);
out.push(`-- NodaPos Menu Migration: Kasa SQLite → Cloud Postgres`);
out.push(`-- ============================================================================`);
out.push(`-- Kaynak SQLite : ${inputPath}`);
out.push(`-- Üretildi      : ${ts}`);
out.push(`-- StoreId       : ${storeId}`);
out.push(`-- Sayım         : ${categories.length} kategori, ${products.length} ürün, ${options.length} opsiyon`);
out.push(`-- ============================================================================`);
out.push(`--`);
out.push(`-- Bu script idempotent — birden fazla kez çalıştırmak güvenli, aynı ID'ler`);
out.push(`-- update olur (insert değil). BEGIN/COMMIT içinde, hata olursa rollback.`);
out.push(`--`);
out.push(`-- Cloud StoreId'sinin yukarıdaki ile eşleştiğini önce doğrula:`);
out.push(`--   SELECT "Id", "Name" FROM stores;`);
out.push(`-- Eşleşmiyorsa cloud'da farklı bir mağaza var demek — migration yapma.`);
out.push(``);
out.push(`BEGIN;`);
out.push(``);

// ---------------------------------------------------------------------- KATEGORİLER
out.push(`-- ----------------------------------------------------------------------------`);
out.push(`-- KATEGORİLER (${categories.length})`);
out.push(`-- ----------------------------------------------------------------------------`);
if (categories.length > 0) {
  out.push(`INSERT INTO categories ("Id", "StoreId", "Name", "Description", "DisplayOrder", "IsActive", "CreatedAt", "UpdatedAt") VALUES`);
  const rows = categories.map(c => `  (${sqlGuid(c.Id)}, ${sqlGuid(c.StoreId)}, ${sqlVal(c.Name)}, ${sqlVal(c.Description)}, ${sqlVal(c.DisplayOrder)}, ${sqlBool(c.IsActive)}, ${sqlTs(c.CreatedAt)}, ${sqlTs(c.UpdatedAt)})`);
  out.push(rows.join(",\n"));
  out.push(`ON CONFLICT ("Id") DO UPDATE SET`);
  out.push(`  "StoreId" = EXCLUDED."StoreId",`);
  out.push(`  "Name" = EXCLUDED."Name",`);
  out.push(`  "Description" = EXCLUDED."Description",`);
  out.push(`  "DisplayOrder" = EXCLUDED."DisplayOrder",`);
  out.push(`  "IsActive" = EXCLUDED."IsActive",`);
  out.push(`  "UpdatedAt" = NOW();`);
  out.push(``);
}

// ---------------------------------------------------------------------- ÜRÜNLER
out.push(`-- ----------------------------------------------------------------------------`);
out.push(`-- ÜRÜNLER (${products.length})`);
out.push(`-- Lazy-backfill placeholder'lar (cloud'da DisplayOrder=9999, IsAvailable=false)`);
out.push(`-- bu UPSERT ile yerinde güncellenir: doğru fiyat, kategori, sıra, IsAvailable=true.`);
out.push(`-- ----------------------------------------------------------------------------`);
if (products.length > 0) {
  out.push(`INSERT INTO products ("Id", "StoreId", "CategoryId", "Name", "Description", "Price", "DeliveryPrice", "ImageUrl", "IsAvailable", "DisplayOrder", "CreatedAt", "UpdatedAt") VALUES`);
  const rows = products.map(p => `  (${sqlGuid(p.Id)}, ${sqlGuid(p.StoreId)}, ${sqlGuid(p.CategoryId)}, ${sqlVal(p.Name)}, ${sqlVal(p.Description)}, ${sqlVal(p.Price)}, ${sqlVal(p.DeliveryPrice)}, ${sqlVal(p.ImageUrl)}, ${sqlBool(p.IsAvailable)}, ${sqlVal(p.DisplayOrder)}, ${sqlTs(p.CreatedAt)}, ${sqlTs(p.UpdatedAt)})`);
  out.push(rows.join(",\n"));
  out.push(`ON CONFLICT ("Id") DO UPDATE SET`);
  out.push(`  "StoreId" = EXCLUDED."StoreId",`);
  out.push(`  "CategoryId" = EXCLUDED."CategoryId",`);
  out.push(`  "Name" = EXCLUDED."Name",`);
  out.push(`  "Description" = EXCLUDED."Description",`);
  out.push(`  "Price" = EXCLUDED."Price",`);
  out.push(`  "DeliveryPrice" = EXCLUDED."DeliveryPrice",`);
  out.push(`  "ImageUrl" = EXCLUDED."ImageUrl",`);
  out.push(`  "IsAvailable" = EXCLUDED."IsAvailable",`);
  out.push(`  "DisplayOrder" = EXCLUDED."DisplayOrder",`);
  out.push(`  "UpdatedAt" = NOW();`);
  out.push(``);
}

// ---------------------------------------------------------------------- OPSİYONLAR
out.push(`-- ----------------------------------------------------------------------------`);
out.push(`-- ÜRÜN OPSİYONLARI (${options.length})`);
out.push(`-- Çakışma davranışı: aynı ID → update. Cloud'da kasadaki ID ile eşleşmeyen ama`);
out.push(`-- aynı ürüne bağlı eski/farklı opsiyonlar varsa burada silinmez — SyncPullWorker`);
out.push(`-- bir sonraki pull'da o ürünü pull edip "wholesale replace" yapacağı için kasa'dakine`);
out.push(`-- eşitlenir (SyncPullWorker.cs:245). Cloud'da takılan eski option ID'lerini admin`);
out.push(`-- panelinden manuel temizle.`);
out.push(`-- ----------------------------------------------------------------------------`);
if (options.length > 0) {
  out.push(`INSERT INTO product_options ("Id", "StoreId", "ProductId", "GroupName", "Name", "AdditionalPrice", "IsRequired", "IsActive", "DisplayOrder", "CreatedAt", "UpdatedAt") VALUES`);
  const rows = options.map(o => `  (${sqlGuid(o.Id)}, ${sqlGuid(o.StoreId)}, ${sqlGuid(o.ProductId)}, ${sqlVal(o.GroupName)}, ${sqlVal(o.Name)}, ${sqlVal(o.AdditionalPrice)}, ${sqlBool(o.IsRequired)}, ${sqlBool(o.IsActive)}, ${sqlVal(o.DisplayOrder)}, ${sqlTs(o.CreatedAt)}, ${sqlTs(o.UpdatedAt)})`);
  out.push(rows.join(",\n"));
  out.push(`ON CONFLICT ("Id") DO UPDATE SET`);
  out.push(`  "StoreId" = EXCLUDED."StoreId",`);
  out.push(`  "ProductId" = EXCLUDED."ProductId",`);
  out.push(`  "GroupName" = EXCLUDED."GroupName",`);
  out.push(`  "Name" = EXCLUDED."Name",`);
  out.push(`  "AdditionalPrice" = EXCLUDED."AdditionalPrice",`);
  out.push(`  "IsRequired" = EXCLUDED."IsRequired",`);
  out.push(`  "IsActive" = EXCLUDED."IsActive",`);
  out.push(`  "DisplayOrder" = EXCLUDED."DisplayOrder",`);
  out.push(`  "UpdatedAt" = NOW();`);
  out.push(``);
}

// ---------------------------------------------------------------------- CLEANUP (opsiyonel)
out.push(`-- ----------------------------------------------------------------------------`);
out.push(`-- CLEANUP (OPSİYONEL — uncomment'lemeden önce gözden geçir)`);
out.push(`-- ----------------------------------------------------------------------------`);
out.push(`-- Cloud'da kalan eski dev/test verisi. Sipariş referansı olanlar silinmez`);
out.push(`-- (FK Restrict). Eğer test ürünlerinin siparişi varsa DELETE patlar — o zaman`);
out.push(`-- cleanup'ı atla, admin panelinden tek tek pasifleştir.`);
out.push(`--`);
out.push(`-- DELETE FROM products WHERE "Name" IN ('denenme','tset','kavurma','lahmacun','Su') AND "StoreId" = ${sqlGuid(storeId)};`);
out.push(`-- DELETE FROM categories WHERE "Name" IN ('test','yemek','içecek') AND "StoreId" = ${sqlGuid(storeId)};`);
out.push(``);

out.push(`COMMIT;`);
out.push(``);
out.push(`-- Doğrulama sorgusu — script bitince çalıştır:`);
out.push(`-- SELECT 'categories' AS tablo, COUNT(*) FROM categories WHERE "StoreId" = ${sqlGuid(storeId)}`);
out.push(`-- UNION ALL SELECT 'products', COUNT(*) FROM products WHERE "StoreId" = ${sqlGuid(storeId)}`);
out.push(`-- UNION ALL SELECT 'product_options', COUNT(*) FROM product_options WHERE "StoreId" = ${sqlGuid(storeId)};`);
out.push(``);

fs.writeFileSync(outputPath, out.join("\n"), "utf8");
db.close();

const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
console.error(`✓ ${outputPath} yazıldı (${sizeKb} KB)`);
console.error(``);
console.error(`Sonraki adım: scripts/README-menu-migration.md'yi takip et.`);
