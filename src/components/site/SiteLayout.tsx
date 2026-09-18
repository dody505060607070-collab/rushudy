import { Link, useRouterState } from "@tanstack/react-router";
import { Clock, Heart, Mail, MapPin, Menu, Phone, X } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import footerImage from "@/assets/bg-footer.jpg";
import logoWhiteAsset from "@/assets/rashudi-logo-navbar.png.asset.json";
import { FloatingActions, ScrollProgress } from "@/components/site/Chrome";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useAuth";
import { COMPANY_EMAIL, COMPANY_PHONE, publicSettingsQuery } from "@/lib/site-data";
import { ThemeToggle } from "@/lib/theme";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "الرئيسية" },
  { to: "/rent", label: "قسم الإيجار" },
  { to: "/sale", label: "قسم البيع" },
  { to: "/about", label: "من نحن" },
  { to: "/contact", label: "تواصل معنا" },
] as const;

const AiWidget = lazy(() =>
  import("@/components/site/AiWidget").then((module) => ({ default: module.AiWidget })),
);

function DeferredAiWidget() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 1_500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <AiWidget />
    </Suspense>
  );
}

function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-primary-foreground/10 bg-primary text-primary-foreground shadow-md">
      <div className="relative mx-auto grid h-[86px] max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 lg:flex lg:h-[74px] lg:justify-between lg:px-4">
        {/* يمين الشريط: روابط الصفحات */}
        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative py-1 text-[14px] transition-opacity hover:opacity-100",
                pathname === item.to
                  ? "font-bold opacity-100 after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-gold"
                  : "opacity-80",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* منتصف الشريط: الشعار الأبيض */}
        <Link
          to="/"
          aria-label="الرشودي للعقارات"
          className="flex min-w-0 items-center justify-start lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:border-x lg:border-primary-foreground/20 lg:px-5"
        >
          <img
            src={logoWhiteAsset.url}
            alt="الرشودي للعقارات"
            width={360}
            height={112}
            className="h-[54px] w-auto max-w-[245px] object-contain object-right transition-transform duration-300 hover:scale-105 sm:h-[60px] lg:h-14"
          />
        </Link>

        {/* يسار الشريط: زر اعرض/اطلب + أدوات */}
        <div className="flex shrink-0 items-center gap-2 lg:order-none">
          <Link
            to="/list-property"
            className="hidden shrink-0 whitespace-nowrap rounded-full border border-primary-foreground/40 px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-primary-foreground/10 lg:inline-flex"
          >
            اعرض | اطلب عقارك
          </Link>
          <ThemeToggle className="hidden border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 sm:inline-flex" />
          <Link
            to="/favorites"
            aria-label="المفضلة"
            className="hidden size-9 place-items-center rounded-full border border-primary-foreground/30 transition-colors hover:bg-primary-foreground/10 sm:grid"
          >
            <Heart className="size-4.5" />
          </Link>
          <Link
            to={session ? "/dashboard" : "/auth"}
            className="hidden shrink-0 whitespace-nowrap rounded-full bg-gold px-4 py-2 text-[13px] font-bold text-gold-foreground transition-opacity hover:opacity-90 md:inline-flex"
          >
            {session ? "لوحة التحكم" : "تسجيل الدخول"}
          </Link>
          <Button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="القائمة"
            aria-expanded={open}
            variant="outline"
            size="icon"
            className="size-12 rounded-xl border-primary-foreground/35 bg-primary-foreground/5 text-primary-foreground shadow-none hover:bg-primary-foreground/10 hover:text-primary-foreground lg:hidden"
          >
            {open ? <X className="size-7" /> : <Menu className="size-7" />}
          </Button>
        </div>
      </div>

      {open ? (
        <nav className="absolute inset-x-0 top-[86px] z-50 border-t border-primary-foreground/15 bg-primary shadow-float lg:hidden">
          <ul className="mx-auto grid max-w-6xl gap-1 px-5 py-5">
            {navLinks.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-lg px-4 py-3 text-right text-[15px] transition-colors hover:bg-primary-foreground/10",
                    pathname === item.to && "bg-primary-foreground/10 font-bold",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/list-property"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-4 py-3 text-right text-[15px] hover:bg-primary-foreground/10"
              >
                اعرض | اطلب عقارك
              </Link>
            </li>
            <li>
              <Link
                to={session ? "/dashboard" : "/auth"}
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-lg bg-gold px-4 py-3 text-center text-[15px] font-bold text-gold-foreground transition-opacity hover:opacity-90"
              >
                {session ? "لوحة التحكم" : "تسجيل الدخول"}
              </Link>
            </li>
            <li className="mt-2 border-t border-primary-foreground/15 pt-3">
              <ThemeToggle showLabel className="w-full justify-center border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20" />
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

function SiteFooter() {
  const settings = useQuery(publicSettingsQuery);
  const phone = settings.data?.whatsapp_number ?? COMPANY_PHONE;
  return (
    <footer className="relative isolate overflow-hidden text-white">
      <img
        src={footerImage}
        alt=""
        aria-hidden
        width={1920}
        height={1080}
        loading="lazy"
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-primary/80" />

      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-[14px] leading-7 text-white/85">
          الرشودي للعقارات — إيجار وبيع وإدارة أملاك في بريدة، القصيم.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13.5px] text-white/90">
          <a href={`tel:${phone}`} dir="ltr" className="flex items-center gap-2 hover:text-gold">
            <Phone className="size-4 text-gold" />
            {phone}
          </a>
          <a href={`mailto:${COMPANY_EMAIL}`} dir="ltr" className="flex items-center gap-2 hover:text-gold">
            <Mail className="size-4 text-gold" />
            {COMPANY_EMAIL}
          </a>
          <span className="flex items-center gap-2">
            <MapPin className="size-4 text-gold" />
            بريدة — القصيم
          </span>
          <span className="flex items-center gap-2">
            <Clock className="size-4 text-gold" />
            السبت — الخميس 9ص — 10م
          </span>
        </div>

        <nav className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-white/80">
          {[
            ...navLinks.slice(1),
            { to: "/list-property", label: "اعرض | اطلب عقارك" },
            { to: "/favorites", label: "المفضلة" },
            { to: "/privacy", label: "سياسة الخصوصية" },
            { to: "/terms", label: "الشروط والأحكام" },
          ].map(
            (item) => (
              <Link key={item.to} to={item.to} className="hover:text-gold">
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <p className="mt-8 text-[12px] text-white/60">
          جميع الحقوق محفوظة © {new Date().getFullYear()} — مؤسسة الرشودي للعقارات
        </p>
      </div>
    </footer>
  );
}


function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("cookie-consent") !== "accepted") setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 py-4 shadow-float">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center sm:flex-row sm:text-start">
        <p className="flex-1 text-[13px] leading-6 text-muted-foreground">
          نستخدم ملفات تعريف الارتباط (Cookies) لتحسين تجربتك وتذكّر تفضيلاتك أثناء تصفح العقارات.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground"
          >
            لاحقاً
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground"
          >
            موافق
          </button>
        </div>
      </div>
    </div>
  );
}


export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollProgress />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <FloatingActions />
      <DeferredAiWidget />
      <CookieBanner />
    </div>
  );
}
