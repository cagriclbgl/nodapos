#!/usr/bin/env node
// Tüm transactional veriyi kasa SQLite'tan cloud Postgres'e taşır (Fresh Pizza).
// İçerir: stores (Fresh Pizza), customers, customer_addresses, incoming_calls,
//         orders, order_items, order_item_options, payments
// İçermez (mimari kural): users, supervisors, store_registration_requests,
//                          outbox_events, sync_states
// Menü zaten önceki migration'larda taşındı (categories, products, options, combos, tables).

import Database from "better-sqlite3";
import fs from "node:fs";

const STORE = "33420AB3-5349-422C-838C-15DBC6E94730";
const dbPath = process.argv[2] || "C:\\Users\\w11\\Desktop\\pos.db";
const out = "alldata-migration.sql";
const db = new Database(dbPath, { readonly: true });

const stores = db.prepare(`SELECT * FROM stores WHERE Id = ?`).all(STORE);
const customers = db.prepare(`SELECT * FROM customers WHERE StoreId = ?`).all(STORE);
const addresses = db.prepare(`SELECT * FROM customer_addresses WHERE StoreId = ?`).all(STORE);
const calls = db.prepare(`SELECT * FROM incoming_calls WHERE StoreId = ?`).all(STORE);
const orders = db.prepare(`SELECT * FROM orders WHERE StoreId = ?`).all(STORE);
const items = db.prepare(`SELECT * FROM order_items WHERE StoreId = ?`).all(STORE);
const itemOpts = db.prepare(`SELECT * FROM order_item_options WHERE StoreId = ?`).all(STORE);
const payments = db.prepare(`SELECT * FROM payments WHERE StoreId = ?`).all(STORE);

console.error(`StoreId: ${STORE}`);
console.error(`Counts: stores=${stores.length}, customers=${customers.length}, addresses=${addresses.length}, calls=${calls.length}, orders=${orders.length}, items=${items.length}, itemOpts=${itemOpts.length}, payments=${payments.length}`);

function s(x) {
  if (x === null || x === undefined) return "NULL";
  if (typeof x === "number") return Number.isFinite(x) ? String(x) : "NULL";
  return `'${String(x).replace(/'/g, "''")}'`;
}
function b(x) { return x ? "TRUE" : "FALSE"; }
function g(x) {
  if (!x) return "NULL";
  return `'${String(x).toLowerCase().replace(/'/g, "''")}'`;
}
function num(x) {
  if (x === null || x === undefined || x === "") return "NULL";
  const f = parseFloat(x);
  return Number.isFinite(f) ? String(f) : "NULL";
}

const O = [];
O.push(`-- ============================================================================`);
O.push(`-- NodaPos Full Data Migration: kasa SQLite → cloud Postgres`);
O.push(`-- StoreId: ${STORE} (Fresh Pizza)`);
O.push(`-- ============================================================================`);
O.push(`-- İçerir: stores, customers, addresses, calls, orders, items, item_options, payments`);
O.push(`-- Atlanır: users, supervisors (mimari kural — cloud yazımı)`);
O.push(`-- Strateji: idempotent UPSERT (ON CONFLICT DO UPDATE). Veri kaybı yok.`);
O.push(`-- Sıralama: calls.ResolvedOrderId ↔ orders.IncomingCallId circular FK'i nedeniyle`);
O.push(`-- calls önce NULL ResolvedOrderId ile insert edilir, orders insert sonrası UPDATE.`);
O.push(`-- ============================================================================`);
O.push(``);
O.push(`BEGIN;`);
O.push(``);

// ---- STORES ----
if (stores.length > 0) {
  O.push(`-- STORES (${stores.length}) — Fresh Pizza`);
  O.push(`INSERT INTO stores ("Id", "Name", "Address", "Phone", "TaxNumber", "IsActive", "CreatedAt", "UpdatedAt") VALUES`);
  O.push(stores.map(r => `  (${g(r.Id)}, ${s(r.Name)}, ${s(r.Address)}, ${s(r.Phone)}, ${s(r.TaxNumber)}, ${b(r.IsActive)}, ${s(r.CreatedAt)}, ${s(r.UpdatedAt)})`).join(",\n"));
  O.push(`ON CONFLICT ("Id") DO UPDATE SET "Name"=EXCLUDED."Name", "Address"=EXCLUDED."Address", "Phone"=EXCLUDED."Phone", "TaxNumber"=EXCLUDED."TaxNumber", "IsActive"=EXCLUDED."IsActive", "UpdatedAt"=NOW();`);
  O.push(``);
}

