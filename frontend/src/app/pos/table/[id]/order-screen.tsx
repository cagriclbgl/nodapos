"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Minus,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react";
import { api, orders as ordersApi } from "@/lib/api";
import { useStoreContext } from "@/lib/store-context";
import { describeError } from "@/lib/use-store-api";
import { formatCurrency } from "@/lib/format";
import {
  AddOrderItemRequest,
  CategoryDto,
  ComboDto,
  CompleteOrderRequest,
  CreateOrderRequest,
  OrderDto,
  ProductDto,
  TableDto,
  UpdateOrderDetailsRequest,
} from "@/types/api";
import { Button } from "@/components/ui-v2/button";
import { Badge } from "@/components/ui-v2/badge";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { cn } from "@/lib/utils";
import { OptionsDialog } from "./options-dialog";
import { PaymentDialog } from "./payment-dialog";
import { DetailsDialog } from "./details-dialog";

const COMBO_TAB = "__combos__";

interface Props {
  tableId: string;
}

/**
 * Touch-first POS terminal for a single table.
 *  - Loads the active order (if any) so a partially-built tab is recovered.
 *  - First product tap on an Empty table creates the order; subsequent taps
 *    append items via /api/orders/{id}/items.
 *  - Snapshots (ProductName, UnitPrice, OptionName, AdditionalPrice) live on
 *    the backend; the cart UI just renders what the server returns.
 */
