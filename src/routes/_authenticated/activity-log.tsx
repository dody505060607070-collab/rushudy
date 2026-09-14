import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Clock3, History, Loader2, Monitor, ShieldAlert, UserRoundCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip } from "@/components/kit/Chip";
import { PageHero } from "@/components/kit/PageHero";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/activity-log")({
  head: () => ({ meta: [
    { title: "متابعة الموظفين | الرشودي للعقارات" },
    { name: "description", content: "متابعة جلسات الموظفين ومدة العمل والتغييرات والمهام المنجزة." },
    { property: "og:title", content: "متابعة الموظفين | الرشودي للعقارات" },
    { property: "og:description", content: "متابعة جلسات الموظفين ومدة العمل والتغييرات والمهام المنجزة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ActivityLogPage,
});

const actionLabels: Record<string, string> = { insert: "إضافة", update: "تعديل", delete: "حذف", approve: "اعتماد", contract_approved: "اعتماد عقد" };
const entityLabels: Record<string, string> = { properties: "عقار", buildings: "مبنى", units: "وحدة", contracts: "عقد", tasks: "مهمة", contacts: "جهة اتصال", invoices: "فاتورة", contract_payments: "دفعة" };
const duration = (seconds: number) => `${Math.floor(seconds / 3600)} س ${Math.floor((seconds % 3600) / 60)} د`;
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" }) : "—";

function ActivityLogPage() {
  const { isSuperAdmin, loading } = useCurrentUser();
  const [employee, setEmployee] = useState("all");
  const [range, setRange] = useState("7");
  const since = new Date(Date.now() - Number(range) * 86400000).toISOString();
  const query = useQuery({
    queryKey: ["employee-monitoring", range],
    enabled: isSuperAdmin,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [profiles, sessions, events, taskHistory] = await Promise.all([
        supabase.from("profiles").select("id, full_name, job_title, is_active").eq("org", "rashoudi").order("full_name"),
        supabase.from("employee_sessions").select("id, user_id, started_at, last_seen_at, ended_at, duration_seconds, current_path, device_label").gte("started_at", since).order("started_at", { ascending: false }).limit(500),
        supabase.from("activity_log").select("id, actor_id, action, entity_type, entity_id, details, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
        supabase.from("task_history").select("id, actor_id, action, task_id, created_at, task:task_id(title)").gte("created_at", since).order("created_at", { ascending: false }).limit(300),
      ]);
      for (const result of [profiles, sessions, events, taskHistory]) if (result.error) throw result.error;
      return { profiles: profiles.data ?? [], sessions: sessions.data ?? [], events: events.data ?? [], taskHistory: taskHistory.data ?? [] };
    },
  });
  const rows = query.data;
  const filteredSessions = (rows?.sessions ?? []).filter((row) => employee === "all" || row.user_id === employee);
  const filteredEvents = (rows?.events ?? []).filter((row) => employee === "all" || row.actor_id === employee);
  const filteredTasks = (rows?.taskHistory ?? []).filter((row) => employee === "all" || row.actor_id === employee);
  const summaries = useMemo(() => (rows?.profiles ?? []).map((profile) => {
    const ownSessions = (rows?.sessions ?? []).filter((session) => session.user_id === profile.id);
    const latest = ownSessions[0];
    const online = Boolean(latest && !latest.ended_at && Date.now() - new Date(latest.last_seen_at).getTime() < 130000);
    return { ...profile, latest, online, total: ownSessions.reduce((sum, session) => sum + session.duration_seconds, 0), events: (rows?.events ?? []).filter((event) => event.actor_id === profile.id).length };
  }), [rows]);

  if (loading) return <div className="surface-card grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  if (!isSuperAdmin) return <div className="surface-card grid place-items-center gap-3 py-24 text-center"><ShieldAlert className="size-10 text-destructive" /><h1 className="text-lg font-bold">هذه الصفحة للمدير العام فقط</h1><p className="text-sm text-muted-foreground">لا يمكن عرض سجل استخدام الموظفين بهذه الصلاحية.</p></div>;

  return <>
    <PageHero title="متابعة الموظفين" subtitle="وقت الدخول والخروج، مدة الاستخدام، الصفحات والتغييرات والمهام — للمدير العام فقط." icon={History} stats={[
      { label: "متصل الآن", value: String(summaries.filter((row) => row.online).length) },
      { label: "جلسات الفترة", value: String(filteredSessions.length) },
      { label: "عمليات مسجلة", value: String(filteredEvents.length + filteredTasks.length) },
    ]} />
    <div className="surface-card flex flex-wrap gap-3 p-4">
      <select className="h-10 rounded-lg border border-border bg-card px-3 text-sm" value={employee} onChange={(event) => setEmployee(event.target.value)}><option value="all">كل الموظفين</option>{summaries.map((row) => <option key={row.id} value={row.id}>{row.full_name}</option>)}</select>
      <select className="h-10 rounded-lg border border-border bg-card px-3 text-sm" value={range} onChange={(event) => setRange(event.target.value)}><option value="1">اليوم</option><option value="7">آخر 7 أيام</option><option value="30">آخر 30 يومًا</option><option value="90">آخر 90 يومًا</option></select>
    </div>
    {query.isLoading ? <div className="surface-card grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div> : <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{summaries.filter((row) => employee === "all" || row.id === employee).map((row) => <button type="button" key={row.id} onClick={() => setEmployee(row.id)} className="surface-card p-4 text-start transition-colors hover:border-primary/40">
        <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-full bg-accent font-bold text-primary">{row.full_name.slice(0, 1)}</span><Chip tone={row.online ? "success" : "neutral"}>{row.online ? "متصل الآن" : "غير متصل"}</Chip></div>
        <h2 className="mt-3 text-sm font-bold">{row.full_name}</h2><p className="text-xs text-muted-foreground">{row.job_title ?? "موظف"}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><span className="rounded-lg bg-muted p-2"><b className="block text-foreground">{duration(row.total)}</b>مدة الاستخدام</span><span className="rounded-lg bg-muted p-2"><b className="block text-foreground">{row.events}</b>عملية</span></div>
        <p className="mt-3 text-[11px] text-muted-foreground">آخر ظهور: {dateTime(row.latest?.last_seen_at ?? null)}</p>
      </button>)}</section>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="surface-card overflow-hidden"><header className="flex items-center gap-2 border-b border-border p-4 font-bold"><Clock3 className="size-4 text-primary" />جلسات الاستخدام</header><div className="max-h-[520px] overflow-auto divide-y divide-border">{filteredSessions.map((row) => { const profile = rows?.profiles.find((item) => item.id === row.user_id); return <div key={row.id} className="grid gap-2 p-4 text-xs sm:grid-cols-[1fr_1fr_auto]"><div><b className="block text-sm">{profile?.full_name ?? "—"}</b><span className="text-muted-foreground">{row.device_label ?? "جهاز غير محدد"}</span></div><div><span className="block">فتح: {dateTime(row.started_at)}</span><span className="text-muted-foreground">إغلاق: {row.ended_at ? dateTime(row.ended_at) : "الجلسة مفتوحة"}</span></div><div className="text-end"><Chip tone={row.ended_at ? "neutral" : "success"}>{duration(row.duration_seconds)}</Chip><span className="mt-1 block max-w-40 truncate text-muted-foreground" dir="ltr">{row.current_path ?? "—"}</span></div></div>})}{!filteredSessions.length ? <p className="p-8 text-center text-sm text-muted-foreground">لا توجد جلسات في هذه الفترة.</p> : null}</div></section>
        <section className="surface-card overflow-hidden"><header className="flex items-center gap-2 border-b border-border p-4 font-bold"><Activity className="size-4 text-primary" />ما الذي تم داخل النظام</header><div className="max-h-[520px] overflow-auto divide-y divide-border">{[...filteredEvents.map((row) => ({ id: row.id, actor_id: row.actor_id, at: row.created_at, title: `${actionLabels[row.action] ?? row.action} ${entityLabels[row.entity_type ?? ""] ?? row.entity_type ?? "سجل"}`, hint: row.entity_id ?? "" })), ...filteredTasks.map((row) => ({ id: `task-${row.id}`, actor_id: row.actor_id, at: row.created_at, title: `مهمة: ${row.action}`, hint: (row.task as { title?: string } | null)?.title ?? row.task_id }))].sort((a,b) => b.at.localeCompare(a.at)).map((row) => <div key={row.id} className="flex items-start gap-3 p-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary"><UserRoundCheck className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold">{row.title}</p><p className="truncate text-xs text-muted-foreground">{rows?.profiles.find((item) => item.id === row.actor_id)?.full_name ?? "النظام"} · {row.hint}</p></div><time className="shrink-0 text-[11px] text-muted-foreground">{dateTime(row.at)}</time></div>)}{!filteredEvents.length && !filteredTasks.length ? <p className="p-8 text-center text-sm text-muted-foreground">لا توجد عمليات مسجلة.</p> : null}</div></section>
      </div>
    </>}
  </>;
}