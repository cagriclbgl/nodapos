"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ChefHat,
  CheckCircle2,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Plus,
  Printer,
  Truck,
} from "lucide-react";
import { incomingCalls, orders as ordersApi } from "@/lib/api";
import { describeError } from "@/lib/use-store-api";
import { useStoreContext } from "@/lib/store-context";
import { startOfDayIso, endOfDayIso, formatCurrency, formatDateTime } from "@/lib/format";
import { formatPhoneForDisplay } from "@/lib/phone-normalize";
import { Badge } from "@/components/ui-v2/badge";
import { Button } from "@/components/ui-v2/button";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { EmptyState } from "@/components/ui-v2/empty-state";
import type {
  FulfillmentStatus,
  IncomingCallDto,
  IncomingCallStatus,
  OrderDto,
} from "@/types/api";

/** Hangi durumun ardından hangisi geliyor — "İlerlet" butonu bunu kullanır. */
const NEXT_FULFILLMENT: Record<FulfillmentStatus, FulfillmentStatus | null> = {
  Pending: "InKitchen",
  InKitchen: "Ready",
  Ready: "OutForDelivery",
  OutForDelivery: "Delivered",
  Delivered: null,
};

const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  Pending: "Beklemede",
  InKitchen: "Hazırlanıyor",
  Ready: "Hazır",
  OutForDelivery: "Yolda",
  Delivered: "Teslim Edildi",
};

const FULFILLMENT_NEXT_LABEL: Record<FulfillmentStatus, string> = {
  Pending: "Hazırlamaya Başla",
  InKitchen: "Hazır",
  Ready: "Yola Çıktı",
  OutForDelivery: "Teslim Edildi",
  Delivered: "",
};

const FULFILLMENT_VARIANT: Record<FulfillmentStatus, "default" | "secondary" | "outline"> = {
  Pending: "outline",
  InKitchen: "default",
  Ready: "default",
  OutForDelivery: "default",
  Delivered: "secondary",
};

const CALL_STATUS_LABEL: Record<IncomingCallStatus, string> = {
  New: "Yeni",
  Handled: "İlgilenildi",
  Missed: "Cevapsız",
  Ignored: "Yoksayıldı",
};

/**
 * Paket Servis: kasiyerin tek bakışta "şu an ne hazırlanıyor, ne yola çıktı,
 * az önce kim aradı" bilgisini görüp yeni paket sipariş açabilmesi için
 * sadeleştirilmiş tek-sayfa görünüm. Tabs/sekme yok — herşey aşağı kayarak görünür.
 */
