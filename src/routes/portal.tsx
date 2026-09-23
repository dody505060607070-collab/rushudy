import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  FileSignature,
  FileText,
  Home,
  LogOut,
  MessageSquare,
  Receipt,
  Settings2,
  User,
  Wallet,
  Wrench,
  Handshake,
  Building2,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import brandImage from "@/assets/portal-brand.jpg";

import logoAsset from "@/assets/rashudi-logo-white.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerWorkspace, recordOwnerLogin } from "@/lib/owner-portal.functions";

export const Route = createFileRoute("/portal")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "بوابة العملاء | الرشودي للعقارات" },
      {
        name: "description",
        content: "بوابة عملاء وملاك الرشودي للعقارات لمتابعة العقود والفواتير.",
      },
      { property: "og:title", content: "بوابة العملاء | الرشودي للعقارات" },
      { property: "og:description", content: "متابعة عقود وفواتير عملاء الرشودي للعقارات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: PortalLayout,
});

function PortalLayout() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const name = (user.user_metadata?.["full_name"] as string | undefined) ?? "العميل";
  const metaOwner = user.user_metadata?.["portal_role"] === "owner";

  const workspace = useQuery({
    queryKey: ["owner-workspace"],
    queryFn: () => getOwnerWorkspace(),
    retry: false,
    staleTime: 60_000,
  });
  const isOwner = metaOwner || !!workspace.data;

  useEffect(() => {
    if (!isOwner) return;
    void recordOwnerLogin({
      data: { userAgent: navigator.userAgent, path: window.location.pathname },
    }).catch(() => undefined);
  }, [isOwner]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  useEffect(() => setMenuOpen(false), [pathname]);

  type Item = { to: string; label: string; icon: typeof Home; exact?: boolean };
  const groups: { label: string; items: Item[] }[] = [
    {
      label: "الأساسي",
      items: [
        { to: "/portal", label: "الرئيسية", icon: Home, exact: true },
        { to: "/portal/contracts", label: "العقود", icon: FileText },
        { to: "/portal/invoices", label: "الفواتير", icon: Receipt },
      ],
    },
    ...(isOwner
      ? [
          {
            label: "أملاكي",
            items: [
              { to: "/portal/units", label: "وحداتي", icon: Building2 },
              { to: "/portal/finance", label: "ماليتي", icon: Wallet },
              { to: "/portal/insights", label: "التحليلات", icon: BarChart3 },
            ],
          },
          {
            label: "المتابعة",
            items: [
              { to: "/portal/care", label: "الصيانة والاعتمادات", icon: Wrench },
              { to: "/portal/documents", label: "المستندات", icon: FileSignature },
              { to: "/portal/messages", label: "الرسائل", icon: MessageSquare },
            ],
          },
        ]
      : []),
    {
      label: "خدمات",
      items: [
        { to: "/portal/services", label: "شركاؤنا وخدماتنا", icon: Handshake },
        ...(isOwner ? [{ to: "/portal/settings", label: "الإعدادات", icon: Settings2 }] : []),
      ],
    },
  ];

  const link =
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-primary-foreground/80 transition hover:bg-primary-foreground/10 hover:text-primary-foreground";
  const active = "bg-primary-foreground text-primary shadow-card hover:bg-primary-foreground hover:text-primary";

  const sidebar = (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15 p-1.5">
          <img src={logoAsset.url} alt="الرشودي للعقارات" className="h-full w-full object-contain" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15px] font-bold">الرشودي للعقارات</p>
          <p className="text-[12px] text-primary-foreground/70">
            {isOwner ? "بوابة المالك" : "بوابة العميل"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-primary-foreground/10 px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-foreground/20">
          <User className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-primary-foreground/70">أهلاً بك</p>
          <p className="truncate text-[13.5px] font-bold">{name}</p>
        </div>
      </div>

      <nav className="grid gap-4">
        {groups.map((group) => (
          <div key={group.label} className="grid gap-1">
            <p className="px-3 text-[11px] font-bold text-primary-foreground/55">{group.label}</p>
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: !!item.exact }}
                className={link}
                activeProps={{ className: `${link} ${active}` }}
              >
                <item.icon className="size-[18px] shrink-0" /> {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="relative mt-auto hidden overflow-hidden rounded-2xl lg:block">
        <img
          src={brandImage}
          alt=""
          loading="lazy"
          width={768}
          height={1024}
          className="h-40 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent" />
        <p className="absolute inset-x-3 bottom-3 text-[12.5px] font-semibold leading-relaxed">
          أملاكك بين أيدٍ أمينة — نتابع كل تفاصيلها عنك.
        </p>
      </div>

      <button
        onClick={signOut}
        className="flex items-center justify-center gap-2 rounded-xl border border-primary-foreground/25 px-3 py-2.5 text-[13px] font-semibold hover:bg-primary-foreground/10"
      >
        <LogOut className="size-4" /> تسجيل الخروج
      </button>
    </div>
  );

  return (
    <div dir="rtl" className="portal-theme min-h-screen bg-muted/30 lg:flex">
      {/* الجوال: شريط علوي بسيط وزر القائمة */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-card lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <img src={logoAsset.url} alt="الرشودي للعقارات" className="h-9 w-9 shrink-0 object-contain" />
          <p className="truncate text-[14px] font-bold">{isOwner ? "بوابة المالك" : "بوابة العميل"}</p>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="فتح القائمة"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-foreground/15"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="إغلاق القائمة"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-foreground/40"
          />
          <aside className="absolute inset-y-0 start-0 w-[82%] max-w-xs bg-primary text-primary-foreground shadow-float">
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="إغلاق"
              className="absolute end-3 top-3 grid size-9 place-items-center rounded-lg bg-primary-foreground/15"
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      {/* الكمبيوتر: قائمة جانبية ثابتة */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 bg-primary text-primary-foreground shadow-card lg:block">
        {sidebar}
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
