import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";
import { useEffect } from "react";

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

  const link =
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground/80 transition hover:bg-primary-foreground/10 hover:text-primary-foreground";
  const active = "bg-primary-foreground/15 text-primary-foreground";

  return (
    <div dir="rtl" className="portal-theme min-h-screen bg-muted/30">
      <header className="bg-primary text-primary-foreground shadow-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-primary-foreground/15 p-1.5">
              <img
                src={logoAsset.url}
                alt="الرشودي للعقارات"
                className="h-full w-full object-contain"
              />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold">الرشودي للعقارات</p>
              <p className="text-[11px] text-primary-foreground/70">
                {isOwner ? "بوابة المالك" : "بوابة العميل"}
              </p>
            </div>
          </div>

          <nav className="flex flex-1 flex-wrap items-center justify-center gap-1">
            <Link
              to="/portal"
              activeOptions={{ exact: true }}
              className={link}
              activeProps={{ className: `${link} ${active}` }}
            >
              <Home className="h-4 w-4" /> الرئيسية
            </Link>
            <Link
              to="/portal/contracts"
              className={link}
              activeProps={{ className: `${link} ${active}` }}
            >
              <FileText className="h-4 w-4" /> العقود
            </Link>
            <Link
              to="/portal/invoices"
              className={link}
              activeProps={{ className: `${link} ${active}` }}
            >
              <Receipt className="h-4 w-4" /> الفواتير
            </Link>
            {isOwner ? (
              <>
                <Link
                  to="/portal/insights"
                  className={link}
                  activeProps={{ className: `${link} ${active}` }}
                >
                  <BarChart3 className="h-4 w-4" /> التحليلات
                </Link>
                <Link
                  to="/portal/finance"
                  className={link}
                  activeProps={{ className: `${link} ${active}` }}
                >
                  <Wallet className="h-4 w-4" /> ماليتي
                </Link>
                <Link
                  to="/portal/units"
                  className={link}
                  activeProps={{ className: `${link} ${active}` }}
                >
                  <Home className="h-4 w-4" /> وحداتي
                </Link>
                <Link
                  to="/portal/care"
                  className={link}
                  activeProps={{ className: `${link} ${active}` }}
                >
                  <Wrench className="h-4 w-4" /> الصيانة والاعتمادات
                </Link>
                <Link
                  to="/portal/documents"
                  className={link}
                  activeProps={{ className: `${link} ${active}` }}
                >
                  <FileSignature className="h-4 w-4" /> المستندات
                </Link>
                <Link
                  to="/portal/messages"
                  className={link}
                  activeProps={{ className: `${link} ${active}` }}
                >
                  <MessageSquare className="h-4 w-4" /> الرسائل
                </Link>
                <Link
                  to="/portal/settings"
                  className={link}
                  activeProps={{ className: `${link} ${active}` }}
                >
                  <Settings2 className="h-4 w-4" /> الإعدادات
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/portal/maintenance"
                  className={link}
                  activeProps={{ className: `${link} ${active}` }}
                >
                  <Wrench className="h-4 w-4" /> طلبات الصيانة
                </Link>
                <Link
                  to="/portal/services"
                  className={link}
                  activeProps={{ className: `${link} ${active}` }}
                >
                  <Handshake className="h-4 w-4" /> شركاؤنا وخدماتنا
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-full border border-primary-foreground/25 px-3 py-1.5 text-xs font-semibold">
              <User className="h-3.5 w-3.5" /> {name}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg border border-primary-foreground/25 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/10"
            >
              <LogOut className="h-3.5 w-3.5" /> خروج
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