// ---- CUSTOMERS ----
if (customers.length > 0) {
  O.push(`-- CUSTOMERS (${customers.length})`);
  O.push(`INSERT INTO customers ("Id", "StoreId", "Name", "Phone", "Notes", "IsActive", "CreatedAt", "UpdatedAt") VALUES`);
  O.push(customers.map(r => `  (${g(r.Id)}, ${g(r.StoreId)}, ${s(r.Name)}, ${s(r.Phone)}, ${s(r.Notes)}, ${b(r.IsActive)}, ${s(r.CreatedAt)}, ${s(r.UpdatedAt)})`).join(",\n"));
  O.push(`ON CONFLICT ("Id") DO UPDATE SET "Name"=EXCLUDED."Name", "Phone"=EXCLUDED."Phone", "Notes"=EXCLUDED."Notes", "IsActive"=EXCLUDED."IsActive", "UpdatedAt"=NOW();`);
  O.push(``);
}

// ---- CUSTOMER ADDRESSES ----
if (addresses.length > 0) {
  O.push(`-- CUSTOMER_ADDRESSES (${addresses.length})`);
  O.push(`INSERT INTO customer_addresses ("Id", "StoreId", "CustomerId", "Label", "AddressLine", "District", "Notes", "IsDefault", "CreatedAt", "UpdatedAt") VALUES`);
  O.push(addresses.map(r => `  (${g(r.Id)}, ${g(r.StoreId)}, ${g(r.CustomerId)}, ${s(r.Label)}, ${s(r.AddressLine)}, ${s(r.District)}, ${s(r.Notes)}, ${b(r.IsDefault)}, ${s(r.CreatedAt)}, ${s(r.UpdatedAt)})`).join(",\n"));
  O.push(`ON CONFLICT ("Id") DO UPDATE SET "CustomerId"=EXCLUDED."CustomerId", "Label"=EXCLUDED."Label", "AddressLine"=EXCLUDED."AddressLine", "District"=EXCLUDED."District", "Notes"=EXCLUDED."Notes", "IsDefault"=EXCLUDED."IsDefault", "UpdatedAt"=NOW();`);
  O.push(``);
}

// ---- INCOMING_CALLS (NULL ResolvedOrderId for now to break cycle) ----
if (calls.length > 0) {
  O.push(`-- INCOMING_CALLS (${calls.length}) — ResolvedOrderId NULL geçici, orders sonrası UPDATE`);
  O.push(`INSERT INTO incoming_calls ("Id", "StoreId", "Phone", "LineNumber", "ReceivedAt", "MatchedCustomerId", "ResolvedOrderId", "Status", "HandledByUserId", "HandledAt", "Note", "RawPayloadHex", "CreatedAt", "UpdatedAt") VALUES`);
  O.push(calls.map(r => `  (${g(r.Id)}, ${g(r.StoreId)}, ${s(r.Phone)}, ${s(r.LineNumber)}, ${s(r.ReceivedAt)}, ${g(r.MatchedCustomerId)}, NULL, ${s(r.Status)}, ${g(r.HandledByUserId)}, ${s(r.HandledAt)}, ${s(r.Note)}, ${s(r.RawPayloadHex)}, ${s(r.CreatedAt)}, ${s(r.UpdatedAt)})`).join(",\n"));
  O.push(`ON CONFLICT ("Id") DO UPDATE SET "Phone"=EXCLUDED."Phone", "LineNumber"=EXCLUDED."LineNumber", "ReceivedAt"=EXCLUDED."ReceivedAt", "MatchedCustomerId"=EXCLUDED."MatchedCustomerId", "Status"=EXCLUDED."Status", "HandledByUserId"=EXCLUDED."HandledByUserId", "HandledAt"=EXCLUDED."HandledAt", "Note"=EXCLUDED."Note", "RawPayloadHex"=EXCLUDED."RawPayloadHex", "UpdatedAt"=NOW();`);
  O.push(``);
}

