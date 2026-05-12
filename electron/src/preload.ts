import { contextBridge, ipcRenderer } from "electron";

/**
 * Renderer'a açılan minimal API. Caller ID için tek yönlü pub-sub:
 *   - onCall(cb): main -> renderer çağrı eventi (matched customer + recent orders)
 *   - onRaw(cb): main -> renderer ham hex (yalnızca test paneli aktifken)
 *   - onStatus(cb): main -> renderer cihaz durumu (connected/disconnected/...)
 *   - rescan(): renderer -> main "yeniden tara" tetikler
 *   - listDevices(): renderer -> main mevcut HID cihaz listesini ister
 *   - setTestMode(active): renderer -> main test paneli aç/kapa
 */
contextBridge.exposeInMainWorld("app", {
  version: process.env.npm_package_version ?? "0.1.0",
  platform: process.platform,
});

const CHANNELS = {
  CALL: "caller-id:call",
  RAW: "caller-id:raw",
  STATUS: "caller-id:status",
  RESCAN: "caller-id:rescan",
  LIST_DEVICES: "caller-id:list-devices",
  SET_TEST_MODE: "caller-id:set-test-mode",
} as const;

/**
 * Termal yazıcıya sessizce basma — main process hidden BrowserWindow açar,
 * URL'yi yükler, webContents.print({ silent: true }) çağırır, sonra kapatır.
 *   - print(url, deviceName?): renderer "şu sayfayı yazdır" der; ana
 *     pencereye etkisi yok. deviceName boş ise sistem varsayılan yazıcısı.
 *   - listPrinters(): mevcut yazıcı listesi (settings ekranı için).
 */
contextBridge.exposeInMainWorld("printer", {
  print: (url: string, deviceName?: string) =>
    ipcRenderer.invoke("printer:print", { url, deviceName }),
  listPrinters: () => ipcRenderer.invoke("printer:list"),
});

contextBridge.exposeInMainWorld("callerId", {
  onCall: (cb: (payload: unknown) => void) => {
    const handler = (_e: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(CHANNELS.CALL, handler);
    return () => ipcRenderer.removeListener(CHANNELS.CALL, handler);
  },
  onRaw: (cb: (payload: { hex: string }) => void) => {
    const handler = (_e: unknown, payload: { hex: string }) => cb(payload);
    ipcRenderer.on(CHANNELS.RAW, handler);
    return () => ipcRenderer.removeListener(CHANNELS.RAW, handler);
  },
  onStatus: (cb: (payload: unknown) => void) => {
    const handler = (_e: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(CHANNELS.STATUS, handler);
    return () => ipcRenderer.removeListener(CHANNELS.STATUS, handler);
  },
  rescan: () => ipcRenderer.invoke(CHANNELS.RESCAN),
  listDevices: () => ipcRenderer.invoke(CHANNELS.LIST_DEVICES),
  setTestMode: (active: boolean) =>
    ipcRenderer.invoke(CHANNELS.SET_TEST_MODE, active),
});
