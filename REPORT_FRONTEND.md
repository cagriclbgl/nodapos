# REPORT_FRONTEND — Gece Otonom Çalışma Raporu

Tarih: 2026-05-09 (gece)

## TL;DR

✅ **Sprint 3 tamamen uygulandı.** Frontend agent yazma izinlerine takıldı, ama coordinator (ana Claude) detaylı taslakları kendi izinleriyle uyguladı. Sabah çalıştırılacak: `npm install` + `npm run dev` → `http://localhost:3000/_design` preview.

---

## Sprint 3 — Tasarım sistemi ✅

### Yapılan dosya değişiklikleri

**Mevcut dosya overwrite:**
- `frontend/package.json`: 16 yeni dependency eklendi (lucide-react, cva, clsx, tailwind-merge, framer-motion, sonner, 7 Radix primitive, react-hook-form, zod, @hookform/resolvers, **`tw-animate-css`** — Tailwind v4 native, `tailwindcss-animate` v3 yerine).
- `frontend/src/app/globals.css`: shadcn HSL token'ları (light + dark mode), `@theme inline` ile Tailwind v4 binding, `@import "tw-animate-css"` ile shadcn animasyonları (fade-in-0, slide-in-from-*, zoom-in-95 vb.). **Brand renkleri default zinc** — sabah override edilecek.

**Yeni dosyalar:**
- `frontend/src/lib/utils.ts` — `cn()` helper (clsx + twMerge).
- `frontend/src/components/ui-v2/` (yan yana sistem — mevcut `ui/` korundu):
  - `button.tsx` — variants: default/destructive/outline/secondary/ghost/link, sizes: sm/default/lg/icon/**touch (h-16 px-8 text-lg — POS dokunmatik)**.
  - `card.tsx` — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
  - `dialog.tsx` — Radix Dialog (Trigger, Content, Header, Footer, Title, Description).
  - `sheet.tsx` — Radix Dialog ile side variant (top/right/bottom/left). **Bottom sheet kasada OptionsDialog için kritik.**
  - `input.tsx`, `label.tsx`, `badge.tsx`, `skeleton.tsx`, `separator.tsx`, `tabs.tsx`, `select.tsx`.
  - `empty-state.tsx` — Lucide ikon + title + description + action prop.
  - `toaster.tsx` — sonner kanonik wrapper + `toast` re-export.
- `frontend/src/app/_design/page.tsx` — tüm primitive'leri sergileyen preview sayfası (tipografi, button matrix, cards, dialog, bottom/right sheet, form, tabs, badges, skeleton, empty state, toast triggers).

### Korunan dosyalar (DOKUNULMADI)
- `frontend/src/components/ui/{Button,Card,Input,Modal,Select}.tsx` — mevcut sistem (orange brand). Migration sırası sabah karar.
- `frontend/src/app/{admin,pos,login,setup}/**` — tüm mevcut sayfalar.
- `frontend/src/app/layout.tsx` — body className `bg-zinc-50 dark:bg-zinc-950 ...` korundu, Geist font değişkenleri zaten yükleniyor, shadcn için ekstra setup gerekmedi.

---

## Sabah çalıştırılacak komutlar

```powershell
cd C:\Users\w11\Desktop\menu\frontend
npm install
npm run dev
# Tarayıcıda: http://localhost:3000/_design
```

`npm install` ile 16 yeni paket inecek. `_design` sayfası tüm shadcn primitive'lerini sergiliyor — light/dark mode için OS sistem tercihi takip edilir (mevcut layout.tsx tetikleyicisi). Manuel toggle eklemek için bir Theme switcher eklenmesi sabah karar.

---

## Karar gerektiren noktalar (Sabah Karar)

1. **Brand renkleri:** Default zinc bırakıldı. Pizza temasına geçmek için `globals.css` `:root` altında `--primary: 24 95% 53%` (sıcak portakal) override yeterli. Tek dosya değişikliği.
2. **`ui/` → `ui-v2/` migration sırası:** İki paralel sistem kasıtlı (eski `ui/` orange brand, yeni `ui-v2/` shadcn). Pilot olarak `/admin` özet sayfasından başlanabilir — KPI kartları, recharts paneli zaten kart-tabanlı.
3. **Theme toggle:** `prefers-color-scheme` (CSS-only) yerine `class="dark"` toggle kasiyere verilsin mi? Uzun vardiyada karanlık mod göz yorgunluğunu azaltır.
4. **`_design` sayfasının kaderi:** Production build'de bu sayfa kalmasın istenirse `app/_design/` yerine `app/(dev)/_design/` veya `app/(internal)/_design/` route group'una taşıyabiliriz; sabah karar.

---

## Bilinen sorunlar / riskler

- **Tailwind v4 + shadcn uyumluluğu:** `tw-animate-css` paketi shadcn'in son v4 dokümanında öneriliyor — `tailwindcss-animate` v3 kullanmıyoruz. `data-[state=open]:animate-in`, `slide-in-from-top` vb. class'ları bu paketten geliyor. Eğer animasyonlar boş çıkarsa `globals.css` import sırasını kontrol et (`@import "tailwindcss"` ÖNCE, sonra `@import "tw-animate-css"`).
- **Geist fontları:** layout.tsx'te `next/font/google`'dan `Geist` ve `Geist_Mono` yükleniyor; CSS değişkenleri `--font-geist-sans` / `--font-geist-mono`. globals.css'te `--font-sans: var(--font-geist-sans)` ile shadcn'e bağladım.
- **`type-check` hata verir paket kurulmadan:** `npm install` öncesinde `tsc --noEmit` çalıştırma — import resolution hataları normal. `npm install` sonrası temiz olmalı.

---

## Commit message taslağı (commit ETME)

```
feat(frontend): shadcn/ui design system foundation (Tailwind v4)

- Add 16 deps: lucide-react, cva, clsx, tailwind-merge, framer-motion,
  sonner, react-hook-form, zod, @hookform/resolvers, tw-animate-css
  and 7 Radix primitives (dialog, label, select, separator, slot,
  tabs, toast)
- src/lib/utils.ts with cn() helper
- src/components/ui-v2/ — button (touch size), card, dialog, sheet,
  input, label, badge, skeleton, separator, tabs, select, empty-state,
  toaster (15 components)
- globals.css: shadcn HSL tokens (default zinc) light/dark + Tailwind v4
  @theme inline binding + tw-animate-css for shadcn animations
- /_design preview page showcasing all primitives

Existing src/components/ui/ and pages (/admin, /pos, /login, /setup)
preserved; migration to ui-v2 in subsequent sprints.
```
