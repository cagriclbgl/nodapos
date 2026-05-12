import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import getPort from "get-port";
import waitOn from "wait-on";
import { autoUpdater } from "electron-updater";
import { CallerIdListener } from "./hid/caller-id-listener";
import { IncomingCallBridge } from "./services/incoming-call-bridge";
import { CLOUD_API_BASE_URL, HMAC_SECRET } from "./config";

let apiProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let logStream: fs.WriteStream | null = null;
let apiCrashCount = 0;
let frontendCrashCount = 0;
let callerIdListener: CallerIdListener | null = null;
let activeFrontendPort: number = 3000;
const MAX_CRASHES = 3;

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  logStream?.write(line);
}

function ensureLog() {
  const logsDir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  logStream = fs.createWriteStream(path.join(logsDir, "main.log"), { flags: "a" });
}

function getOrCreateJwtSecret(): string {
  const file = path.join(app.getPath("userData"), "auth.json");
  if (fs.existsSync(file)) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (typeof parsed.jwtSecret === "string" && parsed.jwtSecret.length >= 32) {
      return parsed.jwtSecret;
    }
  }
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(file, JSON.stringify({ jwtSecret: secret }, null, 2), { mode: 0o600 });
  log("Generated new JWT secret in userData/auth.json");
  return secret;
}

/**
 * .NET self-contained API'yi child process olarak başlatır. SQLite mode,
 * userData/pos.db'de veriyi tutar; cloud sync env'leri set edilmişse
 * outbox/pull worker'ları aktive olur (Program.cs check).
 */
