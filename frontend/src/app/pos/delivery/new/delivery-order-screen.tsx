"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, Trash2, Truck, Package } from "lucide-react";
import { api, customers as customersApi, orders as ordersApi } from "@/lib/api";
import { useStoreContext } from "@/lib/store-context";
import { describeError } from "@/lib/use-store-api";
import { formatCurrency } from "@/lib/format";
import { CustomerSearch, type SelectedCustomer } from "@/components/CustomerSearch";
import { Button } from "@/components/ui-v2/button";
import { Badge } from "@/components/ui-v2/badge";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { cn } from "@/lib/utils";
import { OptionsDialog } from "@/app/pos/table/[id]/options-dialog";
import type {
  AddOrderItemRequest,
  CategoryDto,
  CreateDeliveryOrderRequest,
  CustomerAddressDto,
  CustomerDto,
  ProductDto,
  ProductOptionDto,
} from "@/types/api";

interface Props {
  callId: string | null;
  customerId: string | null;
  prefillPhone: string | null;
}

interface CartLine {
  /** Stable per-cart key — birden fazla aynı ürün bulunabilir (notlu / opsiyonsuz). */
  key: string;
  productId: string;
  productName: string;
  /** Saf ürün fiyatı (seçenek ek fiyatları DAHİL DEĞİL). */
  unitPrice: number;
  quantity: number;
  notes: string | null;
  /** Seçilen ProductOption Id'leri — backend snapshot için lazım. */
  productOptionIds: string[];
  /** UI gösterimi için seçenek özet snapshot'ı (Group: Option +price). */
  optionSummary: Array<{
    groupName: string;
    optionName: string;
    additionalPrice: number;
  }>;
  /** (unitPrice + sum(extras)) × quantity — client-side hesap, backend yine doğrular. */
  lineTotal: number;
}

type DeliveryType = "Delivery" | "Takeaway";