// ---- ORDERS ----
if (orders.length > 0) {
  O.push(`-- ORDERS (${orders.length})`);
  O.push(`INSERT INTO orders ("Id", "StoreId", "OrderNumber", "TableId", "Status", "OrderType", "Subtotal", "DiscountAmount", "Total", "CustomerName", "CustomerPhone", "Notes", "CustomerId", "CustomerAddressId", "CompletedAt", "CancelledAt", "DeliveryAddressSnapshot", "DeliveryDistrict", "FulfillmentStatus", "AssignedCourierUserId", "OutForDeliveryAt", "DeliveredAt", "IncomingCallId", "CreatedByUserId", "CreatedAt", "UpdatedAt") VALUES`);
  O.push(orders.map(r => `  (${g(r.Id)}, ${g(r.StoreId)}, ${s(r.OrderNumber)}, ${g(r.TableId)}, ${s(r.Status)}, ${s(r.OrderType)}, ${num(r.Subtotal)}, ${num(r.DiscountAmount)}, ${num(r.Total)}, ${s(r.CustomerName)}, ${s(r.CustomerPhone)}, ${s(r.Notes)}, ${g(r.CustomerId)}, ${g(r.CustomerAddressId)}, ${s(r.CompletedAt)}, ${s(r.CancelledAt)}, ${s(r.DeliveryAddressSnapshot)}, ${s(r.DeliveryDistrict)}, ${s(r.FulfillmentStatus)}, ${g(r.AssignedCourierUserId)}, ${s(r.OutForDeliveryAt)}, ${s(r.DeliveredAt)}, ${g(r.IncomingCallId)}, ${g(r.CreatedByUserId)}, ${s(r.CreatedAt)}, ${s(r.UpdatedAt)})`).join(",\n"));
  O.push(`ON CONFLICT ("Id") DO UPDATE SET "OrderNumber"=EXCLUDED."OrderNumber", "TableId"=EXCLUDED."TableId", "Status"=EXCLUDED."Status", "OrderType"=EXCLUDED."OrderType", "Subtotal"=EXCLUDED."Subtotal", "DiscountAmount"=EXCLUDED."DiscountAmount", "Total"=EXCLUDED."Total", "CustomerName"=EXCLUDED."CustomerName", "CustomerPhone"=EXCLUDED."CustomerPhone", "Notes"=EXCLUDED."Notes", "CustomerId"=EXCLUDED."CustomerId", "CustomerAddressId"=EXCLUDED."CustomerAddressId", "CompletedAt"=EXCLUDED."CompletedAt", "CancelledAt"=EXCLUDED."CancelledAt", "DeliveryAddressSnapshot"=EXCLUDED."DeliveryAddressSnapshot", "DeliveryDistrict"=EXCLUDED."DeliveryDistrict", "FulfillmentStatus"=EXCLUDED."FulfillmentStatus", "AssignedCourierUserId"=EXCLUDED."AssignedCourierUserId", "OutForDeliveryAt"=EXCLUDED."OutForDeliveryAt", "DeliveredAt"=EXCLUDED."DeliveredAt", "IncomingCallId"=EXCLUDED."IncomingCallId", "UpdatedAt"=NOW();`);
  O.push(``);
}

// ---- UPDATE incoming_calls.ResolvedOrderId AFTER orders inserted ----
const callsWithResolved = calls.filter(c => c.ResolvedOrderId);
if (callsWithResolved.length > 0) {
  O.push(`-- INCOMING_CALLS resolved-order linkage (${callsWithResolved.length})`);
  for (const c of callsWithResolved) {
    O.push(`UPDATE incoming_calls SET "ResolvedOrderId" = ${g(c.ResolvedOrderId)} WHERE "Id" = ${g(c.Id)};`);
  }
  O.push(``);
}

