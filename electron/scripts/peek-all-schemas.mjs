import Database from "better-sqlite3";
const db = new Database("C:\\Users\\w11\\Desktop\\pos.db", { readonly: true });
const STORE = "33420AB3-5349-422C-838C-15DBC6E94730";

const tables = ["stores","customers","customer_addresses","orders","order_items","order_item_options","payments","incoming_calls"];
for (const t of tables) {
  console.log(`\n=== ${t} ===`);
  const cols = db.prepare(`PRAGMA table_info(${t})`).all();
  const colNames = cols.map(c => `${c.name}:${c.type}${c.notnull?"!":""}`).join(", ");
  console.log(`columns: ${colNames}`);
  let cnt = 0;
  try {
    cnt = db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE StoreId = ?`).get(STORE).n;
  } catch {
    cnt = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  }
  console.log(`row count (Fresh Pizza or total): ${cnt}`);
}
db.close();