async function startApi(): Promise<number> {
  const port = await getPort({ port: 5000 });
  const dbPath = path.join(app.getPath("userData"), "pos.db");
  const apiDir = app.isPackaged
    ? path.join(process.resourcesPath, "api")
    : path.resolve(__dirname, "..", "resources", "api");
  const exe = path.join(
    apiDir,
    process.platform === "win32" ? "PizzaPos.Api.exe" : "PizzaPos.Api"
  );

  if (!fs.existsSync(exe)) {
    throw new Error(
      `API binary not found at ${exe}. Run "npm run publish-api" first.`
    );
  }

  log(`Starting API: exe=${exe} port=${port} db=${dbPath}`);

  // Cloud sync env'leri: önce process env (dev override için), yoksa
  // build-time config (src/config.ts — gitignored, binary'ye gömülü).
  const cloudUrl = process.env.PIZZAPOS_CLOUD_URL || CLOUD_API_BASE_URL;
  const hmacSecret = process.env.PIZZAPOS_HMAC_SECRET || HMAC_SECRET;

  apiProcess = spawn(exe, [], {
    cwd: apiDir,
    env: {
      ...process.env,
      ASPNETCORE_URLS: `http://127.0.0.1:${port}`,
      ASPNETCORE_ENVIRONMENT: "Production",
      Database__Provider: "Sqlite",
      Database__SqlitePath: dbPath,
      Sync__Enabled: cloudUrl && hmacSecret ? "true" : "false",
      Sync__CloudBaseUrl: cloudUrl,
      Sync__HmacSecret: hmacSecret,
      Auth__Jwt__Secret: getOrCreateJwtSecret(),
      // Lokal frontend (Next standalone) bu Electron pencerede aynı orijinde
      // yüklenir, ama Next standalone server ayrı portta. CORS için her ikisini
      // de tanı; backend Cors__AllowedOrigins'i okur.
      Cors__AllowedOrigins: "http://localhost:3000,http://127.0.0.1:3000",
      DOTNET_ROLL_FORWARD: "Major",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  apiProcess.stdout?.on("data", (d) => log(`[api-out] ${d.toString().trim()}`));
  apiProcess.stderr?.on("data", (d) => log(`[api-err] ${d.toString().trim()}`));
  apiProcess.on("exit", (code) => {
    log(`API exited with code ${code}`);
    apiCrashCount++;
    if (apiCrashCount >= MAX_CRASHES) {
      dialog.showErrorBox(
        "PizzaPos API durdu",
        `Backend ${apiCrashCount} kez çöktü. Loglar: ${logStream?.path ?? "(yok)"}`
      );
      app.quit();
    }
  });

  await waitOn({
    resources: [`http-get://127.0.0.1:${port}/api/health`],
    timeout: 60_000,
    interval: 500,
    validateStatus: (s: number) => s === 200,
  });

  log(`API ready on port ${port}`);
  return port;
}

/**
 * Next.js standalone build'ini (.next/standalone/server.js) child process
 * olarak başlatır. Build env'i kasa-spesifik değil; frontend lib/env.ts
 * runtime'da localhost host gördüğünde API URL'sini http://localhost:5000
 * olarak çözer (cloud Vercel'de aynı kod cloud API'ye gider).
 */
async function startFrontend(apiPort: number): Promise<number> {
  const port = await getPort({ port: 3000 });
  const frontendDir = app.isPackaged
    ? path.join(process.resourcesPath, "frontend")
    : path.resolve(__dirname, "..", "resources", "frontend");
  const serverJs = path.join(frontendDir, "server.js");

  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Frontend bundle not found at ${serverJs}. Run "npm run publish-frontend" first.`
    );
  }

  log(`Starting frontend: server=${serverJs} port=${port}`);

  // Electron, kendi yerleşik Node executable'ını kullanır (process.execPath).
  // Next standalone server.js plain Node ile çalışacak şekilde üretilir;
  // Electron'un Node binary'si bunu sıkıntısız çalıştırır (ELECTRON_RUN_AS_NODE).
  frontendProcess = spawn(process.execPath, [serverJs], {
    cwd: frontendDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      // SSR / build-time fallback için API URL — runtime browser'da zaten
      // localhost'a kaydırılacak ama SSR sırasında doğru bir değer şart.
      NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  frontendProcess.stdout?.on("data", (d) =>
    log(`[front-out] ${d.toString().trim()}`)
  );
  frontendProcess.stderr?.on("data", (d) =>
    log(`[front-err] ${d.toString().trim()}`)
  );
  frontendProcess.on("exit", (code) => {
    log(`Frontend exited with code ${code}`);
    frontendCrashCount++;
    if (frontendCrashCount >= MAX_CRASHES) {
      dialog.showErrorBox(
        "PizzaPos arayüz durdu",
        `Frontend ${frontendCrashCount} kez çöktü. Loglar: ${logStream?.path ?? "(yok)"}`
      );
      app.quit();
    }
  });

  await waitOn({
    resources: [`http-get://127.0.0.1:${port}/`],
    timeout: 60_000,
    interval: 500,
    validateStatus: (s: number) => s < 500,
  });

  log(`Frontend ready on port ${port}`);
  return port;
}

async function createWindow(frontendPort: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const url =
    process.env.PIZZAPOS_DEV_URL ||
    (app.isPackaged
      ? `http://127.0.0.1:${frontendPort}`
      : "http://localhost:3000");
  log(`Loading window: ${url}`);
  await mainWindow.loadURL(url);
}

/**
 * USB HID Caller ID kutusunu (1A86:E008) dinler, çağrıları backend'e
 * POST /api/incoming-calls ile düşürür ve renderer'a IPC ile yayar.
 *
 * Pencere oluştuktan SONRA başlatılır — IPC broadcast yapılırken en az bir
 * BrowserWindow olması, ilk eventlerin kaybolmamasını garanti eder.
 */
function startCallerIdListener(apiPort: number): void {
  if (callerIdListener) return;
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  const listener = new CallerIdListener({ log });
  const bridge = new IncomingCallBridge(listener, { apiBaseUrl, log });
  bridge.install();

  ipcMain.handle("caller-id:rescan", () => {
    listener.rescan();
    return { ok: true };
  });
  ipcMain.handle("caller-id:list-devices", async () => {
    const devices = await listener.listAllDevices();
    // Native HID nesneleri JSON-serializable değil — sadece güvenli alanları gönder.
    return devices.map((d) => ({
      vendorId: d.vendorId,
      productId: d.productId,
      product: d.product,
      manufacturer: d.manufacturer,
      serialNumber: d.serialNumber,
      path: d.path,
      usagePage: d.usagePage,
      usage: d.usage,
    }));
  });
  ipcMain.handle("caller-id:set-test-mode", (_e, active: boolean) => {
    listener.setTestMode(active);
    return { ok: true };
  });

  listener.start();
  callerIdListener = listener;
}

/**
 * Termal fiş yazıcısına sessiz baskı. Renderer "şu sayfayı yazdır" der
 * (örn. /print/end-of-day/2026-05-12 veya /print/receipt/<id>). Main process
 * hidden BrowserWindow açar, URL'yi yükler, layout otursun diye kısa bekler,
 * sonra webContents.print({ silent: true, deviceName? }) — yazıcı seçim
 * diyalogu çıkmaz, doğrudan basar. deviceName verilmezse Windows varsayılan
 * yazıcısı kullanılır.
 *
 * Sayfa ?silent=1 query'sini görür ve kendi auto window.print() çağrısını
 * ATLAR — yoksa çift baskı tetiklenir.
 */
function getPrinterConfig(): { paperWidthMm: number; paperHeightMm: number; useDialog: boolean } {
  // Default: Rongta RP80 — 80mm kağıt, 72.1mm baskı alanı, 210mm sayfa.
  // pageSize'a 80 verilirse driver kendi 4mm sol/sağ margin'i uygulayıp
  // 72.1mm printable kullanır. useDialog=true ise Windows yazıcı dialog'u
  // açılır (eski davranış — sürücüsü düzgün set edilmemiş yazıcılarda).
  try {
    const file = path.join(app.getPath("userData"), "printer.json");
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      return {
        paperWidthMm: Number(parsed.paperWidthMm) || 80,
        paperHeightMm: Number(parsed.paperHeightMm) || 210,
        useDialog: parsed.useDialog === true,
      };
    }
  } catch (err) {
    log(`[print] config read error (using defaults): ${(err as Error).message}`);
  }
  return { paperWidthMm: 80, paperHeightMm: 210, useDialog: false };
}

