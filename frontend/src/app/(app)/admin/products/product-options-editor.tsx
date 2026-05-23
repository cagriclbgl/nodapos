"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useStoreContext } from "@/lib/store-context";
import { describeError } from "@/lib/use-store-api";
import { formatCurrency } from "@/lib/format";
import {
  CreateProductOptionRequest,
  ProductDto,
  ProductOptionDto,
} from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface Props {
  product: ProductDto;
  onClose: () => void;
  onChanged: () => void;
}

interface DraftRow {
  name: string;
  price: string; // input olarak string tutuluyor — boş bırakma + "0,5" virgül edge case'leri için
  /** Paket servis ek fiyatı. Boş bırakılırsa null gönderilir → gel-al fiyatına fallback. */
  deliveryPrice: string;
}

interface UpdateOptionPayload {
  groupName: string;
  name: string;
  additionalPrice: number;
  deliveryAdditionalPrice: number | null;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
}

/**
 * Ürün seçenek yöneticisi. İki ana akış:
 *
 *  1) **Hızlı Toplu Ekle** — pizza dükkanı temel iş akışı için iki preset:
 *     - "Boyut" (Küçük / Orta / Büyük + ek fiyatları, zorunlu radio)
 *     - "Ekstra Malzeme" (n satır, opsiyonel checkbox grubu)
 *     Tek butonla birden fazla seçenek ekler — backend POST /options'ı sırayla çağırır.
 *
 *  2) **Mevcut seçenekler** — grup grup listelenir; her satır inline edit
 *     edilebilir (ad, fiyat, aktif). PUT /options/{id} ile gönderir.
 *
 * Eski tek satırlık "Özel" formu da koruyoruz — Kenar/Sos gibi grupları için.
 */
