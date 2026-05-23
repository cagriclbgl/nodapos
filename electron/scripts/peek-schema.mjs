import Database from "better-sqlite3";
const db = new Database("C:\\Users\\w11\\Desktop\\pos.db", { readonly: true });
for (const t of ["combos", "combo_items", "tables"]) {
  console.log(`\n=== ${t} schema ===`);
  const cols = db.prepare(`PRAGMA table_info(${t})`).all();
  for (const c of cols) console.log(`  ${c.name}  ${c.type}  ${c.notnull ? "NOT NULL" : ""}`);
  console.log(`-- sample row --`);
  const row = db.prepare(`SELECT * FROM ${t} LIMIT 1`).get();
  console.log(JSON.stringify(row, null, 2));
}
db.close();
