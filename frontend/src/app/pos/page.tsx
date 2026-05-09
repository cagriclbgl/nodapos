"use client";

import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { useStoreApi } from "@/lib/use-store-api";
import { OrderDto, TableDto, TableStatus } from "@/types/api";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui-v2/badge";
import { Button } from "@/components/ui-v2/button";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { EmptyState } from "@/components/ui-v2/empty-state";

const STATUS_LABEL: Record<TableStatus, string> = {
  Empty: "Boş",
  Occupied: "Açık",
  AwaitingPayment: "Ödeme Bekliyor",
};

// Sol kenar şeridi — masa kartının durumunu hızlı taramak için.
const STATUS_STRIP: Record<TableStatus, string> = {
  Empty: "bg-zinc-300 dark:bg-zinc-700",
  Occupied: "bg-primary",
  AwaitingPayment: "bg-amber-500",
};

const STATUS_BADGE: Record<TableStatus, "secondary" | "default" | "outline"> = {
  Empty: "secondary",
  Occupied: "default",
  AwaitingPayment: "outline",
};

export default function PosTables() {
  const tables = useStoreApi<TableDto[]>("/api/tables");
  const orders = useStoreApi<OrderDto[]>("/api/orders?status=Active");

  const orderByTable: Record<string, OrderDto> = {};
  (orders.data ?? []).forEach((o) => {
    if (o.tableId) orderByTable[o.tableId] = o;
  });

  const visible = (tables.data ?? [])
    .filter((t) => t.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Masalar</h2>
          <p className="text-sm text-muted-foreground">
            Sipariş açmak için bir masaya dokun.
          </p>
        </div>
      </div>

      {(tables.error || orders.error) && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {tables.error || orders.error}
        </div>
      )}

      {tables.loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Tanımlı aktif masa yok"
          description="Yönetici panelinden ilk masayı ekleyerek başlayın."
          action={
            <Button asChild>
              <Link href="/admin/tables">
                <Plus /> Masa ekle
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((t) => {
            const order = orderByTable[t.id];
            return (
              <Link
                key={t.id}
                href={`/pos/table/${t.id}`}
                className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition-all hover:border-primary/60 hover:shadow-md active:scale-[0.99]"
              >
                <span
                  className={`absolute inset-y-0 left-0 w-1.5 ${STATUS_STRIP[t.status]}`}
                  aria-hidden
                />
                <div className="pl-2">
                  <p className="text-3xl font-bold leading-none">{t.name}</p>
                  <Badge variant={STATUS_BADGE[t.status]} className="mt-2">
                    {STATUS_LABEL[t.status]}
                  </Badge>
                  <p className="mt-1 text-xs text-muted-foreground">{t.capacity} kişi</p>
                </div>
                {order && (
                  <div className="pl-2 text-right">
                    <p className="text-xs text-muted-foreground">
                      {order.items.length} ürün
                    </p>
                    <p className="font-mono text-xl font-semibold tabular-nums">
                      {formatCurrency(order.total)}
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
