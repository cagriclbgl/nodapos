import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import getPort from "get-port";
import waitOn from "wait-on";
import { CallerIdListener } from "./hid/caller-id-listener";
import { IncomingCallBridge } from "./services/incoming-call-bridge";

let apiProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let logStream: fs.WriteStream | null = null;
let apiCrashCount = 0;
let frontendCrashCount = 0;
let callerIdListener: CallerIdListener | null = null;
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

  const cloudUrl = process.env.PIZZAPOS_CLOUD_URL ?? "";
  const hmacSecret = process.env.PIZZAPOS_HMAC_SECRET ?? "";

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

app.whenReady().then(async () => {
  ensureLog();
  try {
    const apiPort = await startApi();
    let frontendPort = 3000;
    if (app.isPackaged) {
      frontendPort = await startFrontend(apiPort);
    } else {
      log("Dev mode: skipping bundled frontend, expecting Next dev server on 3000.");
    }
    await createWindow(frontendPort);
    // Caller ID listener pencere açıldıktan SONRA — IPC broadcast'ı için.
    startCallerIdListener(apiPort);
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
