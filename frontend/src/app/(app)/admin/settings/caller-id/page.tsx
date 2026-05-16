"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Cable,
  RefreshCw,
  XCircle,
  PhoneIncoming,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-v2/card";
import { Badge } from "@/components/ui-v2/badge";
import { Separator } from "@/components/ui-v2/separator";
import type {
  CallerIdSignalsPayload,
  CallerIdStatusPayload,
} from "@/types/electron";

/**
 * Caller ID ayar paneli — Manager only.
 *
 * v0.1.20 itibarıyla cihaz iletişimi Cidshow vendor SDK `cid.dll` v9 üzerinden.
 * USB enumerate + FSK decode + numara parse DLL içinde — kasada sadece şunlar
 * görünür: cihaz model/seri/bağlantı + her hattın canlı sinyal seviyesi.
 *
 * Eski HID listener + ham frame test paneli + kayıt cihazı kaldırıldı.
 */
export default function CallerIdSettingsPage() {
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [status, setStatus] = useState<CallerIdStatusPayload>({
    kind: "disconnected",
  });
  const [signals, setSignals] = useState<CallerIdSignalsPayload | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBridgeAvailable(!!window.callerId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.callerId) return;
    const offStatus = window.callerId.onStatus((s) => setStatus(s));
    const offSignals = window.callerId.onSignals((p) => setSignals(p));
    return () => {
      offStatus();
      offSignals();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Caller ID Ayarları</h2>
        <p className="text-sm text-muted-foreground">
          Cidshow C812A/C814A USB Caller ID kutusu — vendor SDK ile entegre. Ek
          sürücü/yapılandırma gerekmez, otomatik tanınır.
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
              <dd>{status.manufacturer ?? "Cidshow.com"}</dd>
              <dt className="text-muted-foreground">Model</dt>
              <dd>{status.product ?? "—"}</dd>
              <dt className="text-muted-foreground">Seri No</dt>
              <dd>{status.serial ?? "—"}</dd>
            </dl>
          )}
          {(status.kind === "disconnected" || status.kind === "searching") &&
            status.reason && (
              <p className="text-xs text-muted-foreground">{status.reason}</p>
            )}
        </CardContent>
      </Card>

      {/* Sinyal seviyeleri */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneIncoming className="h-5 w-5" /> Hat Sinyalleri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Her hat için canlı sinyal seviyesi (0-100). Cihaz takılı ve hatta
            kablo bağlıysa 50+ olmalı. Çağrı sırasında dalgalanma normaldir.
            Kullanılmayan hatlar 0&apos;da kalır.
          </p>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((idx) => {
              const value = signals?.signals?.[idx] ?? 0;
              const used = value > 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={used ? "font-medium" : "text-muted-foreground"}>
                      Hat {idx + 1}
                    </span>
                    <span className="font-mono">{value}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            DLL Durumu: <span className="font-mono">{status.kind}</span>
            {signals === null && bridgeAvailable && " · sinyal bekleniyor..."}
          </p>
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
          <RefreshCw className="h-3 w-3 animate-spin" /> Cihaz bekleniyor…
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
