import { app, BrowserWindow, dialog } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import getPort from "get-port";
import waitOn from "wait-on";

let apiProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let logStream: fs.WriteStream | null = null;
let apiCrashCount = 0;
const MAX_API_CRASHES = 3;

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

async function startApi(): Promise<number> {
  // Frontend (Next.js) reads NEXT_PUBLIC_API_BASE_URL=http://localhost:5000.
  // Prefer 5000 so the existing config works; fall back to a free port if
  // someone else is on 5000 (note: in that case the browser-side frontend
  // calls would still hit 5000 and fail — kill the conflicting process).
  const port = await getPort({ port: 5000 });
  const dbPath = path.join(app.getPath("userData"), "pos.db");
  const apiDir = app.isPackaged
    ? path.join(process.resourcesPath, "api")
    : path.resolve(__dirname, "..", "resources", "api");
  const exe = path.join(
    apiDir,
    process.platform === "win32" ? "PizzaPos.Api.exe" : "PizzaPos.Api"
  );

  log(`Starting API: exe=${exe} port=${port} db=${dbPath}`);

  // Cloud sync wiring. Both values must match the cloud deployment exactly —
  // the kasa won't be able to talk to it otherwise. Operator sets these via
  // env when launching Electron (or through a future provisioning UI):
  //   set PIZZAPOS_CLOUD_URL=https://api.nodapos.com
  //   set PIZZAPOS_HMAC_SECRET=<same 64-char hex as cloud .env>
  // Empty CloudBaseUrl disables both push and pull workers (Program.cs check).
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
      // Frontend dev server origin — needed because Production mode disables
      // the development "allow any localhost" fallback in Program.cs.
      Cors__AllowedOrigins: "http://localhost:3000",
      DOTNET_ROLL_FORWARD: "Major",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  apiProcess.stdout?.on("data", (d) => log(`[api-out] ${d.toString().trim()}`));
  apiProcess.stderr?.on("data", (d) => log(`[api-err] ${d.toString().trim()}`));
  apiProcess.on("exit", (code) => {
    log(`API exited with code ${code}`);
    apiCrashCount++;
    if (apiCrashCount >= MAX_API_CRASHES) {
      dialog.showErrorBox(
        "PizzaPos API durdu",
        `Backend ${apiCrashCount} kez crash etti. Loglar: ${logStream?.path ?? "(yok)"}`
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

async function createWindow(port: number) {
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

  // Dev: Next.js dev server. Production'da Next standalone'u 2. child process
  // olarak başlatıp http://127.0.0.1:<otherPort> yüklemek doğru yol — sabah karar.
  const url = process.env.PIZZAPOS_DEV_URL || "http://localhost:3000";
  // const productionUrl = `http://127.0.0.1:${port}`;
  log(`Loading window: ${url}`);
  await mainWindow.loadURL(url);
}

app.whenReady().then(async () => {
  ensureLog();
  try {
    const port = await startApi();
    await createWindow(port);
  } catch (err) {
    log(`Startup failed: ${err}`);
    dialog.showErrorBox("PizzaPos başlatılamadı", String(err));
    app.quit();
  }
});

app.on("before-quit", () => {
  if (!apiProcess || apiProcess.killed) return;
  log("Stopping API child process...");
  try {
    apiProcess.kill();
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    if (apiProcess && !apiProcess.killed) {
      try {
        apiProcess.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
  }, 5_000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