export function OrderScreen({ tableId }: Props) {
  const { storeId } = useStoreContext();
  const router = useRouter();

  const [table, setTable] = useState<TableDto | null>(null);
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [combos, setCombos] = useState<ComboDto[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");

  const [pendingProduct, setPendingProduct] = useState<ProductDto | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [bootError, setBootError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setBootError(null);
    try {
      const [tbl, cats, prods, activeOrders, combosList] = await Promise.all([
        api.get<TableDto>(`/api/tables/${tableId}`, storeId),
        api.get<CategoryDto[]>("/api/categories", storeId),
        api.get<ProductDto[]>("/api/products", storeId),
        api.get<OrderDto[]>(
          `/api/orders?status=Active&tableId=${tableId}`,
          storeId
        ),
        api.get<ComboDto[]>("/api/combos?activeOnly=true", storeId),
      ]);
      setTable(tbl);
      setCategories(cats.filter((c) => c.isActive));
      setProducts(prods.filter((p) => p.isAvailable));
      setCombos(combosList);
      setOrder(activeOrders[0] ?? null);
      if (!selectedCat && cats.length > 0) {
        setSelectedCat(cats[0].id);
      }
    } catch (err) {
      setBootError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [storeId, tableId, selectedCat]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, tableId]);

  const addLine = async (line: AddOrderItemRequest) => {
    if (!storeId || !table) return;
    setBusy(true);
    setActionError(null);
    try {
      if (!order) {
        const payload: CreateOrderRequest = {
          tableId: table.id,
          orderType: "DineIn",
          discountAmount: 0,
          items: [line],
        };
        const created = await api.post<OrderDto>("/api/orders", payload, storeId);
        setOrder(created);
      } else {
        const updated = await api.post<OrderDto>(
          `/api/orders/${order.id}/items`,
          line,
          storeId
        );
        setOrder(updated);
      }
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const setItemQuantity = async (itemId: string, qty: number) => {
    if (!order) return;
    if (qty <= 0) {
      void removeItem(itemId);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const updated = await api.patch<OrderDto>(
        `/api/orders/${order.id}/items/${itemId}`,
        { quantity: qty },
        storeId
      );
      setOrder(updated);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!order) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await api.delete<OrderDto>(
        `/api/orders/${order.id}/items/${itemId}`,
        storeId
      );
      // Backend auto-cancels an order whose last item was just removed.
      if (updated.status !== "Active") {
        router.push("/pos");
        router.refresh();
        return;
      }
      setOrder(updated);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const onSaveDetails = async (req: UpdateOrderDetailsRequest) => {
    if (!order) return;
    const updated = await api.patch<OrderDto>(
      `/api/orders/${order.id}/details`,
      req,
      storeId
    );
    setOrder(updated);
    setShowDetails(false);
  };

  const onProductTap = (p: ProductDto) => {
    if (p.options.length > 0) {
      setPendingProduct(p);
      return;
    }
    void addLine({ productId: p.id, quantity: 1, productOptionIds: [] });
  };

  /**
   * Combo'yu mevcut siparişe ekler. Kasiyer kampanyaya basar basmaz tek
   * snapshot OrderItem olarak sepete iner — varyant/dialog yok. Adisyonda
   * "Kampanya Adı" + içerik notları görünür, fiyat combo'nun sabit fiyatı.
   *
   * Aktif sipariş yoksa siparişi açmak için seed kalem gerek. Önce combo'nun
   * ilk ürününü dene; boş kombo ise mağazadaki ilk ürünü kullan. Combo
   * eklendikten sonra seed silinir (combo son kalem olmadığı için
   * auto-cancel tetiklenmez).
   */
  const onComboClick = (combo: ComboDto) => {
    void submitCombo(combo);
  };

  const submitCombo = async (combo: ComboDto) => {
    if (!storeId || !table) return;
    setBusy(true);
    setActionError(null);
    try {
      let workingOrderId: string;
      let seedItemId: string | null = null;

      if (!order) {
        const seedProductId =
          combo.items[0]?.productId ?? products[0]?.id;
        if (!seedProductId) {
          setActionError(
            "Sipariş açmak için en az bir ürün gerek — mağazaya ürün ekle."
          );
          return;
        }
        const seedPayload: CreateOrderRequest = {
          tableId: table.id,
          orderType: "DineIn",
          discountAmount: 0,
          items: [
            {
              productId: seedProductId,
              quantity: 1,
              productOptionIds: [],
            },
          ],
        };
        const created = await api.post<OrderDto>(
          "/api/orders",
          seedPayload,
          storeId
        );
        workingOrderId = created.id;
        seedItemId = created.items[0]?.id ?? null;
      } else {
        workingOrderId = order.id;
      }

      const afterCombo = await ordersApi.addCombo(workingOrderId, {
        comboId: combo.id,
        quantity: 1,
      });

      if (seedItemId) {
        const cleaned = await api.delete<OrderDto>(
          `/api/orders/${workingOrderId}/items/${seedItemId}`,
          storeId
        );
        setOrder(cleaned);
      } else {
        setOrder(afterCombo);
      }
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!order) return;
    if (!confirm("Bu siparişi iptal etmek istediğine emin misin?")) return;
    setBusy(true);
    try {
      await api.post(`/api/orders/${order.id}/cancel`, undefined, storeId);
      router.push("/pos");
      router.refresh();
    } catch (err) {
      setActionError(describeError(err));
      setBusy(false);
    }
  };

  const onComplete = async (req: CompleteOrderRequest) => {
    if (!order) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/api/orders/${order.id}/complete`, req, storeId);
      // Print sayfasına yönlendir — sayfa açılınca window.print() otomatik
      // Windows yazıcı dialog'u açar, kasiyer yazıcı seçip "Yazdır" basar.
      // Silent baskı kaldırıldı (termal sürücüsü pageSize/margin uyumsuzluğu
      // yüzünden blank kağıt veriyordu).
      router.push(`/print/receipt/${order.id}`);
      router.refresh();
    } catch (err) {
      setActionError(describeError(err));
      setBusy(false);
      throw err;
    }
  };

  const visibleProducts = useMemo(
    () =>
      products
        .filter((p) => !selectedCat || p.categoryId === selectedCat)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [products, selectedCat]
  );

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (bootError || !table) {
    return (
      <div className="p-10 text-center">
        <p className="text-destructive">{bootError ?? "Masa bulunamadı."}</p>
        <Button variant="link" asChild className="mt-2">
          <Link href="/pos">
            <ArrowLeft /> Masalara dön
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pos">
            <ArrowLeft /> Masalar
          </Link>
        </Button>
        <span className="text-border">|</span>
        <h2 className="text-lg font-semibold">{table.name}</h2>
        <span className="text-xs text-muted-foreground">
          {table.capacity} kişilik
        </span>
        {order && (
          <Badge variant="default" className="ml-1">
            Aktif · {order.orderNumber}
          </Badge>
        )}
        <div className="ml-auto">
          {order && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(true)}
              disabled={busy}
              title="Müşteri bilgisi ve sipariş notu"
            >
              <NotebookPen />
              {order.customerName || order.notes ? "Düzenle" : "Müşteri / Not"}
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left — products */}
        <div className="flex flex-1 flex-col">
          {/* Category tabs + Kampanyalar */}
          <div className="flex gap-1 overflow-x-auto border-b bg-card px-3 py-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCat(c.id)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  c.id === selectedCat
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {c.name}
              </button>
            ))}
            {combos.length > 0 && (
              <button
                onClick={() => setSelectedCat(COMBO_TAB)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  selectedCat === COMBO_TAB
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                ✨ Kampanyalar
              </button>
            )}
            {categories.length === 0 && combos.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Kategori yok.{" "}
                <Link
                  href="/admin/categories"
                  className="font-medium text-primary hover:underline"
                >
                  Ekle
                </Link>
              </p>
            )}
          </div>

          {/* Product / Combo grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {selectedCat === COMBO_TAB ? (
              combos.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">
                  Aktif kampanya yok.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {combos.map((c) => {
                    const summary = c.items
                      .slice()
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((i) => `${i.quantity}x ${i.productName}`)
                      .join(", ");
                    return (
                      <button
                        key={c.id}
                        onClick={() => onComboClick(c)}
                        disabled={busy}
                        className="flex min-h-[120px] flex-col items-start justify-between rounded-2xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all hover:border-primary/60 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
                      >
                        <div className="w-full">
                          <p className="text-base font-semibold leading-tight">
                            {c.name}
                          </p>
                          {c.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {c.description}
                            </p>
                          )}
                          {summary && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {summary}
                            </p>
                          )}
                        </div>
                        <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-primary">
                          {formatCurrency(c.price)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )
            ) : visibleProducts.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">
                Bu kategoride satışta ürün yok.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visibleProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onProductTap(p)}
                    disabled={busy}
                    className="flex min-h-[110px] flex-col items-start justify-between rounded-2xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all hover:border-primary/60 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
                  >
                    <div>
                      <p className="text-base font-semibold leading-tight">{p.name}</p>
                      {p.options.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.options.length} seçenek
                        </p>
                      )}
                    </div>
                    <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-primary">
                      {formatCurrency(p.price)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — cart */}
        <aside className="flex w-full max-w-sm flex-col border-l bg-muted/30">
          <header className="border-b bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">Sipariş</p>
            <p className="font-mono text-3xl font-bold tabular-nums tracking-tight">
              {order ? formatCurrency(order.total) : formatCurrency(0)}
            </p>
          </header>

          <div className="flex-1 overflow-y-auto p-3">
            {!order || order.items.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Sepet boş. Bir ürüne dokun.
              </p>
            ) : (
              <ul className="space-y-2">
                {order.items.map((i) => (
                  <li key={i.id} className="rounded-xl border bg-card p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{i.productName}</p>
                        {i.options.length > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {i.options.map((o) => o.optionName).join(" · ")}
                          </p>
                        )}
                        {i.notes && (
                          <p className="mt-0.5 text-xs italic text-muted-foreground">
                            {i.notes}
                          </p>
                        )}
                      </div>
                      <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums">
                        {formatCurrency(i.lineTotal)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setItemQuantity(i.id, i.quantity - 1)}
                          disabled={busy}
                          aria-label="Azalt"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
                          {i.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setItemQuantity(i.id, i.quantity + 1)}
                          disabled={busy}
                          aria-label="Arttır"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(i.id)}
                        disabled={busy}
                        aria-label="Kalemi sil"
                        title="Kalemi sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="border-t bg-card p-3">
            {order && (
              <div className="mb-3 space-y-0.5 text-sm">
                <Row label="Ara Toplam" value={formatCurrency(order.subtotal)} />
                {order.discountAmount > 0 && (
                  <Row
                    label="İndirim"
                    value={`- ${formatCurrency(order.discountAmount)}`}
                  />
                )}
                <Row
                  label="Toplam"
                  value={formatCurrency(order.total)}
                  strong
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="touch"
                disabled={!order || busy}
                onClick={onCancel}
              >
                İptal
              </Button>
              <Button
                size="touch"
                disabled={!order || order.items.length === 0 || busy}
                onClick={() => setShowPayment(true)}
              >
                Ödemeyi Al
              </Button>
            </div>
          </footer>
        </aside>
      </div>

      {pendingProduct && (
        <OptionsDialog
          product={pendingProduct}
          onClose={() => setPendingProduct(null)}
          onConfirm={async (line) => {
            await addLine(line);
            setPendingProduct(null);
          }}
        />
      )}

      {showPayment && order && (
        <PaymentDialog
          order={order}
          onClose={() => setShowPayment(false)}
          onSubmit={onComplete}
        />
      )}

      {showDetails && order && (
        <DetailsDialog
          order={order}
          onClose={() => setShowDetails(false)}
          onSubmit={onSaveDetails}
        />
      )}
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
      className={cn(
        "flex justify-between",
        strong
          ? "border-t pt-1 text-base font-semibold"
          : "text-muted-foreground"
      )}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
