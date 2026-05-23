#!/usr/bin/env node
// İkinci aşama migration: combos + combo_items + tables (masalar)
// Kasa SQLite → Cloud Postgres, Fresh Pizza store için.

import Database from "better-sqlite3";
import fs from "node:fs";

const STORE = process.argv[3] || "33420AB3-5349-422C-838C-15DBC6E94730";
const dbPath = process.argv[2] || "C:\\Users\\w11\\Desktop\\pos.db";
const out = "combos-tables-migration.sql";

const db = new Database(dbPath, { readonly: true });

const combos = db.prepare(`SELECT * FROM combos WHERE StoreId = ?`).all(STORE);
const items = db.prepare(`SELECT * FROM combo_items WHERE StoreId = ?`).all(STORE);
const tables = db.prepare(`SELECT * FROM tables WHERE StoreId = ?`).all(STORE);

console.error(`StoreId: ${STORE}`);
console.error(`Combos: ${combos.length}, ComboItems: ${items.length}, Tables: ${tables.length}`);

function v(x) {
  if (x === null || x === undefined || x === "") return "NULL";
  if (typeof x === "number") return Number.isFinite(x) ? String(x) : "NULL";
  return `'${String(x).replace(/'/g, "''")}'`;
}
function b(x) { return x ? "TRUE" : "FALSE"; }
function g(x) { return x ? `'${String(x).toLowerCase().replace(/'/g, "''")}'` : "NULL"; }
function n(x) {
  if (x === null || x === undefined || x === "") return "NULL";
  const f = parseFloat(x);
  return Number.isFinite(f) ? String(f) : "NULL";
}

const sql = [];
sql.push(`-- Combos + ComboItems + Tables migration for Fresh Pizza`);
sql.push(`-- StoreId: ${STORE}`);
sql.push(`-- Combos: ${combos.length}, Items: ${items.length}, Tables: ${tables.length}`);
sql.push(``);
sql.push(`BEGIN;`);
sql.push(``);

if (combos.length > 0) {
  sql.push(`-- COMBOS (${combos.length})`);
  sql.push(`INSERT INTO combos ("Id", "StoreId", "Name", "Description", "Price", "DeliveryPrice", "IsActive", "DisplayOrder", "CreatedAt", "UpdatedAt") VALUES`);
  sql.push(combos.map(c =>
    `  (${g(c.Id)}, ${g(c.StoreId)}, ${v(c.Name)}, ${v(c.Description)}, ${n(c.Price)}, ${n(c.DeliveryPrice)}, ${b(c.IsActive)}, ${v(c.DisplayOrder)}, ${v(c.CreatedAt)}, ${v(c.UpdatedAt)})`
  ).join(",\n"));
  sql.push(`ON CONFLICT ("Id") DO UPDATE SET`);
  sql.push(`  "StoreId" = EXCLUDED."StoreId",`);
  sql.push(`  "Name" = EXCLUDED."Name",`);
  sql.push(`  "Description" = EXCLUDED."Description",`);
  sql.push(`  "Price" = EXCLUDED."Price",`);
  sql.push(`  "DeliveryPrice" = EXCLUDED."DeliveryPrice",`);
  sql.push(`  "IsActive" = EXCLUDED."IsActive",`);
  sql.push(`  "DisplayOrder" = EXCLUDED."DisplayOrder",`);
  sql.push(`  "UpdatedAt" = NOW();`);
  sql.push(``);
}

if (items.length > 0) {
  sql.push(`-- COMBO_ITEMS (${items.length})`);
  sql.push(`INSERT INTO combo_items ("Id", "StoreId", "ComboId", "ProductId", "Quantity", "DisplayOrder", "CreatedAt", "UpdatedAt") VALUES`);
  sql.push(items.map(i =>
    `  (${g(i.Id)}, ${g(i.StoreId)}, ${g(i.ComboId)}, ${g(i.ProductId)}, ${v(i.Quantity)}, ${v(i.DisplayOrder)}, ${v(i.CreatedAt)}, ${v(i.UpdatedAt)})`
  ).join(",\n"));
  sql.push(`ON CONFLICT ("Id") DO UPDATE SET`);
  sql.push(`  "StoreId" = EXCLUDED."StoreId",`);
  sql.push(`  "ComboId" = EXCLUDED."ComboId",`);
  sql.push(`  "ProductId" = EXCLUDED."ProductId",`);
  sql.push(`  "Quantity" = EXCLUDED."Quantity",`);
  sql.push(`  "DisplayOrder" = EXCLUDED."DisplayOrder",`);
  sql.push(`  "UpdatedAt" = NOW();`);
  sql.push(``);
}

if (tables.length > 0) {
  sql.push(`-- TABLES / masalar (${tables.length})`);
  sql.push(`INSERT INTO tables ("Id", "StoreId", "Name", "Capacity", "Status", "DisplayOrder", "IsActive", "CreatedAt", "UpdatedAt") VALUES`);
  sql.push(tables.map(t =>
    `  (${g(t.Id)}, ${g(t.StoreId)}, ${v(t.Name)}, ${v(t.Capacity)}, ${v(t.Status)}, ${v(t.DisplayOrder)}, ${b(t.IsActive)}, ${v(t.CreatedAt)}, ${v(t.UpdatedAt)})`
  ).join(",\n"));
  sql.push(`ON CONFLICT ("Id") DO UPDATE SET`);
  sql.push(`  "StoreId" = EXCLUDED."StoreId",`);
  sql.push(`  "Name" = EXCLUDED."Name",`);
  sql.push(`  "Capacity" = EXCLUDED."Capacity",`);
  sql.push(`  "DisplayOrder" = EXCLUDED."DisplayOrder",`);
  sql.push(`  "IsActive" = EXCLUDED."IsActive",`);
  sql.push(`  "UpdatedAt" = NOW();`);
  sql.push(`  -- Status hariç (runtime durumu — Status sıfırlamayı istemiyoruz)`);
  sql.push(``);
}

sql.push(`COMMIT;`);
sql.push(``);

fs.writeFileSync(out, sql.join("\n"), "utf8");
db.close();
console.error(`✓ ${out} yazıldı (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
