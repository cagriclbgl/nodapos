"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useStoreContext } from "@/lib/store-context";
import { describeError } from "@/lib/use-store-api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type {
  OrderTypeBreakdown,
  PaymentMethodKey,
  PeriodSummaryDto,
} from "@/types/api";

const PAYMENT_LABEL: Record<PaymentMethodKey, string> = {
  Cash: "Nakit",
  CreditCard: "Kredi Kartı",
  DebitCard: "Banka Kartı",
  MealCard: "Yemek Kartı",
  Other: "Diğer",
};

const ORDER_TYPE_LABEL: Record<OrderTypeBreakdown["orderType"], string> = {
  DineIn: "Masa",
  Takeaway: "Paket",
  Delivery: "Kurye",
};

interface Props {
  from: string;
  to: string;
}

/**
 * 80mm aralık raporu — adisyon yazıcısı için. KPI'lar, ödeme + tip kırılımı,
 * top 5 ürün. Pattern aynı: `end-of-day-receipt-view`.
 */
export function PeriodSummaryReceiptView({ from, to }: Props) {
  const { storeId } = useStoreContext();
  const { store } = useAuth();
  const [summary, setSummary] = useState<PeriodSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    (async () => {
      try {
        const dto = await api.get<PeriodSummaryDto>(
          `/api/reports/period-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&top=5`,
          storeId
        );
        if (cancelled) return;
        setSummary(dto);
      } catch (err) {
        if (cancelled) return;
        setError(describeError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, from, to]);

  // Silent print için __printReady işaretle, aksi halde browser print dialog'u aç.
  useEffect(() => {
    if (!summary) return;
    const isSilent =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("silent") === "1";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        (window as unknown as { __printReady?: boolean }).__printReady = true;
      });
    });

    if (isSilent) return;
    const t = window.setTimeout(() => window.print(), 200);
    return () => window.clearTimeout(t);
  }, [summary]);

  if (loading) {
    return (
      <div className="p-10 text-center text-sm text-zinc-500">Yükleniyor…</div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-600">{error ?? "Rapor alınamadı."}</p>
        <Link
          href="/admin/reports"
          className="mt-4 inline-block text-orange-600 hover:underline"
        >
          ← Geri dön
        </Link>
      </div>
    );
  }

  const paymentTotal = summary.paymentBreakdown.reduce(
    (s, r) => s + r.total,
    0
  );
  const sameDay = summary.fromDate === summary.toDate;

  return (
    <div className="mx-auto max-w-[270px] px-3 py-4 font-mono text-[12px] leading-snug text-black print:px-0 print:py-2 print:max-w-none print:w-[72mm]">
      {/* Toolbar — print:hidden */}
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link
          href="/admin/reports"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          ← Geri
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
        >
          Tekrar Yazdır
        </button>
      </div>

      <div className="text-center">
        <p className="text-[16px] font-bold uppercase tracking-wide">
          {store?.name ?? "Mağaza"}
        </p>
        <p className="text-[13px] font-semibold">
          {sameDay ? "GÜNLÜK RAPOR" : "DÖNEM RAPORU"}
        </p>
      </div>

      <Hr />

      <Row
        label="Aralık"
        value={
          sameDay
            ? summary.fromDate
            : `${summary.fromDate} → ${summary.toDate}`
        }
      />
      <Row label="Çıktı" value={formatDateTime(new Date().toISOString())} />

      <Hr />

      <div className="text-center text-[13px] font-bold">
        TOPLAM CİRO: {formatCurrency(summary.totalRevenue)}
      </div>

      <Hr />

      <Row
        label="Tamamlanan"
        value={`${summary.completedOrderCount} sipariş`}
      />
      <Row label="İptal" value={`${summary.cancelledOrderCount} sipariş`} />
      <Row label="Toplam Ürün" value={String(summary.totalItemQuantity)} />
      {summary.totalDiscount > 0 && (
        <Row
          label="İndirim"
          value={`- ${formatCurrency(summary.totalDiscount)}`}
        />
      )}

      <Hr />
      <p className="text-[11px] font-semibold uppercase">Ödeme Yöntemi</p>
      {summary.paymentBreakdown.length === 0 ? (
        <p className="text-[11px] italic text-zinc-700">— ödeme yok —</p>
      ) : (
        <div className="space-y-0.5">
          {summary.paymentBreakdown.map((p) => (
            <Row
              key={p.method}
              label={`${PAYMENT_LABEL[p.method] ?? p.method} (${p.count})`}
              value={formatCurrency(p.total)}
            />
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-dashed border-black pt-1 text-[12px] font-bold">
            <span>Ödeme Toplamı</span>
            <span className="tabular-nums">{formatCurrency(paymentTotal)}</span>
          </div>
        </div>
      )}

      <Hr />
      <p className="text-[11px] font-semibold uppercase">Sipariş Tipi</p>
      {summary.orderTypeBreakdown.length === 0 ? (
        <p className="text-[11px] italic text-zinc-700">— sipariş yok —</p>
      ) : (
        <div className="space-y-0.5">
          {summary.orderTypeBreakdown.map((row) => (
            <Row
              key={row.orderType}
              label={`${ORDER_TYPE_LABEL[row.orderType] ?? row.orderType} (${row.count})`}
              value={formatCurrency(row.total)}
            />
          ))}
        </div>
      )}

      <Hr />
      <p className="text-[11px] font-semibold uppercase">En Çok Satan 5</p>
      {summary.topProducts.length === 0 ? (
        <p className="text-[11px] italic text-zinc-700">— satış yok —</p>
      ) : (
        <div className="space-y-0.5">
          {summary.topProducts.map((row, i) => (
            <div key={`${row.productId}-${i}`} className="leading-tight">
              <div className="flex items-baseline justify-between gap-1">
                <span className="truncate">
                  {i + 1}. {row.productName}
                </span>
                <span className="shrink-0 tabular-nums">
                  {row.quantity}×
                </span>
              </div>
              <div className="flex justify-end text-[10px] text-zinc-700">
                {formatCurrency(row.revenue)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Hr />
      <p className="text-center text-[10px] text-zinc-700">
        {sameDay
          ? `${summary.fromDate} özeti`
          : `${summary.fromDate} → ${summary.toDate} özeti`}
      </p>
    </div>
  );
}

function Hr() {
  return (
    <div className="my-2 border-t border-dashed border-black" aria-hidden />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0">{label}</span>
      <span className="break-words text-right tabular-nums">{value}</span>
    </div>
  );
}