// ---- ORDER_ITEMS ----
if (items.length > 0) {
  O.push(`-- ORDER_ITEMS (${items.length})`);
  O.push(`INSERT INTO order_items ("Id", "StoreId", "OrderId", "ProductId", "ProductName", "UnitPrice", "Quantity", "LineTotal", "Notes", "CreatedAt", "UpdatedAt") VALUES`);
  O.push(items.map(r => `  (${g(r.Id)}, ${g(r.StoreId)}, ${g(r.OrderId)}, ${g(r.ProductId)}, ${s(r.ProductName)}, ${num(r.UnitPrice)}, ${s(r.Quantity)}, ${num(r.LineTotal)}, ${s(r.Notes)}, ${s(r.CreatedAt)}, ${s(r.UpdatedAt)})`).join(",\n"));
  O.push(`ON CONFLICT ("Id") DO UPDATE SET "OrderId"=EXCLUDED."OrderId", "ProductId"=EXCLUDED."ProductId", "ProductName"=EXCLUDED."ProductName", "UnitPrice"=EXCLUDED."UnitPrice", "Quantity"=EXCLUDED."Quantity", "LineTotal"=EXCLUDED."LineTotal", "Notes"=EXCLUDED."Notes", "UpdatedAt"=NOW();`);
  O.push(``);
}

// ---- ORDER_ITEM_OPTIONS ----
if (itemOpts.length > 0) {
  O.push(`-- ORDER_ITEM_OPTIONS (${itemOpts.length})`);
  O.push(`INSERT INTO order_item_options ("Id", "StoreId", "OrderItemId", "ProductOptionId", "GroupName", "OptionName", "AdditionalPrice", "CreatedAt", "UpdatedAt") VALUES`);
  O.push(itemOpts.map(r => `  (${g(r.Id)}, ${g(r.StoreId)}, ${g(r.OrderItemId)}, ${g(r.ProductOptionId)}, ${s(r.GroupName)}, ${s(r.OptionName)}, ${num(r.AdditionalPrice)}, ${s(r.CreatedAt)}, ${s(r.UpdatedAt)})`).join(",\n"));
  O.push(`ON CONFLICT ("Id") DO UPDATE SET "OrderItemId"=EXCLUDED."OrderItemId", "ProductOptionId"=EXCLUDED."ProductOptionId", "GroupName"=EXCLUDED."GroupName", "OptionName"=EXCLUDED."OptionName", "AdditionalPrice"=EXCLUDED."AdditionalPrice", "UpdatedAt"=NOW();`);
  O.push(``);
}

// ---- PAYMENTS ----
if (payments.length > 0) {
  O.push(`-- PAYMENTS (${payments.length})`);
  O.push(`INSERT INTO payments ("Id", "StoreId", "OrderId", "Amount", "Method", "PaidAt", "ReferenceNumber", "Notes", "CreatedByUserId", "CreatedAt", "UpdatedAt") VALUES`);
  O.push(payments.map(r => `  (${g(r.Id)}, ${g(r.StoreId)}, ${g(r.OrderId)}, ${num(r.Amount)}, ${s(r.Method)}, ${s(r.PaidAt)}, ${s(r.ReferenceNumber)}, ${s(r.Notes)}, ${g(r.CreatedByUserId)}, ${s(r.CreatedAt)}, ${s(r.UpdatedAt)})`).join(",\n"));
  O.push(`ON CONFLICT ("Id") DO UPDATE SET "OrderId"=EXCLUDED."OrderId", "Amount"=EXCLUDED."Amount", "Method"=EXCLUDED."Method", "PaidAt"=EXCLUDED."PaidAt", "ReferenceNumber"=EXCLUDED."ReferenceNumber", "Notes"=EXCLUDED."Notes", "UpdatedAt"=NOW();`);
  O.push(``);
}

O.push(`COMMIT;`);
O.push(``);
O.push(`-- Doğrulama:`);
O.push(`-- SELECT 'orders' AS tablo, COUNT(*) FROM orders WHERE "StoreId" = ${g(STORE)}`);
O.push(`-- UNION ALL SELECT 'items', COUNT(*) FROM order_items WHERE "StoreId" = ${g(STORE)}`);
O.push(`-- UNION ALL SELECT 'payments', COUNT(*) FROM payments WHERE "StoreId" = ${g(STORE)}`);
O.push(`-- UNION ALL SELECT 'customers', COUNT(*) FROM customers WHERE "StoreId" = ${g(STORE)}`);
O.push(`-- UNION ALL SELECT 'calls', COUNT(*) FROM incoming_calls WHERE "StoreId" = ${g(STORE)};`);

fs.writeFileSync(out, O.join("\n"), "utf8");
db.close();
console.error(`✓ ${out} yazıldı (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