export default function PaketServisPage() {
  const { storeId } = useStoreContext();

  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [calls, setCalls] = useState<IncomingCallDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setError(null);
    try {
      // Bugünkü aktif paket/kurye siparişleri + tüm çağrılar paralel çekilir.
      const [takeaway, delivery, callsData] = await Promise.all([
        ordersApi.list({
          status: "Active",
          orderType: "Takeaway",
          from: startOfDayIso(),
          to: endOfDayIso(),
        }),
        ordersApi.list({
          status: "Active",
          orderType: "Delivery",
          from: startOfDayIso(),
          to: endOfDayIso(),
        }),
        incomingCalls.list({
          from: startOfDayIso(),
          to: endOfDayIso(),
          limit: 100,
        }),
      ]);
      // İki order listesini birleştir + yenilik sırasına dizel.
      const merged = [...takeaway, ...delivery].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(merged);
      setCalls(callsData);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-refresh her 15 saniyede — kasiyer sipariş listesinin canlı kalmasını ister.
  useEffect(() => {
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const advanceFulfillment = async (order: OrderDto, next: FulfillmentStatus) => {
    if (busyId) return;
    setBusyId(order.id);
    setError(null);
    try {
      await ordersApi.updateFulfillment(order.id, { status: next });
      await refresh();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const markCallMissed = async (id: string) => {
    try {
      await incomingCalls.resolve(id, { status: "Missed" });
      void refresh();
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* ---- BAŞLIK + ANA CTA ------------------------------------------- */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Paket Servis</h1>
          <p className="text-sm text-muted-foreground">
            Aktif paket siparişler ve gelen çağrılar.
          </p>
        </div>
        <Button asChild size="lg" className="h-12 shrink-0 px-5 text-base shadow-md">
          <Link href="/pos/delivery/new">
            <Plus className="mr-2 h-5 w-5" />
            Yeni Paket Sipariş
          </Link>
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ---- AKTİF SİPARİŞLER -------------------------------------------- */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-xl font-semibold">Aktif Paket Siparişleri</h2>
          {!loading && (
            <span className="text-sm text-muted-foreground">({orders.length})</span>
          )}
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Şu an aktif paket sipariş yok"
            description='Yeni bir sipariş açmak için yukarıdaki "Yeni Paket Sipariş" butonunu kullan.'
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                busy={busyId === o.id}
                onAdvance={(next) => void advanceFulfillment(o, next)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---- BUGÜNKÜ ÇAĞRILAR -------------------------------------------- */}
      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-xl font-semibold">Bugün Gelen Aramalar</h2>
          {!loading && (
            <span className="text-sm text-muted-foreground">({calls.length})</span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : calls.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="Bugün arama gelmedi"
            description="Caller ID cihazı bağlıysa aramalar otomatik buraya düşer."
          />
        ) : (
          <ul className="space-y-2">
            {calls.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {c.status === "Missed" ? (
                    <PhoneMissed className="h-4 w-4 shrink-0 text-amber-500" />
                  ) : (
                    <PhoneIncoming className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.matchedCustomer?.name ?? "Bilinmeyen"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{formatPhoneForDisplay(c.phone)}</span>
                      <span className="mx-1.5">·</span>
                      {formatDateTime(c.receivedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {CALL_STATUS_LABEL[c.status]}
                  </Badge>
                  {c.status === "New" && (
                    <>
                      <Button asChild size="sm">
                        <Link
                          href={
                            c.matchedCustomer
                              ? `/pos/delivery/new?callId=${c.id}&customerId=${c.matchedCustomer.id}`
                              : `/pos/delivery/new?callId=${c.id}`
                          }
                        >
                          Sipariş Aç
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void markCallMissed(c.id)}
                      >
                        Cevapsız
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OrderCard({
  order,
  busy,
  onAdvance,
}: {
  order: OrderDto;
  busy: boolean;
  onAdvance: (next: FulfillmentStatus) => void;
}) {
  // OrderDto.fulfillmentStatus optional alan — yeni yaratılan order'larda
  // "Pending" gelir, eski cloud verisinde undefined olabilir.
  const status: FulfillmentStatus = order.fulfillmentStatus ?? "Pending";
  const next = NEXT_FULFILLMENT[status];
  const nextLabel = FULFILLMENT_NEXT_LABEL[status];

  const isDelivery = order.orderType === "Delivery";

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">
            {order.customerName ?? "Müşteri"}
          </p>
          {order.customerPhone && (
            <p className="truncate text-xs text-muted-foreground font-mono">
              {formatPhoneForDisplay(order.customerPhone)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={FULFILLMENT_VARIANT[status]}>
            {FULFILLMENT_LABEL[status]}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {isDelivery ? "Kurye" : "Gel-al"}
          </Badge>
        </div>
      </div>

      {isDelivery && order.deliveryAddressSnapshot && (
        <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-foreground/80">
          📍 {order.deliveryAddressSnapshot}
          {order.deliveryDistrict && (
            <span className="text-muted-foreground"> · {order.deliveryDistrict}</span>
          )}
        </p>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {order.items.length} ürün · {formatDateTime(order.createdAt)}
        </span>
        <span className="text-base font-bold">{formatCurrency(order.total)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="flex-1"
        >
          <Link href={`/print/courier-slip/${order.id}`} target="_blank">
            <Printer className="mr-1.5 h-4 w-4" />
            Fiş
          </Link>
        </Button>
        {next && (
          <Button
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => onAdvance(next)}
          >
            {status === "Pending" && <ChefHat className="mr-1.5 h-4 w-4" />}
            {status === "InKitchen" && <CheckCircle2 className="mr-1.5 h-4 w-4" />}
            {status === "Ready" && <Truck className="mr-1.5 h-4 w-4" />}
            {status === "OutForDelivery" && <CheckCircle2 className="mr-1.5 h-4 w-4" />}
            {busy ? "..." : nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

