"use client";

import { useMemo, useState } from "react";
import { useStoreApi } from "@/lib/use-store-api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { OrderDto, OrderStatus } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

const STATUS_LABEL: Record<OrderStatus, string> = {
  Active: "Aktif",
  Completed: "Tamamlandı",
  Cancelled: "İptal",
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  Active:
    "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  Completed:
    "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  Cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function OrdersPage() {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const path = useMemo(
    () => (status ? `/api/orders?status=${status}` : "/api/orders"),
    [status]
  );

  const { data, loading, error } = useStoreApi<OrderDto[]>(path);
  const [detail, setDetail] = useState<OrderDto | null>(null);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Siparişler</h2>
          <p className="text-zinc-500">Sipariş geçmişini ve aktif siparişleri görüntüle.</p>
        </div>
        <Select
          label="Durum"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | "")}
          className="min-w-44"
        >
          <option value="">Tümü</option>
          <option value="Active">Aktif</option>
          <option value="Completed">Tamamlandı</option>
          <option value="Cancelled">İptal</option>
        </Select>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-2.5">Sipariş No</th>
              <th className="px-4 py-2.5">Masa</th>
              <th className="px-4 py-2.5">Tutar</th>
              <th className="px-4 py-2.5">Durum</th>
              <th className="px-4 py-2.5">Açıldı</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Yükleniyor…
                </td>
              </tr>
            )}
            {!loading && data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Sipariş yok.
                </td>
              </tr>
            )}
            {data?.map((o) => (
              <tr
                key={o.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-4 py-3 font-mono text-xs">{o.orderNumber}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {o.tableName ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono">
                  {formatCurrency(o.total)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[o.status]}`}
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {formatDateTime(o.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDetail(o)}
                  >
                    Detay
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Sipariş ${detail.orderNumber}` : ""}
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Kapat
          </Button>
        }
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Info label="Masa" value={detail.tableName ?? "—"} />
              <Info label="Tip" value={detail.orderType} />
              <Info
                label="Durum"
                value={STATUS_LABEL[detail.status]}
              />
              <Info
                label="Açıldı"
                value={formatDateTime(detail.createdAt)}
              />
              {detail.completedAt && (
                <Info
                  label="Tamamlandı"
                  value={formatDateTime(detail.completedAt)}
                />
              )}
              {detail.customerName && (
                <Info label="Müşteri" value={detail.customerName} />
              )}
            </div>

            <div>
              <h3 className="mb-1.5 text-sm font-semibold">Kalemler</h3>
              <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {detail.items.map((i) => (
                  <li key={i.id} className="px-3 py-2">
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {i.quantity}× {i.productName}
                      </span>
                      <span className="font-mono">
                        {formatCurrency(i.lineTotal)}
                      </span>
                    </div>
                    {i.options.length > 0 && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {i.options
                          .map(
                            (o) =>
                              `${o.optionName}${o.additionalPrice > 0 ? ` (+${formatCurrency(o.additionalPrice)})` : ""}`
                          )
                          .join(" · ")}
                      </p>
                    )}
                    {i.notes && (
                      <p className="mt-0.5 text-xs italic text-zinc-500">
                        {i.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
              <Row label="Ara Toplam" value={formatCurrency(detail.subtotal)} />
              {detail.discountAmount > 0 && (
                <Row
                  label="İndirim"
                  value={`- ${formatCurrency(detail.discountAmount)}`}
                />
              )}
              <Row
                label="Toplam"
                value={formatCurrency(detail.total)}
                strong
              />
            </div>

            {detail.payments.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-sm font-semibold">Ödemeler</h3>
                <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {detail.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex justify-between px-3 py-2"
                    >
                      <span>
                        {p.method}{" "}
                        <span className="text-xs text-zinc-500">
                          · {formatDateTime(p.paidAt)}
                        </span>
                      </span>
                      <span className="font-mono">
                        {formatCurrency(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${strong ? "mt-2 border-t border-zinc-200 pt-2 text-base font-semibold dark:border-zinc-800" : "text-sm"}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
