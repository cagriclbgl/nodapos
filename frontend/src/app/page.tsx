import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Cloud,
  CreditCard,
  PhoneIncoming,
  PieChart,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Truck,
  Users,
  Utensils,
  WifiOff,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui-v2/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <Features />
        <UseCases />
        <HowItWorks />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Header — sticky, blur'lu, mobilde menü yerine direkt CTA                */
/* ----------------------------------------------------------------------- */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icon.png"
            alt="NodaPos"
            width={36}
            height={36}
            priority
            className="rounded-lg"
          />
          <span className="text-lg font-bold tracking-tight">NodaPos</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#ozellikler"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Özellikler
          </a>
          <a
            href="#kimler-icin"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Kimler için
          </a>
          <a
            href="#nasil-calisir"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Nasıl çalışır
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900 sm:inline-block dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            Giriş Yap
          </Link>
          <Button asChild size="sm" className="shadow-sm">
            <Link href="/register">
              <span className="hidden sm:inline">Ücretsiz Dene</span>
              <span className="sm:hidden">Başla</span>
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------------- */
/*  Hero — büyük tipografi, blur orb arka plan, çift CTA                   */
/* ----------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Dekoratif arka plan */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-orange-300/40 blur-3xl dark:bg-orange-600/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-40 h-[32rem] w-[32rem] rounded-full bg-amber-300/40 blur-3xl dark:bg-amber-700/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.04)_1px,transparent_0)] [background-size:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)]"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-800 shadow-sm dark:border-orange-900/50 dark:bg-orange-950/50 dark:text-orange-200">
            <Sparkles className="h-3.5 w-3.5" />
            Türkiye&apos;nin yeni nesil işletme POS&apos;u
          </div>
          <h1 className="text-balance text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl md:text-6xl lg:text-7xl dark:text-zinc-50">
            İşletmeniz için{" "}
            <span className="bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">
              akıllı kasa
            </span>
            , basit yönetim
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-zinc-600 sm:text-lg md:text-xl dark:text-zinc-400">
            Restoran, kafe, pizzacı ve fast food için bulut tabanlı POS.
            Kasanız internet kesilse bile çalışır, tek panelden tüm şubelerinizi
            yönetirsiniz. Sipariş, masa, kurye, arayan numara — hepsi tek yerde.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full shadow-lg shadow-orange-500/20 sm:w-auto">
              <Link href="/register">
                Ücretsiz Başla
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Link href="/login">Giriş Yap</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-500">
            Kurulum ücreti yok · Hemen başla · İstediğinde iptal et
          </p>
        </div>

        {/* Mockup placeholder — küçük bir görsel kart */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-orange-900/10 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <div className="ml-3 flex-1 truncate text-xs text-zinc-500">
                nodapos.com/admin
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 md:p-8">
              <DashboardKpi
                icon={CreditCard}
                label="Bugünkü Ciro"
                value="₺18.420"
                trend="+%14"
              />
              <DashboardKpi
                icon={Utensils}
                label="Sipariş Sayısı"
                value="247"
                trend="+%8"
              />
              <DashboardKpi
                icon={Users}
                label="Aktif Masa"
                value="12 / 24"
                trend="%50 doluluk"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardKpi({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-sm text-zinc-600 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        {trend}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Trust strip — generic ama güven veren                                  */
/* ----------------------------------------------------------------------- */

function TrustStrip() {
  return (
    <section className="border-y border-zinc-200 bg-zinc-50/60 py-8 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-6 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
          Türkiye genelinde restoranların tercihi
        </p>
        <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
          <TrustItem value="%99.9" label="Çalışma süresi" />
          <TrustItem value="<1 sn" label="Sipariş ekleme" />
          <TrustItem value="7/24" label="Bulut yedekleme" />
          <TrustItem value="0 ₺" label="Kurulum ücreti" />
        </div>
      </div>
    </section>
  );
}

function TrustItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-orange-600 sm:text-3xl">
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
        {label}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Features — 6 kart, neden NodaPos                                       */
/* ----------------------------------------------------------------------- */

const FEATURES = [
  {
    icon: WifiOff,
    title: "İnternet kesintisinde bile çalışır",
    body: "Kasa lokal veritabanıyla offline çalışır, internet geri geldiğinde tüm satışlar otomatik buluta senkronize olur. Müşteri beklemez.",
  },
  {
    icon: Building2,
    title: "Tek panelden çoklu şube",
    body: "Şubelerinizdeki tüm satışları, stok ve menüyü tek bir admin panelinden yönetin. Şubeden şubeye fiyat farkı, kampanya, menü değişikliği saniyeler içinde yansır.",
  },
  {
    icon: PhoneIncoming,
    title: "Arayan numara tanıma",
    body: "Telefon çaldığında müşteri kim olduğunu, geçmiş siparişlerini ve adresini ekranda görün. Paket sipariş alma süresi yarıya iner.",
  },
  {
    icon: Cloud,
    title: "Bulut yedekleme",
    body: "Tüm verileriniz otomatik olarak güvenli bulut sunucularında yedeklenir. Cihaz çökse, çalınsa, kaybolsa — verileriniz güvende.",
  },
  {
    icon: Zap,
    title: "Hızlı sipariş akışı",
    body: "Masa, paket, kurye — üç farklı sipariş tipi için optimize edilmiş arayüz. Kasiyer tek ekrandan tüm operasyonu yönetir, eğitim süresi 15 dakika.",
  },
  {
    icon: BarChart3,
    title: "Detaylı raporlama",
    body: "Günlük ciro, en çok satan ürün, kasiyer performansı, masa doluluğu — kararlarınızı tahminlerle değil verilerle verin.",
  },
];

function Features() {
  return (
    <section id="ozellikler" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl md:text-5xl dark:text-zinc-50">
            İşinizi büyütmek için
            <br />
            <span className="text-orange-600">ihtiyacınız olan her şey</span>
          </h2>
          <p className="mt-4 text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
            Sade arayüz, güçlü altyapı. Kasiyer 10 dakikada öğrenir, işletme
            sahibi tek bakışta her şeyi görür.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-100/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-orange-900/50 dark:hover:shadow-orange-950/30">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 transition-transform group-hover:scale-110 dark:from-orange-950/60 dark:to-amber-950/60 dark:text-orange-300">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Use cases — kimler için                                                */
/* ----------------------------------------------------------------------- */

const USE_CASES = [
  {
    icon: Utensils,
    title: "Restoran & Lokanta",
    items: [
      "Masa yönetimi",
      "Bölüm bazlı menü",
      "Adisyon birleştirme/bölme",
    ],
  },
  {
    icon: Truck,
    title: "Pizzacı & Paket Servis",
    items: ["Kurye atama", "Arayan numara", "Mahalle bazlı teslimat"],
  },
  {
    icon: PieChart,
    title: "Kafe & Pastane",
    items: ["Hızlı kasa", "Ürün varyantları", "Yan ürün önerisi"],
  },
  {
    icon: Smartphone,
    title: "Fast Food",
    items: ["Sıralı sipariş", "Menü kombinasyonları", "Self-servis hazır"],
  },
  {
    icon: Building2,
    title: "Çoklu Şube",
    items: [
      "Merkezi menü",
      "Şube bazlı rapor",
      "Personel rolleri",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Franchise & Zincir",
    items: ["Marka standartı", "Konsolide ciro", "Bağımsız mali müşavir erişimi"],
  },
];

function UseCases() {
  return (
    <section
      id="kimler-icin"
      className="bg-gradient-to-br from-orange-50/50 via-amber-50/30 to-rose-50/30 py-20 sm:py-28 dark:from-orange-950/20 dark:via-amber-950/10 dark:to-rose-950/10"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl md:text-5xl dark:text-zinc-50">
            Hangi işletme tipi olursa olsun
          </h2>
          <p className="mt-4 text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
            NodaPos masa servisinden paket servise, tek şubeden franchise
            zincire kadar her ölçekte çalışır.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((uc) => (
            <UseCaseCard key={uc.title} {...uc} />
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCaseCard({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/60">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-white shadow-md shadow-orange-500/30">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  How it works — 3 adım                                                  */
/* ----------------------------------------------------------------------- */

const STEPS = [
  {
    num: "01",
    title: "Başvurunu yap",
    body: "Restoranının bilgilerini ver, ekibimiz 24 saat içinde geri döner. Hemen kurulumu başlatırız.",
  },
  {
    num: "02",
    title: "Kasanı kuralım",
    body: "Kasa yazılımını sana özel kurarız. Menünü beraber yükleriz, ekibini 15 dakikada eğitiriz. Sıfır teknik bilgi yeterli.",
  },
  {
    num: "03",
    title: "Satışa başla",
    body: "Aynı gün ilk siparişini al. Tüm verilerin otomatik buluta yedeklenir, herhangi bir cihazdan raporlarına ulaşırsın.",
  },
];

function HowItWorks() {
  return (
    <section id="nasil-calisir" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl md:text-5xl dark:text-zinc-50">
            3 adımda başlayın
          </h2>
          <p className="mt-4 text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
            Başvurudan ilk siparişe kadar 24-48 saat. Hepsi sana özel, hiçbir
            zaman yalnız kalmazsın.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.num} className="relative">
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="absolute left-12 right-0 top-7 hidden h-px bg-gradient-to-r from-orange-300 to-transparent md:block"
                />
              )}
              <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-lg font-bold text-white shadow-lg shadow-orange-500/30">
                {step.num}
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/*  Final CTA — büyük orange blok                                          */
/* ----------------------------------------------------------------------- */

function FinalCta() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 px-6 py-16 text-center shadow-2xl shadow-orange-500/30 sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] [background-size:24px_24px]"
          />
          <div className="relative">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Bugün başla, yarın fark et
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-base text-orange-50 sm:text-lg">
              Kurulum ücretsiz, sözleşme yok, ne kadar süre kullanacağına sen
              karar ver. Bugün başvur, yarın satışa başla.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="w-full bg-white text-orange-700 shadow-lg hover:bg-orange-50 sm:w-auto"
              >
                <Link href="/register">
                  Ücretsiz Başla
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto"
              >
                <Link href="/login">Zaten Hesabım Var</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/*  Footer                                                                  */
/* ----------------------------------------------------------------------- */

function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 py-12 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/icon.png"
                alt="NodaPos"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-base font-bold tracking-tight">
                NodaPos
              </span>
            </Link>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              İşletmeniz için akıllı POS sistemi.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Ürün
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="#ozellikler"
                  className="text-zinc-600 hover:text-orange-600 dark:text-zinc-400"
                >
                  Özellikler
                </a>
              </li>
              <li>
                <a
                  href="#kimler-icin"
                  className="text-zinc-600 hover:text-orange-600 dark:text-zinc-400"
                >
                  Kimler için
                </a>
              </li>
              <li>
                <a
                  href="#nasil-calisir"
                  className="text-zinc-600 hover:text-orange-600 dark:text-zinc-400"
                >
                  Nasıl çalışır
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Hesap
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/login"
                  className="text-zinc-600 hover:text-orange-600 dark:text-zinc-400"
                >
                  Giriş Yap
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="text-zinc-600 hover:text-orange-600 dark:text-zinc-400"
                >
                  Başvuru Yap
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              İletişim
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="text-zinc-600 dark:text-zinc-400">
                info@nodapos.com
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
          © {new Date().getFullYear()} NodaPos. Tüm hakları saklıdır.
        </div>
      </div>
    </footer>
  );
}