function registerPrinterIpc(): void {
  ipcMain.handle(
    "printer:print",
    async (_e, opts: { url: string; deviceName?: string }) => {
      const cfg = getPrinterConfig();
      const path = opts.url.startsWith("/") ? opts.url : `/${opts.url}`;
      const sep = path.includes("?") ? "&" : "?";
      // ÖNEMLİ: URL her zaman ?silent=1 içerir — bu sayfanın kendi
      // window.print()'ini ATLAR. Print kararı (silent vs dialog) main
      // process'in webContents.print() çağrısının `silent` flag'ine bağlı.
      // useDialog=true'da URL'den silent=1'i çıkarmak, sayfa + main olmak
      // üzere ÇİFT print tetikliyordu.
      const full = `http://127.0.0.1:${activeFrontendPort}${path}${sep}silent=1`;
      log(`[print] ${cfg.useDialog ? "dialog" : "silent"} print → ${full} (${cfg.paperWidthMm}x${cfg.paperHeightMm}mm)`);

      // Dialog modunda hidden window görünür olsun — kasiyer Windows yazıcı
      // dialog'unu modal olarak görebilsin. Silent modda gizli kalır.
      const win = new BrowserWindow({
        show: cfg.useDialog,
        width: cfg.useDialog ? 600 : 400,
        height: cfg.useDialog ? 800 : 600,
        title: cfg.useDialog ? "Yazdır" : undefined,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      try {
        await win.loadURL(full);
        // window.__printReady polling — fetch + render bitsin diye.
        const ready = await win.webContents.executeJavaScript(`
          new Promise((resolve) => {
            if (window.__printReady === true) { resolve(true); return; }
            const start = Date.now();
            const iv = setInterval(() => {
              if (window.__printReady === true) {
                clearInterval(iv);
                resolve(true);
              } else if (Date.now() - start > 8000) {
                clearInterval(iv);
                resolve(false);
              }
            }, 100);
          })
        `).catch(() => false);

        if (!ready) {
          log("[print] WARN: __printReady not set within 8s — printing anyway");
        }
        await new Promise((r) => setTimeout(r, 200));

        // Termal yazıcı kritik fix: pageSize'ı 80mm rulo boyutuna sabitle.
        // Default A4 ise yazıcı sürücüsü A4 sayfayı 80mm rulosuna sığdıramayıp
        // 1cm besleyip durur, kağıt bos cikar. Microns (1mm = 1000μ).
        // useDialog=true ise silent=false yapıp Windows yazıcı dialog'unu aç —
        // kullanıcı manuel "Yazdır" basar, kurtarıcı flow.
        return await new Promise<{ ok: boolean; reason?: string }>((resolve) => {
          win.webContents.print(
            {
              silent: !cfg.useDialog,
              deviceName: opts.deviceName || undefined,
              margins: { marginType: "none" },
              printBackground: true,
              pageSize: {
                width: cfg.paperWidthMm * 1000,
                height: cfg.paperHeightMm * 1000,
              },
              scaleFactor: 100,
              copies: 1,
            },
            (success, errorType) => {
              if (!success) log(`[print] failed: ${errorType}`);
              resolve({ ok: success, reason: success ? undefined : errorType });
              try {
                // Dialog modunda window'u kapatmadan önce kullanıcıya zaman
                // tanı — print job sıraya girdikten sonra kapansa da OK ama
                // bazı sürücüler hala referans tutar.
                setTimeout(() => {
                  try { win.close(); } catch { /* ignore */ }
                }, cfg.useDialog ? 5000 : 0);
              } catch {
                /* ignore */
              }
            }
          );
        });
      } catch (err) {
        log(`[print] error: ${(err as Error).message}`);
        try {
          win.close();
        } catch {
          /* ignore */
        }
        return { ok: false, reason: (err as Error).message };
      }
    }
  );

  ipcMain.handle("printer:list", async () => {
    if (!mainWindow) return [];
    const list = await mainWindow.webContents.getPrintersAsync();
    return list.map((p) => ({
      name: p.name,
      displayName: p.displayName,
      isDefault: p.isDefault,
      status: p.status,
    }));
  });
}

/**
 * Auto-update via electron-updater + GitHub Releases. Kasa her acilista
 * 10sn delay sonra son release'i sorar; bulursa background'da indirir,
 * uygulamayi kapatinca yukler (autoInstallOnAppQuit default true). Her
 * 6 saatte tekrar kontrol — uzun acik kalan kasalar gecikmez.
 */
function setupAutoUpdater() {
  if (!app.isPackaged) {
    log("Dev mode: autoUpdater disabled.");
    return;
  }
  autoUpdater.logger = {
    info: (m: unknown) => log(`[updater] ${m}`),
    warn: (m: unknown) => log(`[updater] WARN ${m}`),
    error: (m: unknown) => log(`[updater] ERROR ${m}`),
    debug: () => {},
  } as never;

  autoUpdater.on("checking-for-update", () => log("[updater] checking..."));
  autoUpdater.on("update-available", (info) =>
    log(`[updater] update available: v${info.version}`)
  );
  autoUpdater.on("update-not-available", () =>
    log("[updater] already at latest version.")
  );
  autoUpdater.on("download-progress", (p) =>
    log(`[updater] download ${Math.round(p.percent)}% (${Math.round(p.bytesPerSecond / 1024)} KB/s)`)
  );
  autoUpdater.on("update-downloaded", (info) => {
    log(`[updater] downloaded v${info.version} — will install on quit.`);
    // Kullaniciyi bilgilendir, "Simdi Yukle" derse hemen yukle.
    void dialog
      .showMessageBox({
        type: "info",
        buttons: ["Şimdi Yükle", "Sonra"],
        defaultId: 0,
        title: "Güncelleme Hazır",
        message: `NodaPos v${info.version} indirildi.`,
        detail: "Kasayı kapatıp tekrar açana kadar otomatik yüklenir. Şimdi yüklemek için butona basın.",
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall();
      });
  });
  autoUpdater.on("error", (err) =>
    log(`[updater] error: ${err?.message ?? err}`)
  );

  // Ilk kontrol pencere acildiktan 10sn sonra (kasa ekranina ilk yansiyan
  // anlik UI yarismasi olmasin). Sonra 6 saatlik periyot.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) =>
      log(`[updater] initial check failed: ${err?.message ?? err}`)
    );
  }, 10_000);
  setInterval(
    () =>
      autoUpdater.checkForUpdates().catch((err) =>
        log(`[updater] periodic check failed: ${err?.message ?? err}`)
      ),
    6 * 60 * 60 * 1000
  );
}

app.whenReady().then(async () => {
  ensureLog();
  registerPrinterIpc();
  try {
    const apiPort = await startApi();
    let frontendPort = 3000;
    if (app.isPackaged) {
      frontendPort = await startFrontend(apiPort);
    } else {
      log("Dev mode: skipping bundled frontend, expecting Next dev server on 3000.");
    }
    activeFrontendPort = frontendPort;
    await createWindow(frontendPort);
    // Caller ID listener pencere açıldıktan SONRA — IPC broadcast'ı için.
    startCallerIdListener(apiPort);
    // Auto-update arka planda — basarisiz olsa bile kasayi engellemesin.
    setupAutoUpdater();
  } catch (err) {
    log(`Startup failed: ${err}`);
    dialog.showErrorBox("PizzaPos başlatılamadı", String(err));
    app.quit();
  }
});

app.on("before-quit", () => {
  if (callerIdListener) {
    try {
      callerIdListener.stop();
    } catch {
      /* ignore */
    }
    callerIdListener = null;
  }
  for (const [name, child] of [
    ["frontend", frontendProcess],
    ["api", apiProcess],
  ] as const) {
    if (!child || child.killed) continue;
    log(`Stopping ${name} child process...`);
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (child && !child.killed) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
    }, 5_000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
