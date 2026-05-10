"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Cable,
  RefreshCw,
  XCircle,
  Search,
  TestTube,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-v2/card";
import { Button } from "@/components/ui-v2/button";
import { Badge } from "@/components/ui-v2/badge";
import { Separator } from "@/components/ui-v2/separator";
import type {
  CallerIdHidDeviceInfo,
  CallerIdStatusPayload,
} from "@/types/electron";

const TARGET_VID = 0x1a86;
const TARGET_PID = 0xe008;

/**
 * Caller ID ayar paneli — Manager only.
 *
 *  - Cihaz durumu (bağlandı/bulunamadı) canlı; status IPC üzerinden gelir
 *  - Yeniden tara / cihaz listesini göster
 *  - Test modu: gelen ham HID raporlarını canlı listele (parser geliştirme için)
 *
 * Web (Vercel) tarafında window.callerId undefined; bu sayfa "kasa Electron'unda
 * açılmalı" uyarısı gösterir ama yine erişilebilir kalır.
 */
export default function CallerIdSettingsPage() {
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [status, setStatus] = useState<CallerIdStatusPayload>({
    kind: "disconnected",
  });
  const [devices, setDevices] = useState<CallerIdHidDeviceInfo[] | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [rawLog, setRawLog] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBridgeAvailable(!!window.callerId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.callerId) return;
    const offStatus = window.callerId.onStatus((s) => setStatus(s));
    const offRaw = window.callerId.onRaw((p) => {
      setRawLog((cur) =>
        [`[${new Date().toLocaleTimeString("tr-TR")}] ${p.hex}`, ...cur].slice(
          0,
          50
        )
      );
    });
    return () => {
      offStatus();
      offRaw();
    };
  }, []);

  const rescan = async () => {
    if (!window.callerId) return;
    await window.callerId.rescan();
  };

  const listDevices = async () => {
    if (!window.callerId) return;
    setDevices(await window.callerId.listDevices());
  };

  const toggleTestMode = async () => {
    if (!window.callerId) return;
    const next = !testMode;
    await window.callerId.setTestMode(next);
    setTestMode(next);
    if (!next) setRawLog([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Caller ID Ayarları</h2>
        <p className="text-sm text-muted-foreground">
          USB HID Caller ID kutusu (VID 0x{TARGET_VID.toString(16)} PID 0x
          {TARGET_PID.toString(16)}) — kasada bağlı, ek sürücü gerekmez.
        </p>
      </div>

      {!bridgeAvailable && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Bu ekran sadece kasa (Electron) penceresinde anlamlı. Bulut tarayıcıda
          ayar yapılamaz.
        </div>
      )}

      {/* Durum kartı */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cable className="h-5 w-5" /> Cihaz Durumu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
          </div>
          {status.kind === "connected" && (
            <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
              <dt className="text-muted-foreground">Üretici</dt>
              <dd>{status.manufacturer ?? "—"}</dd>
              <dt className="text-muted-foreground">Ürün</dt>
              <dd>{status.product ?? "—"}</dd>
              <dt className="text-muted-foreground">Seri No</dt>
              <dd>{status.serial ?? "—"}</dd>
            </dl>
          )}
          {status.kind === "disconnected" && status.reason && (
            <p className="text-xs text-muted-foreground">{status.reason}</p>
          )}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void rescan()}
              disabled={!bridgeAvailable}
            >
              <RefreshCw /> Yeniden Tara
            </Button>
            <Button
              variant="outline"
              onClick={() => void listDevices()}
              disabled={!bridgeAvailable}
            >
              <Search /> Tüm HID Cihazları Listele
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cihaz listesi */}
      {devices && (
        <Card>
          <CardHeader>
            <CardTitle>HID Cihaz Listesi ({devices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Hiç HID cihazı bulunamadı.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1">VID:PID</th>
                      <th className="py-1">Üretici</th>
                      <th className="py-1">Ürün</th>
                      <th className="py-1">Seri</th>
                      <th className="py-1">Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d, i) => {
                      const target =
                        d.vendorId === TARGET_VID && d.productId === TARGET_PID;
                      return (
                        <tr
                          key={`${d.path ?? i}`}
                          className={target ? "bg-primary/5" : ""}
                        >
                          <td className="py-1 font-mono">
                            {target && "★ "}
                            {d.vendorId?.toString(16).padStart(4, "0")}:
                            {d.productId?.toString(16).padStart(4, "0")}
                          </td>
                          <td className="py-1">{d.manufacturer ?? "—"}</td>
                          <td className="py-1">{d.product ?? "—"}</td>
                          <td className="py-1">{d.serialNumber ?? "—"}</td>
                          <td className="py-1 font-mono">
                            {d.usagePage}/{d.usage}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Test modu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" /> Protokol Test Modu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Açıkken, cihazdan gelen tüm ham HID raporları aşağıda canlı görünür.
            Parser geliştirilirken kullanılır — sıradan kullanımda kapalı tutun.
          </p>
          <Button
            variant={testMode ? "default" : "outline"}
            onClick={() => void toggleTestMode()}
            disabled={!bridgeAvailable}
          >
            {testMode ? "Test Modunu Kapat" : "Test Modunu Aç"}
          </Button>
          {testMode && (
            <div className="max-h-72 overflow-y-auto rounded-lg border bg-black/5 p-2 font-mono text-[11px] dark:bg-white/5">
              {rawLog.length === 0 ? (
                <p className="text-muted-foreground">
                  Henüz veri yok. Bir hattan arayın.
                </p>
              ) : (
                rawLog.map((line, i) => (
                  <div key={i} className="leading-relaxed">
                    {line}
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: CallerIdStatusPayload }) {
  switch (status.kind) {
    case "connected":
      return (
        <Badge className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> Bağlı
        </Badge>
      );
    case "searching":
      return (
        <Badge variant="secondary" className="gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" /> Aranıyor…
        </Badge>
      );
    case "test-mode":
      return (
        <Badge variant="outline" className="gap-1">
          <TestTube className="h-3 w-3" /> Test modunda
        </Badge>
      );
    case "disconnected":
      return (
        <Badge variant="outline" className="gap-1 text-destructive">
          <XCircle className="h-3 w-3" /> Bağlı değil
        </Badge>
      );
  }
}
