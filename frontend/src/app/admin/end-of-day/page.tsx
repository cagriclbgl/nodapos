"use client";

import { useMemo, useState } from "react";
import { Printer, RotateCcw } from "lucide-react";
import { useStoreApi } from "@/lib/use-store-api";
import { formatCurrency } from "@/lib/format";
import {
  DailySummaryDto,
  PaymentMethodKey,
  OrderTypeBreakdown,
} from "@/types/api";
import { Button } from "@/components/ui-v2/button";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { Badge } from "@/components/ui-v2/badge";

const PAYMENT_LABEL: Record<PaymentMethodKey, string> = {
  Cash: "Nakit",
  CreditCard: "Kredi Kartı",
  DebitCard: "Banka Kartı",
  MealCard: "Yemek Kartı",
  Other: "Diğer",
};

const ORDER_TYPE_LABEL: Record<OrderTypeBreakdown["orderType"], string> = {
  DineIn: "Masa",
  Takeaway: "Paket (Gel-Al)",
  Delivery: "Kurye",
};

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function EndOfDayPage() {
  const [date, setDate] = useState<string>(todayLocal());

  const summary = useStoreApi<DailySummaryDto>(
    `/api/reports/daily-summary?date=${date}`
  );

  const paymentRows = summary.data?.paymentBreakdown ?? [];
  const orderTypeRows = summary.data?.orderTypeBreakdown ?? [];

  const paymentTotal = useMemo(
    () => paymentRows.reduce((s, r) => s + r.total, 0),
    [paymentRows]
  );

  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const onPrint = async () => {
    setPrintError(null);
    const url = `/print/end-of-day/${date}`;
    // Electron (kasa) içinde window.printer expose edilir — yazıcı seçim
    // diyalogu olmadan doğrudan termal yazıcıya basar.
    if (typeof window !== "undefined" && window.printer) {
      setPrinting(true);
      try {
        const res = await window.printer.print(url);
        if (!res.ok) {
          setPrintError(`Yazdırma başarısız: ${res.reason ?? "bilinmeyen hata"}. Yeni sekme açılıyor.`);
          window.open(url, "_blank");
        }
      } catch (err) {
        setPrintError(`Yazıcı hatası: ${(err as Error).message}. Yeni sekme açılıyor.`);
        window.open(url, "_blank");
      } finally {
        setPrinting(false);
      }
      return;
    }
    // Web ortamı (Vercel admin paneli) — eski davranış, tarayıcının
    // yazdır diyalogu çıkar.
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Gün Sonu</h2>
          <p className="text-sm text-muted-foreground">
            Seçilen gün için tamamlanan siparişlerin ciro + ödeme + tip
            kırılımı — fişe yazdırılabilir.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Tarih</span>
            <input
              type="date"
              value={date}
              max={todayLocal()}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            />
          </label>
          <Button variant="outline" onClick={() => void summary.refresh()}>
            <RotateCcw /> Yenile
          </Button>
          <Button
            size="lg"
            onClick={() => void onPrint()}
            disabled={!summary.data || printing}
          >
            <Printer /> {printing ? "Yazdırılıyor…" : "Yazdır"}
          </Button>
        </div>
      </header>

      {summary.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {summary.error}
        </p>
      )}
      {printError && (
        <p className="rounded-lg border border-yellow-400/50 bg-yellow-50 p-3 text-sm text-yellow-800">
          {printError}
        </p>
      )}

      {summary.loading && !summary.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : summary.data ? (
        <>
          {/* KPI kartları */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Toplam Ciro"
              value={formatCurrency(summary.data.totalRevenue)}
              accent
            />
            <KpiCard
              label="Tamamlanan Sipariş"
              value={String(summary.data.completedOrderCount)}
              sub={
                summary.data.cancelledOrderCount > 0
                  ? `${summary.data.cancelledOrderCount} iptal`
                  : undefined
              }
            />
            <KpiCard
              label="Toplam Ürün"
              value={String(summary.data.totalItemQuantity)}
            />
            <KpiCard
              label="Uygulanan İndirim"
              value={formatCurrency(summary.data.totalDiscount)}
            />
          </section>

          {/* İki sütun: ödeme yöntemi + tip kırılımı */}
          <section className="grid gap-3 lg:grid-cols-2">
            <article className="rounded-2xl border bg-card p-5">
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Ödeme Yöntemi</h3>
                <Badge variant="secondary">
                  {formatCurrency(paymentTotal)}
                </Badge>
              </header>
              {paymentRows.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Bu günde ödeme yok.
                </p>
              ) : (
                <ul className="divide-y">
                  {paymentRows.map((row) => (
                    <li
                      key={row.method}
                      className="flex items-center justify-between py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {PAYMENT_LABEL[row.method] ?? row.method}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.count} ödeme
                        </p>
                      </div>
                      <p className="font-mono text-base font-semibold tabular-nums">
                        {formatCurrency(row.total)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-2xl border bg-card p-5">
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sipariş Tipi</h3>
                <Badge variant="secondary">
                  {summary.data.completedOrderCount} sipariş
                </Badge>
              </header>
              {orderTypeRows.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Bu günde tamamlanmış sipariş yok.
                </p>
              ) : (
                <ul className="divide-y">
                  {orderTypeRows.map((row) => (
                    <li
                      key={row.orderType}
                      className="flex items-center justify-between py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {ORDER_TYPE_LABEL[row.orderType] ?? row.orderType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.count} sipariş
                        </p>
                      </div>
                      <p className="font-mono text-base font-semibold tabular-nums">
                        {formatCurrency(row.total)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <p className="text-xs text-muted-foreground">
            Aralık: {new Date(summary.data.rangeStartUtc).toLocaleString("tr-TR")}
            {" — "}
            {new Date(summary.data.rangeEndUtc).toLocaleString("tr-TR")}{" "}
            (UTC saklanır, kasanın yerel saatine göre filtrelendi)
          </p>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border bg-card p-5 " +
        (accent ? "border-primary/40 bg-primary/5" : "")
      }
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
