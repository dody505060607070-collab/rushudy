import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCheck, CircleAlert, Clock3, FileClock } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip } from "@/components/kit/Chip";
import { EmptyState, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { CardsSkeleton } from "@/components/kit/Skeletons";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { notificationLink } from "@/lib/notification-link";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [
    { title: "مركز التنبيهات | الرشودي للعقارات" }, { name: "description", content: "تنبيهات العقود والدفعات والمهام وإشعارات الحساب." },
    { property: "og:title", content: "مركز التنبيهات | الرشودي للعقارات" }, { property: "og:description", content: "متابعة كل الاستحقاقات والتنبيهات في مكان واحد." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: NotificationsPage,
});

type Alert = { id: string; category: "notification" | "contract" | "payment" | "task"; title: string; body: string; date: string; link: string; unread?: boolean };

function NotificationsPage() {
  const { userId } = useCurrentUser(); const qc = useQueryClient(); const [tab, setTab] = useState("all");
  const query = useQuery({ queryKey: ["notifications-center", userId], enabled: Boolean(userId), queryFn: async () => {
    const today = new Date(); const in60 = new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10); const todayText = today.toISOString().slice(0, 10);
    const [notifications, contracts, payments, tasks] = await Promise.all([
      supabase.from("notifications").select("id,title,body,link,is_read,created_at").eq("user_id", userId!).order("created_at", { ascending: false }).limit(100),
      supabase.from("contracts").select("id,contract_number,end_date").eq("status", "active").gte("end_date", todayText).lte("end_date", in60).order("end_date"),
      supabase.from("contract_payments").select("id,due_date,amount_due,amount_paid,contract:contract_id(id,contract_number)").neq("status", "paid").lt("due_date", todayText).order("due_date"),
      supabase.from("tasks").select("id,title,due_date,status").not("status", "in", '(approved,cancelled)').lt("due_date", todayText).order("due_date"),
    ]);
    for (const result of [notifications, contracts, payments, tasks]) if (result.error) throw result.error;
    const alerts: Alert[] = [
      ...(notifications.data ?? []).map((n) => ({ id: `n-${n.id}`, category: "notification" as const, title: n.title, body: n.body ?? "", date: n.created_at, link: notificationLink(n), unread: !n.is_read })),
      ...(contracts.data ?? []).map((c) => ({ id: `c-${c.id}`, category: "contract" as const, title: `العقد ${c.contract_number} يقترب من الانتهاء`, body: `ينتهي في ${c.end_date}`, date: c.end_date ?? todayText, link: `/contracts/${c.id}` })),
      ...(payments.data ?? []).map((p) => ({ id: `p-${p.id}`, category: "payment" as const, title: `دفعة متأخرة — ${p.contract?.contract_number ?? "عقد"}`, body: `المتبقي ${formatCurrency(Number(p.amount_due) - Number(p.amount_paid))}`, date: p.due_date, link: p.contract?.id ? `/contracts/${p.contract.id}` : "/contracts" })),
      ...(tasks.data ?? []).map((t) => ({ id: `t-${t.id}`, category: "task" as const, title: t.title, body: `تأخرت منذ ${t.due_date}`, date: t.due_date ?? todayText, link: `/task-form?id=${t.id}` })),
    ]; return alerts.sort((a, b) => b.date.localeCompare(a.date));
  }});
  const markAll = useMutation({ mutationFn: async () => { const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId!).eq("is_read", false); if (error) throw error; }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["notifications-center"] }); void qc.invalidateQueries({ queryKey: ["my-notifications"] }); } });
  const counts = useMemo(() => ({ all: query.data?.length ?? 0, notification: query.data?.filter((a) => a.category === "notification").length ?? 0, contract: query.data?.filter((a) => a.category === "contract").length ?? 0, payment: query.data?.filter((a) => a.category === "payment").length ?? 0, task: query.data?.filter((a) => a.category === "task").length ?? 0 }), [query.data]);
  const filtered = tab === "all" ? query.data ?? [] : (query.data ?? []).filter((a) => a.category === tab);
  const icons = { notification: Bell, contract: FileClock, payment: CircleAlert, task: Clock3 };
  return <><PageHero title="مركز التنبيهات" subtitle="العقود القريبة من الانتهاء والدفعات والمهام المتأخرة وإشعارات الحساب." icon={Bell} stats={[{ value: String(counts.payment), label: "دفعات متأخرة" }, { value: String(counts.contract), label: "عقود تنتهي قريبًا" }, { value: String(counts.task), label: "مهام متأخرة" }]} />
    <div className="flex justify-end"><Button variant="outline" onClick={() => markAll.mutate()}><CheckCheck />تعليم الإشعارات كمقروءة</Button></div>
    <Pills variant="card" defaultKey="all" onChange={setTab} items={[{ key: "all", label: "الكل", count: counts.all }, { key: "payment", label: "الدفعات", count: counts.payment }, { key: "contract", label: "العقود", count: counts.contract }, { key: "task", label: "المهام", count: counts.task }, { key: "notification", label: "النظام", count: counts.notification }]} />
    {query.isLoading ? <CardsSkeleton count={5} className="lg:grid-cols-1" /> : filtered.length ? <div className="space-y-2">{filtered.map((alert) => { const Icon = icons[alert.category]; return <Link key={alert.id} to={alert.link} className={`surface-card flex items-center gap-4 p-4 transition hover:border-primary/30 ${alert.unread ? "border-primary/30 bg-primary/5" : ""}`}><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary"><Icon className="size-5" /></span><span className="min-w-0 flex-1"><strong className="block text-[13.5px]">{alert.title}</strong><span className="text-[12px] text-muted-foreground">{alert.body}</span></span><span className="shrink-0 text-[11.5px] text-muted-foreground">{formatDate(alert.date)}</span>{alert.unread ? <Chip tone="warning">جديد</Chip> : null}</Link>; })}</div> : <div className="surface-card"><EmptyState text="لا توجد تنبيهات في هذا القسم" /></div>}
  </>;
}