export function ProductOptionsEditor({ product, onClose, onChanged }: Props) {
  const { storeId } = useStoreContext();

  const [options, setOptions] = useState<ProductOptionDto[]>(product.options);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const fresh = await api.get<ProductDto>(
        `/api/products/${product.id}`,
        storeId
      );
      setOptions(fresh.options);
      onChanged();
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${product.name} — Seçenekler`}
      widthClass="max-w-2xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Kapat
        </Button>
      }
    >
      <div className="space-y-6">
        {error && (
          <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        <ExistingOptionsList
          options={options}
          storeId={storeId ?? null}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          reload={reload}
        />

        <BulkAddPanel
          productId={product.id}
          storeId={storeId ?? null}
          existingOrder={nextDisplayOrder(options)}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onAdded={reload}
        />
      </div>
    </Modal>
  );
}

/* --------------------------- Mevcut Seçenekler --------------------------- */

function ExistingOptionsList({
  options,
  storeId,
  busy,
  setBusy,
  setError,
  reload,
}: {
  options: ProductOptionDto[];
  storeId: string | null;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  reload: () => Promise<void>;
}) {
  const grouped = options.reduce<Record<string, ProductOptionDto[]>>(
    (acc, o) => {
      (acc[o.groupName] ??= []).push(o);
      return acc;
    },
    {}
  );

  if (Object.keys(grouped).length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700">
        Henüz seçenek yok. Aşağıdan Boyut veya Ekstra preset'iyle hızlıca ekleyin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Mevcut Seçenekler
      </h3>
      {Object.entries(grouped).map(([group, opts]) => (
        <div key={group}>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {group}
            {opts.some((o) => o.isRequired) && (
              <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                zorunlu
              </span>
            )}
          </h4>
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {opts
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((o) => (
                <ExistingOptionRow
                  key={o.id}
                  option={o}
                  storeId={storeId}
                  busy={busy}
                  setBusy={setBusy}
                  setError={setError}
                  reload={reload}
                />
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ExistingOptionRow({
  option,
  storeId,
  busy,
  setBusy,
  setError,
  reload,
}: {
  option: ProductOptionDto;
  storeId: string | null;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: option.name,
    price: option.additionalPrice.toString(),
    deliveryPrice: option.deliveryAdditionalPrice?.toString() ?? "",
    isActive: option.isActive,
  });

  // Modal kapanıp tekrar açıldığında state taze gelmeli.
  useEffect(() => {
    if (!editing) {
      setDraft({
        name: option.name,
        price: option.additionalPrice.toString(),
        deliveryPrice: option.deliveryAdditionalPrice?.toString() ?? "",
        isActive: option.isActive,
      });
    }
  }, [option, editing]);

  const save = async () => {
    const price = parsePrice(draft.price);
    if (!draft.name.trim()) {
      setError("Seçenek adı boş olamaz.");
      return;
    }
    if (price === null) {
      setError("Geçerli bir ek fiyat gir.");
      return;
    }
    // Boş bırakılırsa null → backend gel-al fiyatına fallback yapar.
    // Dolu ama parse edilemiyorsa hata ver, sessizce null'a düşmesin.
    let deliveryPrice: number | null;
    if (draft.deliveryPrice.trim() === "") {
      deliveryPrice = null;
    } else {
      const parsed = parsePrice(draft.deliveryPrice);
      if (parsed === null) {
        setError("Geçerli bir paket servis ek fiyatı gir veya boş bırak.");
        return;
      }
      deliveryPrice = parsed;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: UpdateOptionPayload = {
        groupName: option.groupName,
        name: draft.name.trim(),
        additionalPrice: price,
        deliveryAdditionalPrice: deliveryPrice,
        isRequired: option.isRequired,
        isActive: draft.isActive,
        displayOrder: option.displayOrder,
      };
      await api.put(`/api/products/options/${option.id}`, payload, storeId);
      await reload();
      setEditing(false);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`"${option.name}" seçeneğini silmek istediğine emin misin?`))
      return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/products/options/${option.id}`, storeId);
      await reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <li className="flex flex-wrap items-end gap-2 px-3 py-2">
        <div className="flex-1 min-w-32">
          <Input
            label="Ad"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="w-28">
          <Input
            label="+Gel-Al (TL)"
            type="number"
            step="0.01"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
        </div>
        <div className="w-28">
          <Input
            label="+Paket (TL)"
            placeholder="—"
            type="number"
            step="0.01"
            value={draft.deliveryPrice}
            onChange={(e) => setDraft({ ...draft, deliveryPrice: e.target.value })}
          />
        </div>
        <label className="mb-1 flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            className="h-4 w-4"
          />
          Aktif
        </label>
        <Button size="sm" onClick={save} disabled={busy}>
          <Save className="h-4 w-4" /> Kaydet
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing(false)}
          disabled={busy}
        >
          <X className="h-4 w-4" />
        </Button>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <div>
        <p className="text-sm font-medium">
          {option.name}
          {!option.isActive && (
            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              pasif
            </span>
          )}
        </p>
        <p className="text-xs text-zinc-500">
          {option.additionalPrice > 0
            ? `+${formatCurrency(option.additionalPrice)} gel-al`
            : "Gel-al: ek ücret yok"}
          {option.deliveryAdditionalPrice != null && (
            <>
              {" · "}
              {option.deliveryAdditionalPrice > 0
                ? `+${formatCurrency(option.deliveryAdditionalPrice)} paket`
                : "Paket: ek ücret yok"}
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          disabled={busy}
        >
          <Pencil className="h-4 w-4" /> Düzenle
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

/* ----------------------------- Toplu Ekle ----------------------------- */

type BulkMode = "size" | "extra" | "custom";

function BulkAddPanel({
  productId,
  storeId,
  existingOrder,
  busy,
  setBusy,
  setError,
  onAdded,
}: {
  productId: string;
  storeId: string | null;
  existingOrder: number;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  onAdded: () => Promise<void>;
}) {
  const [mode, setMode] = useState<BulkMode>("size");

  // Boyut preset'i için 3 satır pre-filled.
  const [sizeRows, setSizeRows] = useState<DraftRow[]>([
    { name: "Küçük", price: "0", deliveryPrice: "" },
    { name: "Orta", price: "20", deliveryPrice: "" },
    { name: "Büyük", price: "40", deliveryPrice: "" },
  ]);
  const [sizeGroupName, setSizeGroupName] = useState("Boyut");

  // Ekstra için 1 boş satırla başla; "+ Satır" ile büyütülür.
  const [extraRows, setExtraRows] = useState<DraftRow[]>([
    { name: "", price: "10", deliveryPrice: "" },
  ]);
  const [extraGroupName, setExtraGroupName] = useState("Ekstra Malzeme");

  // Özel için tek satırlık eski form.
  const [customDraft, setCustomDraft] = useState<{
    groupName: string;
    name: string;
    price: string;
    deliveryPrice: string;
    isRequired: boolean;
  }>({
    groupName: "",
    name: "",
    price: "0",
    deliveryPrice: "",
    isRequired: false,
  });

  const submitBatch = async (
    groupName: string,
    rows: DraftRow[],
    isRequired: boolean
  ) => {
    const cleaned = rows
      .map((r, i) => ({ row: r, originalIndex: i }))
      .filter((r) => r.row.name.trim().length > 0);
    if (cleaned.length === 0) {
      setError("En az bir seçenek satırı doldur.");
      return;
    }
    if (!groupName.trim()) {
      setError("Grup adı boş olamaz.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Backend tek tek çağrı — sıra kayıplarını önlemek için await ile sırayla.
      for (let i = 0; i < cleaned.length; i++) {
        const r = cleaned[i].row;
        const price = parsePrice(r.price);
        if (price === null) {
          setError(`"${r.name}" satırının gel-al fiyatı geçersiz.`);
          return;
        }
        let deliveryPrice: number | null;
        if (r.deliveryPrice.trim() === "") {
          deliveryPrice = null;
        } else {
          const parsed = parsePrice(r.deliveryPrice);
          if (parsed === null) {
            setError(
              `"${r.name}" satırının paket servis fiyatı geçersiz (boş bırak ya da geçerli sayı gir).`
            );
            return;
          }
          deliveryPrice = parsed;
        }
        const payload: CreateProductOptionRequest = {
          groupName: groupName.trim(),
          name: r.name.trim(),
          additionalPrice: price,
          deliveryAdditionalPrice: deliveryPrice,
          isRequired,
          displayOrder: existingOrder + i,
        };
        await api.post(`/api/products/${productId}/options`, payload, storeId);
      }
      await onAdded();
      // Başarılıysa formu sıfırla (group adını koru — ekleme zinciri için).
      if (mode === "size") {
        setSizeRows([
          { name: "", price: "0", deliveryPrice: "" },
          { name: "", price: "0", deliveryPrice: "" },
          { name: "", price: "0", deliveryPrice: "" },
        ]);
      } else if (mode === "extra") {
        setExtraRows([{ name: "", price: "0", deliveryPrice: "" }]);
      } else {
        setCustomDraft((d) => ({ ...d, name: "", price: "0", deliveryPrice: "" }));
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-orange-300 p-4 dark:border-orange-700">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Hızlı Toplu Ekle</h3>
        <div className="flex gap-1 text-xs">
          {(["size", "extra", "custom"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "rounded-lg bg-orange-600 px-2.5 py-1 font-semibold text-white"
                  : "rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }
            >
              {m === "size" ? "Boyut" : m === "extra" ? "Ekstra" : "Özel"}
            </button>
          ))}
        </div>
      </div>

      {mode === "size" && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Pizza/içecek gibi ürünlerde boyut seçimi. <strong>Zorunlu</strong>{" "}
            ve radio gibi davranır — kasiyer mutlaka bir tanesini seçer.
          </p>
          <Input
            label="Grup Adı"
            value={sizeGroupName}
            onChange={(e) => setSizeGroupName(e.target.value)}
          />
          <div className="space-y-2">
            {sizeRows.map((r, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label={i === 0 ? "Boyut Adı" : ""}
                    placeholder="Küçük / Orta / Büyük"
                    value={r.name}
                    onChange={(e) =>
                      setSizeRows((rs) =>
                        rs.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                  />
                </div>
                <div className="w-28">
                  <Input
                    label={i === 0 ? "+Gel-Al (TL)" : ""}
                    type="number"
                    step="0.01"
                    value={r.price}
                    onChange={(e) =>
                      setSizeRows((rs) =>
                        rs.map((x, j) =>
                          j === i ? { ...x, price: e.target.value } : x
                        )
                      )
                    }
                  />
                </div>
                <div className="w-28">
                  <Input
                    label={i === 0 ? "+Paket (TL)" : ""}
                    placeholder="—"
                    type="number"
                    step="0.01"
                    value={r.deliveryPrice}
                    onChange={(e) =>
                      setSizeRows((rs) =>
                        rs.map((x, j) =>
                          j === i ? { ...x, deliveryPrice: e.target.value } : x
                        )
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSizeRows((rs) => rs.filter((_, j) => j !== i))
                  }
                  disabled={busy || sizeRows.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setSizeRows((rs) => [
                  ...rs,
                  { name: "", price: "0", deliveryPrice: "" },
                ])
              }
              disabled={busy}
            >
              <Plus className="h-4 w-4" /> Satır ekle
            </Button>
            <Button
              onClick={() => void submitBatch(sizeGroupName, sizeRows, true)}
              disabled={busy}
            >
              {busy ? "Ekleniyor…" : `${sizeGroupName} Grubunu Ekle`}
            </Button>
          </div>
        </div>
      )}

      {mode === "extra" && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Ek malzemeler — kasiyer 0+ tanesini işaretleyebilir (zorunlu değil).
          </p>
          <Input
            label="Grup Adı"
            value={extraGroupName}
            onChange={(e) => setExtraGroupName(e.target.value)}
          />
          <div className="space-y-2">
            {extraRows.map((r, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label={i === 0 ? "Malzeme" : ""}
                    placeholder="Ekstra peynir / Sucuk / Mantar…"
                    value={r.name}
                    onChange={(e) =>
                      setExtraRows((rs) =>
                        rs.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                  />
                </div>
                <div className="w-28">
                  <Input
                    label={i === 0 ? "+Gel-Al (TL)" : ""}
                    type="number"
                    step="0.01"
                    value={r.price}
                    onChange={(e) =>
                      setExtraRows((rs) =>
                        rs.map((x, j) =>
                          j === i ? { ...x, price: e.target.value } : x
                        )
                      )
                    }
                  />
                </div>
                <div className="w-28">
                  <Input
                    label={i === 0 ? "+Paket (TL)" : ""}
                    placeholder="—"
                    type="number"
                    step="0.01"
                    value={r.deliveryPrice}
                    onChange={(e) =>
                      setExtraRows((rs) =>
                        rs.map((x, j) =>
                          j === i ? { ...x, deliveryPrice: e.target.value } : x
                        )
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setExtraRows((rs) => rs.filter((_, j) => j !== i))
                  }
                  disabled={busy || extraRows.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setExtraRows((rs) => [
                  ...rs,
                  { name: "", price: "0", deliveryPrice: "" },
                ])
              }
              disabled={busy}
            >
              <Plus className="h-4 w-4" /> Satır ekle
            </Button>
            <Button
              onClick={() => void submitBatch(extraGroupName, extraRows, false)}
              disabled={busy}
            >
              {busy ? "Ekleniyor…" : `${extraGroupName} Grubunu Ekle`}
            </Button>
          </div>
        </div>
      )}

      {mode === "custom" && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Tek seçenek ekleme (Kenar tipi, sos vb. için). Grup adını her seferinde belirt.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Grup"
              placeholder="Kenar / Sos / …"
              value={customDraft.groupName}
              onChange={(e) =>
                setCustomDraft({ ...customDraft, groupName: e.target.value })
              }
            />
            <Input
              label="Seçenek Adı"
              placeholder="Sotis kenar / Sarımsaklı sos…"
              value={customDraft.name}
              onChange={(e) =>
                setCustomDraft({ ...customDraft, name: e.target.value })
              }
            />
            <Input
              label="+Gel-Al Fiyat (TL)"
              type="number"
              step="0.01"
              value={customDraft.price}
              onChange={(e) =>
                setCustomDraft({ ...customDraft, price: e.target.value })
              }
            />
            <Input
              label="+Paket Fiyat (TL)"
              placeholder="—"
              type="number"
              step="0.01"
              value={customDraft.deliveryPrice}
              onChange={(e) =>
                setCustomDraft({ ...customDraft, deliveryPrice: e.target.value })
              }
            />
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={customDraft.isRequired}
                onChange={(e) =>
                  setCustomDraft({ ...customDraft, isRequired: e.target.checked })
                }
                className="h-4 w-4"
              />
              Zorunlu seçim
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() =>
                void submitBatch(
                  customDraft.groupName,
                  [
                    {
                      name: customDraft.name,
                      price: customDraft.price,
                      deliveryPrice: customDraft.deliveryPrice,
                    },
                  ],
                  customDraft.isRequired
                )
              }
              disabled={busy}
            >
              {busy ? "Ekleniyor…" : "Seçenek Ekle"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- utils --------------------------------- */

function nextDisplayOrder(opts: ProductOptionDto[]): number {
  return opts.reduce((m, o) => Math.max(m, o.displayOrder), -1) + 1;
}

/**
 * "12,50" → 12.5  ·  "" → null  ·  "-3" → null (negatif red)  ·  "abc" → null
 */
function parsePrice(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  // 2 ondalık'a yuvarla — backend numeric(18,2) zaten kabul ediyor ama UI tutarlılığı için.
  return Math.round(n * 100) / 100;
}
