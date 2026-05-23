import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";

const inputPath = process.argv[2]
  || path.join(os.homedir(), "AppData", "Roaming", "pizzapos-desktop", "pos.db");

const db = new Database(inputPath, { readonly: true, fileMustExist: true });

const storeRows = db.prepare(`SELECT Id, Name FROM stores`).all();
const catRows = db.prepare(`SELECT Id, Name, DisplayOrder, IsActive FROM categories ORDER BY DisplayOrder, Name`).all();
const prodRows = db.prepare(`SELECT Id, CategoryId, Name, Price, IsAvailable, DisplayOrder FROM products ORDER BY DisplayOrder, Name`).all();
const optRows = db.prepare(`SELECT COUNT(*) AS n FROM product_options`).get();
const orderRows = db.prepare(`SELECT COUNT(*) AS n FROM orders`).get();
const lastOrder = db.prepare(`SELECT CreatedAt FROM orders ORDER BY CreatedAt DESC LIMIT 1`).get();
const lastUpdProd = db.prepare(`SELECT Name, UpdatedAt FROM products ORDER BY UpdatedAt DESC LIMIT 5`).all();

console.log("=== KASA pos.db PEEK ===");
console.log(`Path: ${inputPath}`);
console.log();
console.log(`Stores (${storeRows.length}):`);
for (const s of storeRows) console.log(`  ${s.Id}  ${s.Name}`);
console.log();
console.log(`Categories (${catRows.length}):`);
for (const c of catRows) console.log(`  [${c.DisplayOrder}] ${c.Name}  (active=${c.IsActive})  ${c.Id}`);
console.log();
console.log(`Products (${prodRows.length}):`);
const byCat = new Map();
for (const p of prodRows) {
  if (!byCat.has(p.CategoryId)) byCat.set(p.CategoryId, []);
  byCat.get(p.CategoryId).push(p);
}
const catName = new Map(catRows.map(c => [c.Id, c.Name]));
for (const [cid, items] of byCat) {
  console.log(`  -- ${catName.get(cid) ?? cid} --`);
  for (const p of items) {
    console.log(`     [${p.DisplayOrder}] ${p.Name}  ${p.Price}TL  (avail=${p.IsAvailable})`);
  }
}
console.log();
console.log(`Product Options total: ${optRows.n}`);
console.log(`Orders total: ${orderRows.n}  (last: ${lastOrder?.CreatedAt ?? "—"})`);
console.log();
console.log("5 most recently updated products:");
for (const p of lastUpdProd) console.log(`  ${p.UpdatedAt}  ${p.Name}`);
db.close();
