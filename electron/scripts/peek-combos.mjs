import Database from "better-sqlite3";
const db = new Database("C:\\Users\\w11\\Desktop\\pos.db", { readonly: true });
const STORE = "33420AB3-5349-422C-838C-15DBC6E94730";

console.log("=== ALL TABLES ===");
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
for (const t of tables) console.log(`  ${t.name}`);

console.log("\n=== COMBOS (Fresh Pizza) ===");
try {
  const combos = db.prepare(`SELECT * FROM combos WHERE StoreId = ?`).all(STORE);
  console.log(`  count: ${combos.length}`);
  for (const c of combos) console.log(`  ${c.Name}  ${c.Price}TL  active=${c.IsActive}  ${c.Id}`);
} catch (e) { console.log(`  ERROR: ${e.message}`); }

console.log("\n=== COMBO_ITEMS (Fresh Pizza) ===");
try {
  const items = db.prepare(`
    SELECT ci.*, c.Name AS comboName, p.Name AS productName
    FROM combo_items ci
    LEFT JOIN combos c ON c.Id = ci.ComboId
    LEFT JOIN products p ON p.Id = ci.ProductId
    WHERE c.StoreId = ?
  `).all(STORE);
  console.log(`  count: ${items.length}`);
  for (const i of items) console.log(`  ${i.comboName} → ${i.productName} (qty=${i.Quantity})`);
} catch (e) { console.log(`  ERROR: ${e.message}`); }

console.log("\n=== TABLES (masalar) ===");
try {
  const t = db.prepare(`SELECT Id, Name FROM tables WHERE StoreId = ?`).all(STORE);
  console.log(`  count: ${t.length}`);
  for (const x of t) console.log(`  ${x.Name}`);
} catch (e) { console.log(`  ERROR: ${e.message}`); }

console.log("\n=== CUSTOMERS (sample) ===");
try {
  const cnt = db.prepare(`SELECT COUNT(*) AS n FROM customers WHERE StoreId = ?`).get(STORE);
  console.log(`  total: ${cnt.n}`);
} catch (e) { console.log(`  ERROR: ${e.message}`); }

db.close();
