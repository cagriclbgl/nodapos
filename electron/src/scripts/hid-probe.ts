/**
 * Caller ID HID protocol probe — bağımsız reverse-engineering aracı.
 *
 * Kablo geldiğinde:
 *   1. cd electron
 *   2. npm install                       # node-hid + usb (rebuild dahil)
 *   3. npm run rebuild                   # node-hid'i Electron'a değil Node'a göre rebuild
 *   4. npm run build                     # tsc
 *   5. node dist/scripts/hid-probe.js   (ya da npm run hid-probe)
 *   6. Bir hattan ara (bilinen numara)
 *   7. Çıkan hex satırlarını Claude'a yapıştır
 *
 * Script ne yapar:
 *   - Tüm HID cihazları listeler (VID/PID/path/product/manufacturer)
 *   - 1A86:E008 cihazını açar
 *   - Gelen tüm input report'ları timestamp + hex + ASCII olarak yazdırır
 *   - Ctrl+C ile çıkar
 *
 * Not: Bu script Electron runtime'a değil saf Node'a göre çalışır
 * (`@electron/rebuild` electron için, normal Node için `node-gyp rebuild`
 * yeter — `npm install` çoğu zaman bunu yapar).
 */

import HID from "node-hid";
import { TARGET_PRODUCT_ID, TARGET_VENDOR_ID } from "../hid/types";

function ts(): string {
  const d = new Date();
  return d.toISOString();
}

function bufToAscii(buf: Buffer): string {
  let s = "";
  for (const b of buf) {
    s += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
  }
  return s;
}

function main(): void {
  console.log(`[${ts()}] HID PROBE — VID 0x${TARGET_VENDOR_ID.toString(16)} PID 0x${TARGET_PRODUCT_ID.toString(16)}`);
  console.log("");
  console.log("Tüm HID cihazları:");
  for (const d of HID.devices()) {
    const vidHex = d.vendorId?.toString(16).padStart(4, "0");
    const pidHex = d.productId?.toString(16).padStart(4, "0");
    const isTarget = d.vendorId === TARGET_VENDOR_ID && d.productId === TARGET_PRODUCT_ID;
    const star = isTarget ? "★" : " ";
    console.log(
      `  ${star} ${vidHex}:${pidHex}  product="${d.product ?? ""}" mfg="${
        d.manufacturer ?? ""
      }" usagePage=${d.usagePage} usage=${d.usage} path=${d.path}`
    );
  }
  console.log("");

  const targets = HID.devices().filter(
    (d) => d.vendorId === TARGET_VENDOR_ID && d.productId === TARGET_PRODUCT_ID
  );
  if (targets.length === 0) {
    console.error("Hedef cihaz bulunamadı. USB takılı mı? Sürücü kuruldu mu? (Windows HID class — ek sürücü gerekmez.)");
    process.exit(1);
  }

  // Cihaz birden fazla "interface" sergileyebilir (HID raporları tek path'te
  // toplanır ama bazı kutular çoklu collection açar). Hepsini paralel açıp
  // hangisinden veri geldiğini gözlemle.
  for (const target of targets) {
    if (!target.path) continue;
    try {
      const dev = new HID.HID(target.path);
      console.log(`[${ts()}] Açıldı: path=${target.path} usagePage=${target.usagePage} usage=${target.usage}`);
      dev.on("data", (buf: Buffer) => {
        console.log(
          `[${ts()}] data path=${target.path} len=${buf.length} hex=${buf.toString(
            "hex"
          )} ascii="${bufToAscii(buf)}"`
        );
      });
      dev.on("error", (err: Error) => {
        console.error(`[${ts()}] error path=${target.path} ${err.message}`);
      });
    } catch (err) {
      console.error(
        `[${ts()}] açılamadı path=${target.path}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  console.log("");
  console.log("Bekliyorum… Bir hattan arayın. Ctrl+C ile çıkın.");

  process.on("SIGINT", () => {
    console.log("");
    console.log("Bye.");
    process.exit(0);
  });
}

main();
