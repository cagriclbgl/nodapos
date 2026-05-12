"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useStoreContext } from "@/lib/store-context";
import { describeError } from "@/lib/use-store-api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { OrderDto, OrderType, PaymentMethod } from "@/types/api";

interface Props {
  orderId: string;
}

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  DineIn: "Masa",
  Takeaway: "Paket",
  Delivery: "Kurye",
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  Cash: "Nakit",
  CreditCard: "Kredi Kartı",
  DebitCard: "Banka Kartı",
  MealCard: "Yemek Kartı",
  Other: "Diğer",
};

/**
 * 80mm-style thermal receipt. Renders a centred mono-spaced ticket and fires
 * `window.print()` once data is loaded — close-then-back is the operator
 * flow. The "Masalara Dön" button is hidden in print output via `print:hidden`.
 */
export function ReceiptView({ orderId }: Props) {
  const { storeId } = useStoreContext();
  const { store } = useAuth();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    (async () => {
      try {
        const o = await api.get<OrderDto>(`/api/orders/${orderId}`, storeId);
        if (cancelled) return;
        setOrder(o);
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
  }, [storeId, orderId]);

  // Trigger the browser print dialog after the receipt mounts. Small delay
  // so layout/fonts settle before printing.
  //
  // Silent print: Electron main process bu sayfayı hidden BrowserWindow'da
  // ?silent=1 ile açar ve webContents.print({ silent: true }) çağırır.
  // Otomatik browser print buradan çağrılırsa ÇİFT baskı olur — atla.
  useEffect(() => {
    if (!order) return;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("silent") === "1") return;
    }
    const handle = window.setTimeout(() => {
      window.print();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [order]);

  if (loading) {
    return (
      <div className="p-10 text-center text-sm text-zinc-500">Yükleniyor…</div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-600">{error ?? "Sipariş bulunamadı."}</p>
        <Link
          href="/pos"
          className="mt-4 inline-block text-orange-600 hover:underline"
        >
          ← Masalara dön
        </Link>
      </div>
    );
  }

  const targetLabel = (() => {
    if (order.orderType === "DineIn") {
      return order.tableName ? `Masa: ${order.tableName}` : "Masa";
    }
    return ORDER_TYPE_LABEL[order.orderType];
  })();

  return (
    <div className="mx-auto max-w-[320px] px-3 py-4 font-mono text-[12px] leading-snug text-black print:px-0 print:py-2">
      {/* Toolbar — hidden in print output */}
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link
          href="/pos"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          ← Masalara Dön
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
        >
          Tekrar Yazdır
        </button>
      </div>

      {/* Header */}
      <div className="text-center">
        <p className="text-[16px] font-bold uppercase tracking-wide">
          {store?.name ?? "Mağaza"}
        </p>
      </div>

      <Hr />

      <Row label="Sipariş" value={order.orderNumber} />
      <Row label="Tarih" value={formatDateTime(order.createdAt)} />
      {order.completedAt && (
        <Row label="Kapanış" value={formatDateTime(order.completedAt)} />
      )}
      <Row label="Tip" value={targetLabel} />
      {order.customerName && (
        <Row label="Müşteri" value={order.customerName} />
      )}
      {order.customerPhone && (
        <Row label="Telefon" value={order.customerPhone} />
      )}

      <Hr />

      {/* Items */}
      <div className="space-y-1">
        {order.items.map((i) => (
          <div key={i.id}>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 break-words">
                {i.quantity}× {i.productName}
              </span>
              <span className="whitespace-nowrap tabular-nums">
                {formatCurrency(i.lineTotal)}
              </span>
            </div>
            {i.options.length > 0 && (
              <p className="pl-3 text-[11px] text-zinc-700">
                {i.options.map((o) => o.optionName).join(" · ")}
              </p>
            )}
            {i.notes && (
              <p className="pl-3 text-[11px] italic text-zinc-700">
                {i.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      <Hr />

      <Row
        label="Ara Toplam"
        value={formatCurrency(order.subtotal)}
      />
      {order.discountAmount > 0 && (
        <Row
          label="İndirim"
          value={`- ${formatCurrency(order.discountAmount)}`}
        />
      )}
      <div className="mt-1 flex items-center justify-between border-t border-dashed border-black pt-1 text-[14px] font-bold">
        <span>TOPLAM</span>
        <span className="tabular-nums">{formatCurrency(order.total)}</span>
      </div>

      {order.payments.length > 0 && (
        <>
          <Hr />
          <div className="space-y-0.5">
            {order.payments.map((p) => (
              <Row
                key={p.id}
                label={METHOD_LABEL[p.method]}
                value={formatCurrency(p.amount)}
              />
            ))}
          </div>
        </>
      )}

      {order.notes && (
        <>
          <Hr />
          <p className="text-[11px] italic">Not: {order.notes}</p>
        </>
      )}

      <Hr />
      <p className="text-center text-[11px]">
        Bizi tercih ettiğiniz için teşekkürler!
      </p>
      <p className="mt-1 text-center text-[10px] text-zinc-700">
        {formatDateTime(order.completedAt ?? order.createdAt)}
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
