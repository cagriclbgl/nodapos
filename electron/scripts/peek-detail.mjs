import Database from "better-sqlite3";

const inputPath = process.argv[2] || "C:\\Users\\w11\\Desktop\\pos.db";
const db = new Database(inputPath, { readonly: true, fileMustExist: true });

console.log("=== PRODUCTS BY STORE ===");
const byStore = db.prepare(`
  SELECT p.StoreId, s.Name AS StoreName, COUNT(*) AS productCount
  FROM products p LEFT JOIN stores s ON s.Id = p.StoreId
  GROUP BY p.StoreId, s.Name
`).all();
for (const r of byStore) console.log(`  ${r.StoreName ?? "(unknown)"} [${r.StoreId}] → ${r.productCount} ürün`);

console.log("\n=== CATEGORIES BY STORE ===");
const catsByStore = db.prepare(`
  SELECT c.StoreId, s.Name AS StoreName, c.Name AS catName, c.DisplayOrder, c.IsActive
  FROM categories c LEFT JOIN stores s ON s.Id = c.StoreId
  ORDER BY s.Name, c.DisplayOrder
`).all();
for (const r of catsByStore) console.log(`  ${r.StoreName} → ${r.catName} (order=${r.DisplayOrder}, active=${r.IsActive})`);

console.log("\n=== ORDERS BY STORE (which store actually used) ===");
const ordersByStore = db.prepare(`
  SELECT o.StoreId, s.Name AS StoreName, COUNT(*) AS orderCount,
         MAX(o.CreatedAt) AS lastOrder
  FROM orders o LEFT JOIN stores s ON s.Id = o.StoreId
  GROUP BY o.StoreId, s.Name
  ORDER BY orderCount DESC
`).all();
for (const r of ordersByStore) console.log(`  ${r.StoreName ?? "(unknown)"} → ${r.orderCount} sipariş, son: ${r.lastOrder}`);

console.log("\n=== PRODUCTS WITH DisplayOrder=9999 (placeholder pollution) ===");
const polluted = db.prepare(`
  SELECT p.Name, c.Name AS CategoryName, p.Price, p.IsAvailable
  FROM products p LEFT JOIN categories c ON c.Id = p.CategoryId
  WHERE p.DisplayOrder = 9999
  ORDER BY p.Name
`).all();
for (const r of polluted) console.log(`  ${r.Name}  →  kategori: ${r.CategoryName}  (${r.Price}TL, avail=${r.IsAvailable})`);

console.log("\n=== OPTIONS BY PRODUCT (sample) ===");
const optByProd = db.prepare(`
  SELECT p.Name, COUNT(*) AS optCount, GROUP_CONCAT(DISTINCT po.GroupName) AS groups
  FROM product_options po JOIN products p ON p.Id = po.ProductId
  GROUP BY p.Id, p.Name
  ORDER BY p.Name
`).all();
for (const r of optByProd) console.log(`  ${r.Name} → ${r.optCount} opsiyon (${r.groups})`);

db.close();
