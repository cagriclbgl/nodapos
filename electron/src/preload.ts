import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("app", {
  version: process.env.npm_package_version ?? "0.1.0",
  platform: process.platform,
});
