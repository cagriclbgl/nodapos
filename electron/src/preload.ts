import { contextBridge, ipcRenderer } from "electron";

/**
 * Renderer'a açılan minimal API. Caller ID için tek yönlü pub-sub:
 *   - onCall(cb): main -> renderer çağrı eventi (matched customer + recent orders)
 *   - onStatus(cb): main -> renderer cihaz durumu (connected/searching/disconnected)
 *   - onSignals(cb): main -> renderer 4-hat sinyal seviyeleri (ayar paneli bar)
 *   - getStatus(): renderer -> main mevcut durum snapshot'ı
 *
 * Eski HID listener (onRaw/rescan/listDevices/setTestMode) v0.1.20'da kaldırıldı —
 * Cidshow cid.dll v9 (vendor SDK) USB enumerate + FSK decode'u içeride yapıyor.
 */
contextBridge.exposeInMainWorld("app", {
  version: process.env.npm_package_version ?? "0.1.0",
  platform: process.platform,
});

const CHANNELS = {
  CALL: "caller-id:call",
  STATUS: "caller-id:status",
  SIGNALS: "caller-id:signals",
  GET_STATUS: "caller-id:get-status",
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
  onStatus: (cb: (payload: unknown) => void) => {
    const handler = (_e: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(CHANNELS.STATUS, handler);
    return () => ipcRenderer.removeListener(CHANNELS.STATUS, handler);
  },
  onSignals: (cb: (payload: { model?: string; serial?: string; signals: number[] }) => void) => {
    const handler = (_e: unknown, payload: { model?: string; serial?: string; signals: number[] }) =>
      cb(payload);
    ipcRenderer.on(CHANNELS.SIGNALS, handler);
    return () => ipcRenderer.removeListener(CHANNELS.SIGNALS, handler);
  },
  getStatus: () => ipcRenderer.invoke(CHANNELS.GET_STATUS),
});
