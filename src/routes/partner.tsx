import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LogOut, Receipt, Rows3 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/rashudi-logo-white.png.asset.json";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/partner")({
  ssr: false,
  head: () => ({ meta: [
    { title: "بوابة شريك الخدمات | الرشودي للعقارات" },
    { name: "description", content: "بوابة شركات الخدمات لمتابعة طلبات عملاء الرشودي وإصدار الفواتير." },
    { property: "og:title", content: "بوابة شريك الخدمات | الرشودي للعقارات" },
    { property: "og:description", content: "متابعة طلبات العملاء وفواتير الخدمات." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  beforeLoad: async () => { const user = await supabase.auth.getUser(); if (!user.data.user) throw redirect({ to: "/auth" }); const account = await supabase.from("service_partner_accounts").select("partner_id").eq("user_id", user.data.user.id).maybeSingle(); if (!account.data) throw redirect({ to: "/auth" }); return { user: user.data.user }; },
  component: PartnerLayout,
});

function PartnerLayout() {
  const navigate = useNavigate();
  return <div dir="rtl" className="min-h-screen bg-muted/30"><header className="bg-primary text-primary-foreground"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3"><img src={logoAsset.url} alt="الرشودي للعقارات" className="h-12 w-12 object-contain" /><div className="me-auto"><p className="font-bold">بوابة شريك الخدمات</p><p className="text-xs text-primary-foreground/70">الطلبات والفواتير فقط</p></div><nav className="flex gap-2"><Link to="/partner" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-primary-foreground/10"><Rows3 className="size-4" /> الطلبات</Link><Link to="/partner" hash="invoices" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-primary-foreground/10"><Receipt className="size-4" /> الفواتير</Link></nav><Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}><LogOut className="size-4" /> خروج</Button></div></header><main className="mx-auto max-w-6xl px-4 py-8"><Outlet /></main></div>;
}
