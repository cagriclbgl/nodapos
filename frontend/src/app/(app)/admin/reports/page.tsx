"use client";

import { useMemo, useState } from "react";
import { Calendar, FileDown, Printer, RotateCcw } from "lucide-react";
import { useStoreApi } from "@/lib/use-store-api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";
import type {
  OrderTypeBreakdown,
  PaymentMethodKey,
  PeriodSummaryDto,
  TopProductRow,
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

type PresetKey = "today" | "week" | "month" | "custom";

function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Pazartesi'yi haftanın başı kabul eder. */
function startOfWeekMonday(now: Date): Date {
  const d = new Date(now);
  const dow = d.getDay(); // 0=Pazar
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function presetRange(p: PresetKey, today: Date): { from: string; to: string } {
  if (p === "today") {
    const iso = toIsoLocal(today);
    return { from: iso, to: iso };
  }
  if (p === "week") {
    return { from: toIsoLocal(startOfWeekMonday(today)), to: toIsoLocal(today) };
  }
  if (p === "month") {
    return { from: toIsoLocal(startOfMonth(today)), to: toIsoLocal(today) };
  }
  // custom fallback
  return { from: toIsoLocal(today), to: toIsoLocal(today) };
}

export default function ReportsPage() {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoLocal(today), [today]);
  const { store } = useAuth();

  const [preset, setPreset] = useState<PresetKey>("week");
  const initial = useMemo(() => presetRange("week", today), [today]);
  const [from, setFrom] = useState<string>(initial.from);
  const [to, setTo] = useState<string>(initial.to);

  const summary = useStoreApi<PeriodSummaryDto>(
    from && to
      ? `/api/reports/period-summary?from=${from}&to=${to}&top=5`
      : null
  );

  const choosePreset = (p: PresetKey) => {
    setPreset(p);
    if (p === "custom") return;
    const r = presetRange(p, today);
    setFrom(r.from);
    setTo(r.to);
  };

  const paymentRows = summary.data?.paymentBreakdown ?? [];
  const orderTypeRows = summary.data?.orderTypeBreakdown ?? [];
  const topProducts = summary.data?.topProducts ?? [];
  const paymentTotal = useMemo(
    () => paymentRows.reduce((s, r) => s + r.total, 0),
    [paymentRows]
  );

  const onPrint = () => {
    // Hem adisyon yazıcı hem PDF için tek akış: 80mm termal sayfayı yeni
    // sekmede aç, window.print() yazıcı dialog'unu açar. Kullanıcı
    // "Microsoft Print to PDF" seçerse PDF dosyası alır, termal yazıcı
    // seçerse fişe basar — aynı 80mm görünüm. Kasada A4 yazıcı olmadığı
    // için PDF de 80mm dar şerit olarak indirilir.
    window.open(`/print/period-summary/${from}/${to}`, "_blank");
  };

  const onPdf = onPrint;

  return (
    <div className="space-y-6 print:space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-semibold">Raporlar</h2>
          <p className="text-sm text-muted-foreground">
            Haftalık / aylık satış özeti — ciro, ödeme yöntemi, sipariş tipi ve
            en çok satan 5 ürün. Adisyon yazıcısından ya da PDF olarak indir.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="outline" onClick={() => void summary.refresh()}>
            <RotateCcw /> Yenile
          </Button>
          <Button variant="outline" onClick={onPdf} disabled={!summary.data}>
            <FileDown /> PDF
          </Button>
          <Button onClick={onPrint} disabled={!summary.data}>
            <Printer /> Yazdır (Adisyon)
          </Button>
        </div>
      </header>

      {/* Preset + custom range */}
      <section className="rounded-2xl border bg-card p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1">
            {([
              ["today", "Bugün"],
              ["week", "Bu Hafta"],
              ["month", "Bu Ay"],
              ["custom", "Özel"],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={preset === key ? "default" : "outline"}
                onClick={() => choosePreset(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Başlangıç</span>
            <input
              type="date"
              value={from}
              max={to || todayIso}
              onChange={(e) => {
                setPreset("custom");
                setFrom(e.target.value);
              }}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Bitiş</span>
            <input
              type="date"
              value={to}
              min={from}
              max={todayIso}
              onChange={(e) => {
                setPreset("custom");
                setTo(e.target.value);
              }}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            />
          </label>
          <span className="text-xs text-muted-foreground">
            <Calendar className="mr-1 inline h-3 w-3" />
            {summary.data?.fromDate ?? from} → {summary.data?.toDate ?? to} (dahil)
          </span>
        </div>
      </section>

      {summary.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {summary.error}
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
          {/* Sadece PDF/print görünür başlık — modern rapor düzeni, sağ üst markamız. */}
          <section className="hidden print:block print:mb-6">
            <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Satış Raporu
                </p>
                <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
                  {store?.name ?? "Mağaza"}
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  {summary.data.fromDate === summary.data.toDate
                    ? `${summary.data.fromDate} (günlük)`
                    : `${summary.data.fromDate} → ${summary.data.toDate}`}
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-base font-bold text-primary-foreground">
                    N
                  </span>
                  <span className="text-lg font-semibold tracking-tight text-black">
                    NodaPos
                  </span>
                </div>
                <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
                  Çıktı
                </p>
                <p className="text-xs tabular-nums text-zinc-700">
                  {new Date().toLocaleString("tr-TR")}
                </p>
              </div>
            </div>
          </section>

          {/* KPI kartları */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
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

          {/* İki sütun: ödeme + tip */}
          <section className="grid gap-3 lg:grid-cols-2 print:grid-cols-2 print:gap-2">
            <article className="rounded-2xl border bg-card p-5 print:rounded-lg print:p-3 print:break-inside-avoid">
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Ödeme Yöntemi</h3>
                <Badge variant="secondary">{formatCurrency(paymentTotal)}</Badge>
              </header>
              {paymentRows.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Bu aralıkta ödeme yok.
                </p>
              ) : (
                <ul className="divide-y">
                  {paymentRows.map((row) => (
                    <li
                      key={row.method}
                      className="flex items-center justify-between py-2 print:py-1"
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

            <article className="rounded-2xl border bg-card p-5 print:rounded-lg print:p-3 print:break-inside-avoid">
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sipariş Tipi</h3>
                <Badge variant="secondary">
                  {summary.data.completedOrderCount} sipariş
                </Badge>
              </header>
              {orderTypeRows.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Bu aralıkta tamamlanmış sipariş yok.
                </p>
              ) : (
                <ul className="divide-y">
                  {orderTypeRows.map((row) => (
                    <li
                      key={row.orderType}
                      className="flex items-center justify-between py-2 print:py-1"
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

          {/* Top 5 ürün */}
          <section className="rounded-2xl border bg-card p-5 print:rounded-lg print:p-3 print:break-inside-avoid">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">En Çok Satan 5 Ürün</h3>
              <Badge variant="secondary">Adet bazında</Badge>
            </header>
            {topProducts.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Bu aralıkta satılmış ürün yok.
              </p>
            ) : (
              <TopProductsTable rows={topProducts} />
            )}
          </section>

          <p className="text-xs text-muted-foreground print:hidden">
            Aralık: {new Date(summary.data.rangeStartUtc).toLocaleString("tr-TR")}
            {" — "}
            {new Date(summary.data.rangeEndUtc).toLocaleString("tr-TR")}{" "}
            (UTC saklanır, kasanın yerel saatine göre filtrelendi)
          </p>

          {/* Sadece PDF/print footer — marka imzası + aralık. */}
          <footer className="hidden print:block print:mt-8 print:border-t print:border-zinc-300 print:pt-3">
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>
                {summary.data.fromDate === summary.data.toDate
                  ? `${summary.data.fromDate} özeti`
                  : `${summary.data.fromDate} → ${summary.data.toDate} özeti`}
              </span>
              <span className="font-medium tracking-wide">
                NodaPos · {store?.name ?? "Mağaza"}
              </span>
            </div>
          </footer>
        </>
      ) : null}
    </div>
  );
}

function TopProductsTable({ rows }: { rows: TopProductRow[] }) {
  return (
    <ol className="divide-y">
      {rows.map((row, i) => (
        <li
          key={`${row.productId}-${i}`}
          className="flex items-center gap-3 py-2 print:py-1"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary print:h-6 print:w-6 print:text-xs">
            {i + 1}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {row.productName}
          </p>
          <p className="font-mono text-sm tabular-nums text-muted-foreground">
            {row.quantity} adet
          </p>
          <p className="w-28 text-right font-mono text-sm font-semibold tabular-nums">
            {formatCurrency(row.revenue)}
          </p>
        </li>
      ))}
    </ol>
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
        "rounded-2xl border bg-card p-5 print:rounded-lg print:p-3 print:break-inside-avoid " +
        (accent ? "border-primary/40 bg-primary/5" : "")
      }
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums print:text-xl">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