export function DeliveryOrderScreen({
  callId,
  customerId,
  prefillPhone,
}: Props) {
  const { storeId } = useStoreContext();
  const router = useRouter();

  const [orderType, setOrderType] = useState<DeliveryType>("Delivery");
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDto | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [inlineAddress, setInlineAddress] = useState<{ line: string; district: string }>({
    line: "",
    district: "",
  });
  const [useInlineAddress, setUseInlineAddress] = useState(false);

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");

  const [pendingProduct, setPendingProduct] = useState<ProductDto | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Boot: kategoriler + ürünler + (varsa) müşteri detayını yükle.
  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    setLoading(true);
    setBootError(null);
    (async () => {
      try {
        const [cats, prods] = await Promise.all([
          api.get<CategoryDto[]>("/api/categories", storeId),
          api.get<ProductDto[]>("/api/products", storeId),
        ]);
        if (cancelled) return;
        const activeCats = cats.filter((c) => c.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
        setCategories(activeCats);
        setProducts(prods.filter((p) => p.isAvailable));
        setSelectedCat((prev) => prev || activeCats[0]?.id || "");

        if (customerId) {
          const dto = await customersApi.get(customerId);
          if (cancelled) return;
          setCustomerDetail(dto);
          setCustomer({ id: dto.id, name: dto.name, phone: dto.phone });
          const def = dto.addresses.find((a) => a.isDefault) ?? dto.addresses[0];
          if (def) setSelectedAddressId(def.id);
        }
      } catch (err) {
        if (!cancelled) setBootError(describeError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, customerId]);

  // Müşteri değişirse adres listesini yeniden çek.
  useEffect(() => {
    if (!customer || customer.id === customerDetail?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const dto = await customersApi.get(customer.id);
        if (cancelled) return;
        setCustomerDetail(dto);
        const def = dto.addresses.find((a) => a.isDefault) ?? dto.addresses[0];
        setSelectedAddressId(def?.id ?? null);
      } catch (err) {
        if (!cancelled) setActionError(describeError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customer, customerDetail?.id]);

  const productsByCat = useMemo(() => {
    const m: Record<string, ProductDto[]> = {};
    for (const p of products) {
      (m[p.categoryId] ??= []).push(p);
    }
    return m;
  }, [products]);

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.lineTotal, 0),
    [cart]
  );

  /**
   * Aktif seçeneği olan ürünlere tıklayınca OptionsDialog aç (boyut/ekstra
   * seçimi şart). Seçeneksiz ürünler tek tıkla sepete eklenir.
   */
  const onProductClick = (p: ProductDto) => {
    const hasActive = p.options.some((o) => o.isActive);
    if (hasActive) {
      setPendingProduct(p);
      return;
    }
    pushSimpleToCart(p);
  };

  const pushSimpleToCart = (p: ProductDto) => {
    setCart((cur) => {
      const existing = cur.find(
        (l) =>
          l.productId === p.id &&
          l.productOptionIds.length === 0 &&
          (l.notes ?? "") === ""
      );
      if (existing) {
        return cur.map((l) =>
          l === existing
            ? {
                ...l,
                quantity: l.quantity + 1,
                lineTotal: l.unitPrice * (l.quantity + 1),
              }
            : l
        );
      }
      return [
        ...cur,
        {
          key: `simple:${p.id}:${Date.now()}`,
          productId: p.id,
          productName: p.name,
          unitPrice: p.price,
          quantity: 1,
          notes: null,
          productOptionIds: [],
          optionSummary: [],
          lineTotal: p.price,
        },
      ];
    });
  };

  /**
   * OptionsDialog onay aksiyonunda buraya düşer. Backend'in line total formülüyle
   * birebir hesaplama: (unitPrice + sum(option.additionalPrice)) × quantity.
   * Kayıt başarılıysa cart'a yeni bir satır olarak push (aynı ürün+seçenek
   * kombinasyonu birden fazla kez sepete eklenebilir; gerekirse manuel
   * birleştirilir).
   */
  const onOptionsConfirm = async (line: AddOrderItemRequest): Promise<void> => {
    if (!pendingProduct) return;
    const summary = pendingProduct.options
      .filter((o) => line.productOptionIds.includes(o.id))
      .map((o) => ({
        groupName: o.groupName,
        optionName: o.name,
        additionalPrice: o.additionalPrice,
      }));
    const extras = summary.reduce((s, x) => s + x.additionalPrice, 0);
    const lineTotal = (pendingProduct.price + extras) * line.quantity;

    setCart((cur) => [
      ...cur,
      {
        key: `opt:${pendingProduct.id}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
        productId: pendingProduct.id,
        productName: pendingProduct.name,
        unitPrice: pendingProduct.price,
        quantity: line.quantity,
        notes: line.notes ?? null,
        productOptionIds: line.productOptionIds,
        optionSummary: summary,
        lineTotal,
      },
    ]);
    setPendingProduct(null);
  };

  const incrementLine = (key: string, delta: number) => {
    setCart((cur) =>
      cur
        .map((l) => {
          if (l.key !== key) return l;
          const q = l.quantity + delta;
          if (q <= 0) return { ...l, quantity: 0 }; // filter aşağıda düşürür
          const extras = l.optionSummary.reduce((s, x) => s + x.additionalPrice, 0);
          return { ...l, quantity: q, lineTotal: (l.unitPrice + extras) * q };
        })
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (key: string) => setCart((cur) => cur.filter((l) => l.key !== key));

  const canSubmit =
    !!customer &&
    cart.length > 0 &&
    (orderType === "Takeaway" ||
      (useInlineAddress
        ? inlineAddress.line.trim().length > 0
        : !!selectedAddressId));

  const submit = async () => {
    if (!canSubmit || !customer) return;
    setBusy(true);
    setActionError(null);
    try {
      const items: AddOrderItemRequest[] = cart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        notes: l.notes,
        productOptionIds: l.productOptionIds,
      }));
      const req: CreateDeliveryOrderRequest = {
        orderType,
        customerId: customer.id,
        customerAddressId:
          orderType === "Delivery" && !useInlineAddress ? selectedAddressId : null,
        addressLine:
          orderType === "Delivery" && useInlineAddress ? inlineAddress.line.trim() : null,
        district:
          orderType === "Delivery" && useInlineAddress
            ? inlineAddress.district.trim() || null
            : null,
        notes: notes.trim() || null,
        discountAmount: 0,
        items,
        incomingCallId: callId,
      };
      const created = await ordersApi.createDelivery(req);
      if (orderType === "Delivery") {
        router.push(`/print/courier-slip/${created.id}`);
      } else {
        router.push(`/print/receipt/${created.id}`);
      }
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!storeId) {
    return <p className="p-6 text-sm text-muted-foreground">Mağaza yükleniyor…</p>;
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-rows-[auto_1fr] gap-0 lg:grid-cols-[1fr_360px] lg:grid-rows-1">
      {/* Sol: müşteri + ürün */}
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/pos">
              <ArrowLeft /> Masalara dön
            </Link>
          </Button>
          <h2 className="text-xl font-semibold">Yeni Paket / Kurye Sipariş</h2>
          {callId && <Badge variant="secondary">Çağrıdan</Badge>}
        </div>

        {bootError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {bootError}
          </div>
        )}

        {/* Sipariş tipi */}
        <div className="flex gap-2">
          <Button
            variant={orderType === "Delivery" ? "default" : "outline"}
            onClick={() => setOrderType("Delivery")}
          >
            <Truck /> Kurye
          </Button>
          <Button
            variant={orderType === "Takeaway" ? "default" : "outline"}
            onClick={() => setOrderType("Takeaway")}
          >
            <Package /> Paket (Gel-Al)
          </Button>
        </div>

        {/* Müşteri */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Müşteri
          </p>
          <CustomerSearch value={customer} onChange={setCustomer} disabled={busy} />
          {prefillPhone && !customer && (
            <p className="mt-1 text-xs text-muted-foreground">
              Çağrıdan gelen numara: <span className="font-mono">{prefillPhone}</span>{" "}
              — kayıtlı değilse "Yeni Müşteri" ile ekleyebilirsin.
            </p>
          )}
        </div>

        {/* Adres (sadece Kurye için) */}
        {orderType === "Delivery" && customer && customerDetail && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Teslimat adresi
            </p>
            {customerDetail.addresses.length === 0 && !useInlineAddress && (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Bu müşterinin kayıtlı adresi yok. Aşağıdan adres yazın.
              </p>
            )}
            {customerDetail.addresses.length > 0 && !useInlineAddress && (
              <ul className="space-y-1">
                {customerDetail.addresses.map((a) => (
                  <AddressRow
                    key={a.id}
                    addr={a}
                    selected={selectedAddressId === a.id}
                    onSelect={() => setSelectedAddressId(a.id)}
                  />
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setUseInlineAddress((v) => !v)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              {useInlineAddress
                ? "Kayıtlı adresleri kullan"
                : "Adresi elle yaz (kaydetme)"}
            </button>
            {useInlineAddress && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Açık adres"
                  value={inlineAddress.line}
                  onChange={(e) =>
                    setInlineAddress((p) => ({ ...p, line: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                />
                <input
                  type="text"
                  placeholder="Mahalle / İlçe (opsiyonel)"
                  value={inlineAddress.district}
                  onChange={(e) =>
                    setInlineAddress((p) => ({ ...p, district: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Kategori sekmesi */}
        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={selectedCat === c.id ? "default" : "outline"}
                  onClick={() => setSelectedCat(c.id)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {(productsByCat[selectedCat] ?? []).map((p) => {
                const hasOpts = p.options.some((o) => o.isActive);
                return (
                  <button
                    key={p.id}
                    onClick={() => onProductClick(p)}
                    disabled={busy}
                    className={cn(
                      "rounded-xl border bg-card p-3 text-left shadow-sm transition-all",
                      "hover:border-primary/60 active:scale-[0.99] disabled:opacity-60"
                    )}
                  >
                    <p className="font-medium">{p.name}</p>
                    <p className="mt-1 font-mono text-sm tabular-nums text-primary">
                      {formatCurrency(p.price)}
                      {hasOpts && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Seçenek
                        </Badge>
                      )}
                    </p>
                  </button>
                );
              })}
              {(productsByCat[selectedCat] ?? []).length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">
                  Bu kategoride ürün yok.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sağ: sepet + submit */}
      <div className="flex flex-col border-l bg-muted/30 p-4">
        <h3 className="mb-3 text-lg font-semibold">Sepet</h3>
        {cart.length === 0 && (
          <p className="text-sm text-muted-foreground">Henüz ürün eklenmedi.</p>
        )}
        <ul className="flex-1 space-y-2 overflow-y-auto">
          {cart.map((l) => (
            <li
              key={l.key}
              className="rounded-lg border bg-background p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.productName}</p>
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(l.unitPrice)} × {l.quantity}
                  </p>
                  {l.optionSummary.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {l.optionSummary.map((o, i) => (
                        <li
                          key={i}
                          className="flex justify-between text-[11px] text-muted-foreground"
                        >
                          <span>
                            {o.groupName}: {o.optionName}
                          </span>
                          {o.additionalPrice > 0 && (
                            <span className="font-mono">
                              +{formatCurrency(o.additionalPrice)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {l.notes && (
                    <p className="mt-1 truncate text-[11px] italic text-muted-foreground">
                      {l.notes}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(l.lineTotal)}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => incrementLine(l.key, -1)}
                      aria-label="Azalt"
                    >
                      <Minus />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => incrementLine(l.key, +1)}
                      aria-label="Artır"
                    >
                      <Plus />
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeLine(l.key)}
                    aria-label="Sil"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sipariş notu (opsiyonel)"
            rows={2}
            className="w-full rounded-lg border bg-background p-2 text-sm"
          />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ara toplam</span>
            <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          {actionError && (
            <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
              {actionError}
            </p>
          )}
          <Button
            size="lg"
            className="w-full"
            disabled={!canSubmit || busy}
            onClick={() => void submit()}
          >
            {busy ? "Kaydediliyor…" : `Siparişi Onayla • ${formatCurrency(subtotal)}`}
          </Button>
        </div>
      </div>

      {pendingProduct && (
        <OptionsDialog
          product={pendingProduct}
          onClose={() => setPendingProduct(null)}
          onConfirm={onOptionsConfirm}
        />
      )}
    </div>
  );
}

function AddressRow({
  addr,
  selected,
  onSelect,
}: {
  addr: CustomerAddressDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full rounded-lg border p-2 text-left text-sm transition-colors",
          selected
            ? "border-primary bg-primary/5"
            : "border-border hover:bg-muted"
        )}
      >
        <span className="block font-medium">
          {addr.label}
          {addr.isDefault && (
            <Badge variant="secondary" className="ml-2 text-[10px]">
              Varsayılan
            </Badge>
          )}
        </span>
        <span className="block text-xs text-muted-foreground">
          {addr.addressLine}
          {addr.district ? ` — ${addr.district}` : ""}
        </span>
      </button>
    </li>
  );
}
