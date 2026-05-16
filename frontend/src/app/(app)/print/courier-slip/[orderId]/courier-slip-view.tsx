"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useStoreContext } from "@/lib/store-context";
import { useAuth } from "@/lib/auth-context";
import { describeError } from "@/lib/use-store-api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { formatPhoneForDisplay } from "@/lib/phone-normalize";
import type { OrderDto } from "@/types/api";

interface Props {
  orderId: string;
}

/**
 * 80mm fişe optimize edilmiş kurye adisyonu. Standart fişten farkı:
 *  - Müşteri adı + telefon BÜYÜK punto (kurye uzaktan okusun)
 *  - Adres çok satırlı, büyük punto
 *  - Ödeme yöntemi: nakit ise "Nakit Alınacak" + tutar; kart ise "Ödendi"
 *  - Kurye imza alanı (boş kutu)
 *
 * Yüklendikten sonra otomatik window.print() — kasiyer slip çıkar, "Masalara
 * Dön" ile geri.
 */
export function CourierSlipView({ orderId }: Props) {
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
        if (!cancelled) setError(describeError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, orderId]);

  // Silent print: main process ?silent=1 ile açar, window.__printReady = true
  // bekleyip webContents.print({ silent: true }) çağırır. Bizim window.print()
  // çift baskı yapmasın; sessiz modda sadece ready flag set edip çıkıyoruz.
  useEffect(() => {
    if (!order) return;
    const isSilent =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("silent") === "1";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        (window as unknown as { __printReady?: boolean }).__printReady = true;
      });
    });

    if (isSilent) return;
    const t = setTimeout(() => window.print(), 200);
    return () => clearTimeout(t);
  }, [order]);

  if (loading) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  }
  if (error || !order) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-destructive">{error ?? "Sipariş bulunamadı."}</p>
        <Link href="/pos" className="mt-4 inline-block text-sm text-primary underline">
          Masalara Dön
        </Link>
      </div>
    );
  }

  const cashPayments = order.payments.filter((p) => p.method === "Cash");
  const cardTotal = order.payments
    .filter((p) => p.method !== "Cash")
    .reduce((s, p) => s + p.amount, 0);
  const cashTotal = cashPayments.reduce((s, p) => s + p.amount, 0);
  const cashOnDelivery = order.payments.length === 0; // henüz ödeme alınmamış

  return (
    <div className="mx-auto max-w-[270px] p-4 font-mono text-sm print:p-0 print:max-w-none print:w-[72mm]">
      <header className="mb-3 text-center">
        <p className="text-base font-bold">{store?.name ?? ""}</p>
        <p className="text-xs">KURYE ADİSYONU</p>
        <p className="mt-1 text-xs">
          {order.orderNumber} · {formatDateTime(order.createdAt)}
        </p>
      </header>

      <div className="mb-3 border-y border-dashed py-2 text-center">
        <p className="text-xl font-extrabold leading-tight">
          {order.customerName ?? "—"}
        </p>
        <p className="text-lg font-bold tabular-nums">
          {formatPhoneForDisplay(order.customerPhone)}
        </p>
      </div>

      {order.deliveryAddressSnapshot && (
        <div className="mb-3 border-b border-dashed pb-2">
          <p className="text-xs font-semibold uppercase">Adres</p>
          <p className="whitespace-pre-line text-base font-bold leading-snug">
            {order.deliveryAddressSnapshot}
          </p>
          {order.deliveryDistrict && (
            <p className="text-sm font-semibold">{order.deliveryDistrict}</p>
          )}
        </div>
      )}

      <div className="mb-3 border-b border-dashed pb-2">
        <p className="text-xs font-semibold uppercase">Sipariş</p>
        <ul className="mt-1 space-y-1.5">
          {order.items.map((it) => (
            <li key={it.id}>
              <div className="flex justify-between gap-2 font-bold">
                <span>
                  {it.quantity}× {it.productName}
                </span>
                <span className="tabular-nums">{formatCurrency(it.lineTotal)}</span>
              </div>
              {it.options.length > 0 && (
                <ul className="ml-3 mt-0.5 space-y-0.5 text-xs">
                  {it.options.map((o) => (
                    <li key={o.id} className="flex justify-between gap-2">
                      <span>
                        {o.groupName}: {o.optionName}
                      </span>
                      {o.additionalPrice > 0 && (
                        <span className="tabular-nums">
                          +{formatCurrency(o.additionalPrice)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {it.notes && (
                <p className="ml-3 mt-0.5 text-xs italic">› {it.notes}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-3 space-y-1">
        <div className="flex justify-between">
          <span>Ara Toplam</span>
          <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>İndirim</span>
            <span className="tabular-nums">
              -{formatCurrency(order.discountAmount)}
            </span>
          </div>
        )}
        <div className="flex justify-between border-t border-dashed pt-1 text-base font-bold">
          <span>TOPLAM</span>
          <span className="tabular-nums">{formatCurrency(order.total)}</span>
        </div>
      </div>

      <div className="mb-3 border-y border-dashed py-2 text-center text-base font-bold">
        {cashOnDelivery ? (
          <p>NAKİT ALINACAK · {formatCurrency(order.total)}</p>
        ) : (
          <>
            {cashTotal > 0 && <p>NAKİT ALINDI · {formatCurrency(cashTotal)}</p>}
            {cardTotal > 0 && <p>KARTLA ÖDENDİ · {formatCurrency(cardTotal)}</p>}
          </>
        )}
      </div>

      {order.notes && (
        <div className="mb-3 border-b border-dashed pb-2">
          <p className="text-xs font-semibold uppercase">Not</p>
          <p className="text-sm">{order.notes}</p>
        </div>
      )}

      <div className="mt-6">
        <p className="text-xs">Kurye imzası:</p>
        <div className="mt-2 h-12 border" />
      </div>

      <footer className="mt-6 flex gap-2 print:hidden">
        <Link
          href="/pos"
          className="flex-1 rounded-lg border px-3 py-2 text-center text-sm hover:bg-muted"
        >
          Masalara Dön
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Tekrar Yazdır
        </button>
      </footer>
    </div>
  );
}
