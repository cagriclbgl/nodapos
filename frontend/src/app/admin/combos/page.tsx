"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { combos as combosApi } from "@/lib/api";
import { describeError, useStoreApi } from "@/lib/use-store-api";
import {
  CategoryDto,
  ComboDto,
  CreateComboItemRequest,
  CreateComboRequest,
  ProductDto,
  UpdateComboRequest,
} from "@/types/api";
import { Button } from "@/components/ui-v2/button";
import { Input } from "@/components/ui-v2/input";
import { Label } from "@/components/ui-v2/label";
import { Badge } from "@/components/ui-v2/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-v2/dialog";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DraftItem {
  productId: string;
  quantity: number;
  displayOrder: number;
}

interface Draft {
  name: string;
  description: string;
  price: number;
  displayOrder: number;
  isActive: boolean;
  items: DraftItem[];
}

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  price: 0,
  displayOrder: 0,
  isActive: true,
  items: [],
};

export default function CombosPage() {
  const combos = useStoreApi<ComboDto[]>("/api/combos");
  const cats = useStoreApi<CategoryDto[]>("/api/categories");
  const prods = useStoreApi<ProductDto[]>("/api/products");

  const [editing, setEditing] = useState<ComboDto | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const productById = useMemo(() => {
    const m = new Map<string, ProductDto>();
    for (const p of prods.data ?? []) m.set(p.id, p);
    return m;
  }, [prods.data]);

  const categoryById = useMemo(() => {
    const m = new Map<string, CategoryDto>();
    for (const c of cats.data ?? []) m.set(c.id, c);
    return m;
  }, [cats.data]);

  const groupedProducts = useMemo(() => {
    const groups = new Map<
      string,
      { category: CategoryDto; products: ProductDto[] }
    >();
    const term = productSearch.trim().toLocaleLowerCase("tr");
    for (const p of prods.data ?? []) {
      if (!p.isAvailable) continue;
      const cat = categoryById.get(p.categoryId);
      if (!cat || !cat.isActive) continue;
      if (term && !p.name.toLocaleLowerCase("tr").includes(term)) continue;
      if (!groups.has(cat.id))
        groups.set(cat.id, { category: cat, products: [] });
      groups.get(cat.id)!.products.push(p);
    }
    return Array.from(groups.values()).sort(
      (a, b) => a.category.displayOrder - b.category.displayOrder
    );
  }, [prods.data, categoryById, productSearch]);

  const openCreate = () => {
    setEditing(null);
    const nextOrder =
      (combos.data ?? []).reduce((m, c) => Math.max(m, c.displayOrder), -1) + 1;
    setDraft({ ...EMPTY_DRAFT, displayOrder: nextOrder });
    setFormError(null);
    setProductSearch("");
    setOpen(true);
  };

  const openEdit = (c: ComboDto) => {
    setEditing(c);
    setDraft({
      name: c.name,
      description: c.description ?? "",
      price: c.price,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      items: c.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        displayOrder: i.displayOrder,
      })),
    });
    setFormError(null);
    setProductSearch("");
    setOpen(true);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    setEditing(null);
  };

  const addProduct = (productId: string) => {
    setDraft((d) => {
      const existing = d.items.find((i) => i.productId === productId);
      if (existing) {
        return {
          ...d,
          items: d.items.map((i) =>
            i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      const nextOrder =
        d.items.reduce((m, i) => Math.max(m, i.displayOrder), -1) + 1;
      return {
        ...d,
        items: [
          ...d.items,
          { productId, quantity: 1, displayOrder: nextOrder },
        ],
      };
    });
  };

  const updateItemQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeItem(productId);
      return;
    }
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.productId === productId ? { ...i, quantity: qty } : i
      ),
    }));
  };

  const removeItem = (productId: string) => {
    setDraft((d) => ({
      ...d,
      items: d.items.filter((i) => i.productId !== productId),
    }));
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      setFormError("Kampanya adı zorunlu.");
      return;
    }
    if (draft.price < 0) {
      setFormError("Fiyat negatif olamaz.");
      return;
    }
    if (draft.items.length === 0) {
      setFormError("En az bir ürün eklemelisin.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const itemsPayload: CreateComboItemRequest[] = draft.items.map((i) => ({
        productId: i.productId,
        quantity: Math.max(1, i.quantity),
        displayOrder: i.displayOrder,
      }));
      if (editing) {
        const payload: UpdateComboRequest = {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          price: draft.price,
          isActive: draft.isActive,
          displayOrder: draft.displayOrder,
          items: itemsPayload,
        };
        await combosApi.update(editing.id, payload);
      } else {
        const payload: CreateComboRequest = {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          price: draft.price,
          displayOrder: draft.displayOrder,
          items: itemsPayload,
        };
        await combosApi.create(payload);
      }
      await combos.refresh();
      close();
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: ComboDto) => {
    if (!confirm(`"${c.name}" kampanyasını silmek istiyor musun?`)) return;
    try {
      await combosApi.remove(c.id);
      await combos.refresh();
    } catch (err) {
      alert(describeError(err));
    }
  };

  const itemsSummary = (c: ComboDto) =>
    c.items
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((i) => `${i.quantity}x ${i.productName}`)
      .join(", ");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Kampanyalar</h2>
          <p className="text-sm text-muted-foreground">
            Sabit fiyatlı paket menüler — yönetici ürünleri doğrudan seçer,
            kasiyer tek tıkla sepete ekler.
          </p>
        </div>
        <Button size="lg" onClick={openCreate}>
          <Plus /> Yeni Kampanya
        </Button>
      </header>

      {(combos.error || cats.error || prods.error) && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {combos.error || cats.error || prods.error}
        </p>
      )}

      {combos.loading ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Yükleniyor…
        </p>
      ) : (combos.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">Henüz kampanya yok.</p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus /> İlk kampanyayı oluştur
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(combos.data ?? [])
            .slice()
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((c) => (
              <article
                key={c.id}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-colors",
                  !c.isActive && "opacity-70"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold">{c.name}</h3>
                    {c.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={c.isActive ? "default" : "secondary"}>
                    {c.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </div>

                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-primary">
                  {formatCurrency(c.price)}
                </p>

                <p className="mt-2 text-sm text-muted-foreground">
                  {c.items.length > 0 ? itemsSummary(c) : "Boş kampanya"}
                </p>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil /> Düzenle
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(c)}
                    aria-label="Sil"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </article>
            ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => (v ? null : close())}>
        <DialogContent
          className="max-h-[90vh] max-w-4xl overflow-hidden p-0 sm:max-w-4xl"
          onInteractOutside={(e) => busy && e.preventDefault()}
        >
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>
              {editing ? "Kampanyayı Düzenle" : "Yeni Kampanya"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid max-h-[calc(90vh-8rem)] gap-4 overflow-y-auto p-6 md:grid-cols-2">
            {/* Sol: kampanya bilgileri + seçilen ürünler */}
            <section className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="combo-name">Ad</Label>
                <Input
                  id="combo-name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="örn. Aile Menüsü"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="combo-desc">Açıklama (opsiyonel)</Label>
                <textarea
                  id="combo-desc"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  rows={2}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Müşteriye gösterilecek kısa açıklama"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="combo-price">Fiyat (₺)</Label>
                  <Input
                    id="combo-price"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    value={draft.price}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        price: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="combo-order">Sıra</Label>
                  <Input
                    id="combo-order"
                    type="number"
                    inputMode="numeric"
                    value={draft.displayOrder}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        displayOrder: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, isActive: e.target.checked }))
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">
                  Aktif (kasiyer ekranında görünür)
                </span>
              </label>

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Seçilen ürünler</h4>
                  <Badge variant="secondary">{draft.items.length}</Badge>
                </div>
                {draft.items.length === 0 ? (
                  <p className="rounded-md border border-dashed bg-background p-4 text-center text-xs text-muted-foreground">
                    Sağdaki listeden ürün ekle.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {draft.items
                      .slice()
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((it) => {
                        const p = productById.get(it.productId);
                        return (
                          <li
                            key={it.productId}
                            className="flex items-center gap-2 rounded-md bg-background p-2"
                          >
                            <span className="flex-1 truncate text-sm font-medium">
                              {p?.name ?? "(silinmiş ürün)"}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  updateItemQuantity(it.productId, it.quantity - 1)
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
                                aria-label="Azalt"
                              >
                                −
                              </button>
                              <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
                                {it.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateItemQuantity(it.productId, it.quantity + 1)
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
                                aria-label="Arttır"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(it.productId)}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Çıkar"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </section>

            {/* Sağ: ürün listesi */}
            <section className="space-y-3">
              <div>
                <Label className="mb-2 block">Menüden ürün ekle</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Ürün ara…"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {prods.loading ? (
                  <p className="text-sm text-muted-foreground">Yükleniyor…</p>
                ) : groupedProducts.length === 0 ? (
                  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Eşleşen ürün yok.
                  </p>
                ) : (
                  groupedProducts.map((g) => (
                    <div key={g.category.id}>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.category.name}
                      </p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {g.products
                          .slice()
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((p) => {
                            const inDraft = draft.items.find(
                              (i) => i.productId === p.id
                            );
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => addProduct(p.id)}
                                className={cn(
                                  "flex min-h-[44px] items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors",
                                  "hover:border-primary/60 hover:bg-accent/50",
                                  inDraft && "border-primary/60 bg-primary/5"
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{p.name}</p>
                                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                                    {formatCurrency(p.price)}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  {inDraft && (
                                    <Badge variant="default">{inDraft.quantity}x</Badge>
                                  )}
                                  <span
                                    aria-hidden
                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {formError && (
            <p className="border-t bg-destructive/10 px-6 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter className="border-t px-6 py-4">
            <Button variant="outline" onClick={close} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={submit} disabled={busy} size="lg">
              {busy ? "Kaydediliyor…" : editing ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
