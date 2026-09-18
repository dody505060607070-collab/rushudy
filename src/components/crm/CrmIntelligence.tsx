import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeDollarSign,
  BanknoteArrowDown,
  BanknoteArrowUp,
  BriefcaseBusiness,
  CalendarClock,
  ChartNoAxesCombined,
  CircleGauge,
  Clock3,
  Eye,
  FileCheck2,
  Gauge,
  Loader2,
  MessageCircleMore,
  MousePointerClick,
  Percent,
  ReceiptText,
  Target,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/components/kit/LiveTable";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { stageLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Range = "week" | "month" | "year";
type Dated = { created_at: string };
type Payment = { amount_due: number; amount_paid: number; due_date: string; status: string };
type Expense = { amount: number; spent_on: string };
type Opportunity = Dated & { stage: string; expected_value: number | null; close_probability: number; contact_id: string | null };
type Contact = Dated & { id: string; source: string | null; roles: string[] };
type PageView = { visitor_id: string; path: string; user_id: string | null; visited_at: string };
type Session = { user_id: string; duration_seconds: number; last_seen_at: string; ended_at: string | null };

const ranges: { key: Range; label: string; days: number }[] = [
  { key: "week", label: "أسبوعي", days: 7 },
  { key: "month", label: "شهري", days: 30 },
  { key: "year", label: "سنوي", days: 365 },
];
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const ratio = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);
const delta = (current: number, previous: number) => (previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0);
const within = (value: string, start: Date, end: Date) => {
  const date = new Date(value);
  return date >= start && date < end;
};

export function CrmIntelligence() {
  const [range, setRange] = useState<Range>("week");
  const days = ranges.find((item) => item.key === range)?.days ?? 7;
  const since = new Date(Date.now() - days * 2 * 86400000).toISOString();
  const query = useQuery({
    queryKey: ["crm-intelligence", range],
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const results = await Promise.all([
        supabase.from("site_page_views").select("visitor_id, path, user_id, visited_at").gte("visited_at", since).limit(10000),
        supabase.from("contacts").select("id, source, roles, created_at").gte("created_at", since),
        supabase.from("opportunities").select("stage, expected_value, close_probability, contact_id, created_at"),
        supabase.from("crm_activities").select("activity_type, happened_at, next_follow_up, created_at").gte("created_at", since),
        supabase.from("contract_payments").select("amount_due, amount_paid, due_date, status"),
        supabase.from("unit_expenses").select("amount, spent_on"),
        supabase.from("invoices").select("total, status, issue_date, created_at"),
        supabase.from("supply_requests").select("status, created_at, updated_at").gte("created_at", since),
        supabase.from("listing_requests").select("status, created_at, updated_at").gte("created_at", since),
        supabase.from("reservations").select("status, converted_at, created_at").gte("created_at", since),
        supabase.from("tasks").select("status, created_at, started_at, approved_at").gte("created_at", since),
        supabase.from("employee_sessions").select("user_id, duration_seconds, last_seen_at, ended_at").gte("started_at", since),
        supabase.from("activity_log").select("actor_id, created_at").gte("created_at", since),
        supabase.from("message_log").select("result, created_at").gte("created_at", since),
      ]);
      const failure = results.find((result) => result.error);
      if (failure?.error) throw failure.error;
      return {
        views: (results[0].data ?? []) as PageView[], contacts: (results[1].data ?? []) as Contact[], opportunities: (results[2].data ?? []) as Opportunity[],
        activities: (results[3].data ?? []) as { activity_type: string; happened_at: string; next_follow_up: string | null; created_at: string }[], payments: (results[4].data ?? []) as Payment[], expenses: (results[5].data ?? []) as Expense[],
        invoices: (results[6].data ?? []) as (Dated & { total: number; status: string; issue_date: string })[], supply: (results[7].data ?? []) as (Dated & { status: string; updated_at: string })[], listing: (results[8].data ?? []) as (Dated & { status: string; updated_at: string })[],
        reservations: (results[9].data ?? []) as (Dated & { status: string; converted_at: string | null })[], tasks: (results[10].data ?? []) as (Dated & { status: string; started_at: string | null; approved_at: string | null })[], sessions: (results[11].data ?? []) as Session[], events: (results[12].data ?? []) as (Dated & { actor_id: string | null })[], messages: (results[13].data ?? []) as (Dated & { result: string })[],
      };
    },
  });
  const metrics = useMemo(() => query.data ? calculate(query.data, days) : null, [query.data, days]);

  if (query.isLoading) return <div className="surface-card grid min-h-72 place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (!metrics) return <div className="surface-card p-8 text-center text-sm text-destructive">تعذّر تحميل مركز تحليلات CRM.</div>;

  return <section className="space-y-5">
    <header className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="grid gap-5 border-b border-border bg-primary px-6 py-7 text-primary-foreground lg:grid-cols-[1fr_auto] lg:items-end">
        <div><p className="text-xs font-bold opacity-80">مركز القيادة التجاري</p><h2 className="mt-2 text-2xl font-black">صورة كاملة للنشاط والمكاسب والخسائر</h2><p className="mt-2 max-w-3xl text-sm leading-7 opacity-80">قراءة مباشرة للعملاء والفرص وزيارات الموقع والموظفين والتحصيل والمصروفات، مع مقارنة آلية بالفترة السابقة.</p></div>
        <div className="flex rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 p-1">{ranges.map((item) => <Button key={item.key} size="sm" variant="ghost" onClick={() => setRange(item.key)} className={cn("text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground", range === item.key && "bg-primary-foreground text-primary")}>{item.label}</Button>)}</div>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        <HeroMetric icon={BanknoteArrowUp} label="المتحصل" value={formatCurrency(metrics.revenue)} change={metrics.revenueChange} good />
        <HeroMetric icon={BanknoteArrowDown} label="المصروفات" value={formatCurrency(metrics.expenses)} change={metrics.expenseChange} good={false} />
        <HeroMetric icon={BadgeDollarSign} label="صافي النتيجة" value={formatCurrency(metrics.net)} change={metrics.netChange} good />
        <HeroMetric icon={Percent} label="هامش الربح" value={`${metrics.margin}%`} change={metrics.margin - metrics.previousMargin} good />
      </div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {metrics.cards.map((card) => <MetricCard key={card.label} {...card} />)}
    </div>

    <div className="grid gap-4 xl:grid-cols-3">
      <Panel title="حركة المال" sub="المتحصل والمصروف وصافي النتيجة خلال الفترة" icon={ChartNoAxesCombined} className="xl:col-span-2"><MoneyTrend data={metrics.trend} /></Panel>
      <Panel title="الملخص التنفيذي" sub="قراءة سريعة لما يحتاج قرارك الآن" icon={CircleGauge}><ExecutiveSummary items={metrics.summary} /></Panel>
      <Panel title="مسار الفرص" sub="توزيع الفرص الحالية من البداية حتى الإغلاق" icon={Target}><SimpleBars data={metrics.pipeline} valueKey="value" /></Panel>
      <Panel title="مصادر العملاء" sub="القنوات التي جاءت منها جهات الاتصال" icon={Users}><SimpleBars data={metrics.sources} valueKey="value" /></Panel>
      <Panel title="أكثر صفحات الموقع زيارة" sub="زيارات حقيقية مسجلة بدون بيانات شخصية" icon={MousePointerClick}><RankList rows={metrics.topPages} /></Panel>
      <Panel title="أداء الفريق" sub="النشاط والوقت والإنجاز خلال الفترة" icon={UserRoundCheck}><RankList rows={metrics.teamRows} /></Panel>
      <Panel title="جودة المتابعة" sub="الأنشطة والمتابعات والرسائل والطلبات" icon={Activity}><QualityGrid rows={metrics.quality} /></Panel>
      <Panel title="الفواتير والتحصيل" sub="حالة المستحقات ونسبة السداد" icon={ReceiptText}><CollectionBlock due={metrics.due} paid={metrics.allPaid} overdue={metrics.overdue} /></Panel>
    </div>
  </section>;
}

function calculate(data: NonNullable<ReturnType<typeof useCrmData>>, days: number) {
  const now = new Date(), currentStart = new Date(now.getTime() - days * 86400000), previousStart = new Date(now.getTime() - days * 2 * 86400000);
  const current = (value: string) => within(value, currentStart, now), previous = (value: string) => within(value, previousStart, currentStart);
  const revenue = sum(data.payments.filter((row) => current(row.due_date)).map((row) => Number(row.amount_paid)));
  const previousRevenue = sum(data.payments.filter((row) => previous(row.due_date)).map((row) => Number(row.amount_paid)));
  const expenses = sum(data.expenses.filter((row) => current(row.spent_on)).map((row) => Number(row.amount)));
  const previousExpenses = sum(data.expenses.filter((row) => previous(row.spent_on)).map((row) => Number(row.amount)));
  const net = revenue - expenses, previousNet = previousRevenue - previousExpenses;
  const margin = revenue ? Math.round(net / revenue * 100) : 0, previousMargin = previousRevenue ? Math.round(previousNet / previousRevenue * 100) : 0;
  const opportunities = data.opportunities.filter((row) => current(row.created_at));
  const won = opportunities.filter((row) => row.stage === "won").length, lost = opportunities.filter((row) => row.stage === "lost").length;
  const views = data.views.filter((row) => current(row.visited_at)), visitors = new Set(views.map((row) => row.visitor_id)).size;
  const tasks = data.tasks.filter((row) => current(row.created_at)), completedTasks = tasks.filter((row) => ["approved", "completed"].includes(row.status)).length;
  const requests = [...data.supply, ...data.listing].filter((row) => current(row.created_at));
  const convertedRequests = requests.filter((row) => ["approved", "published", "completed", "converted"].includes(row.status)).length;
  const messages = data.messages.filter((row) => current(row.created_at)), sentMessages = messages.filter((row) => ["sent", "success", "delivered"].includes(row.result)).length;
  const reservations = data.reservations.filter((row) => current(row.created_at)), convertedReservations = reservations.filter((row) => row.converted_at || row.status === "converted").length;
  const allDue = sum(data.payments.map((row) => Number(row.amount_due))), allPaid = sum(data.payments.map((row) => Number(row.amount_paid)));
  const overdue = sum(data.payments.filter((row) => row.status !== "paid" && new Date(row.due_date) < now).map((row) => Math.max(0, Number(row.amount_due) - Number(row.amount_paid))));
  const activeSessions = data.sessions.filter((row) => !row.ended_at && now.getTime() - new Date(row.last_seen_at).getTime() < 130000).length;
  const hours = Math.round(sum(data.sessions.map((row) => row.duration_seconds)) / 3600 * 10) / 10;
  const pageMap = new Map<string, number>(); views.forEach((row) => pageMap.set(row.path, (pageMap.get(row.path) ?? 0) + 1));
  const sourceMap = new Map<string, number>(); data.contacts.filter((row) => current(row.created_at)).forEach((row) => sourceMap.set(row.source || "غير محدد", (sourceMap.get(row.source || "غير محدد") ?? 0) + 1));
  const pipelineOrder = ["new", "qualified", "viewing", "negotiation", "contract", "won", "lost"];
  const pipeline = pipelineOrder.map((key) => ({ label: stageLabels[key] ?? key, value: data.opportunities.filter((row) => row.stage === key).length }));
  const weightedPipeline = sum(data.opportunities.filter((row) => !["won", "lost"].includes(row.stage)).map((row) => Number(row.expected_value ?? 0) * Number(row.close_probability ?? 0) / 100));
  const bucketCount = days <= 7 ? 7 : days <= 30 ? 10 : 12, bucketDays = Math.ceil(days / bucketCount);
  const trend = Array.from({ length: bucketCount }, (_, index) => {
    const start = new Date(currentStart.getTime() + index * bucketDays * 86400000), end = new Date(Math.min(now.getTime(), start.getTime() + bucketDays * 86400000));
    const incoming = sum(data.payments.filter((row) => within(row.due_date, start, end)).map((row) => Number(row.amount_paid)));
    const outgoing = sum(data.expenses.filter((row) => within(row.spent_on, start, end)).map((row) => Number(row.amount)));
    return { label: start.toLocaleDateString("ar-SA", { day: "numeric", month: "short" }), revenue: incoming, expenses: outgoing, net: incoming - outgoing };
  });
  const followupsDue = data.activities.filter((row) => row.next_follow_up && new Date(row.next_follow_up) <= now).length;
  const avgResponse = requests.length ? Math.round(sum(requests.map((row) => Math.max(0, new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / 3600000)) / requests.length * 10) / 10 : 0;
  const cards = [
    { label: "زوار الموقع", value: visitors.toLocaleString("ar-SA"), hint: `${views.length} مشاهدة`, icon: Eye, tone: "primary" },
    { label: "عملاء جدد", value: String(data.contacts.filter((row) => current(row.created_at)).length), hint: `${delta(data.contacts.filter((row) => current(row.created_at)).length, data.contacts.filter((row) => previous(row.created_at)).length)}% عن السابق`, icon: Users, tone: "gold" },
    { label: "نسبة كسب الفرص", value: `${ratio(won, won + lost)}%`, hint: `${won} ناجحة من ${won + lost} مغلقة`, icon: Target, tone: "success" },
    { label: "قيمة المسار المرجّحة", value: formatCurrency(weightedPipeline), hint: "حسب احتمال الإغلاق", icon: BriefcaseBusiness, tone: "primary" },
    { label: "تحصيل المستحقات", value: `${ratio(allPaid, allDue)}%`, hint: `${formatCurrency(overdue)} متأخر`, icon: Gauge, tone: "success" },
    { label: "إنجاز المهام", value: `${ratio(completedTasks, tasks.length)}%`, hint: `${completedTasks} من ${tasks.length}`, icon: FileCheck2, tone: "success" },
    { label: "تحويل الطلبات", value: `${ratio(convertedRequests, requests.length)}%`, hint: `${convertedRequests} طلب مكتمل`, icon: MousePointerClick, tone: "gold" },
    { label: "تحويل الحجوزات", value: `${ratio(convertedReservations, reservations.length)}%`, hint: `${convertedReservations} إلى عقد`, icon: CalendarClock, tone: "primary" },
    { label: "نجاح الرسائل", value: `${ratio(sentMessages, messages.length)}%`, hint: `${sentMessages} من ${messages.length}`, icon: MessageCircleMore, tone: "success" },
    { label: "نشاط الموظفين", value: `${hours} س`, hint: `${activeSessions} متصل الآن`, icon: UserRoundCheck, tone: "gold" },
  ];
  const summary = [
    net >= 0 ? `حققت الفترة صافيًا موجبًا بقيمة ${formatCurrency(net)} وهامش ${margin}%.` : `سجلت الفترة عجزًا بقيمة ${formatCurrency(Math.abs(net))} ويحتاج مراجعة المصروفات.`,
    `${visitors} زائرًا شاهدوا ${views.length} صفحة، بمتوسط ${visitors ? (views.length / visitors).toFixed(1) : "0"} صفحة لكل زائر.`,
    `قيمة الفرص المرجّحة حاليًا ${formatCurrency(weightedPipeline)}، ونسبة كسب الفرص المغلقة ${ratio(won, won + lost)}%.`,
    followupsDue ? `هناك ${followupsDue} متابعة مستحقة تحتاج إجراءً.` : "لا توجد متابعات متأخرة مسجلة حاليًا.",
  ];
  return { revenue, expenses, net, margin, previousMargin, revenueChange: delta(revenue, previousRevenue), expenseChange: delta(expenses, previousExpenses), netChange: delta(net, previousNet), cards, trend, pipeline, sources: [...sourceMap].map(([label, value]) => ({ label, value })).sort((a,b) => b.value-a.value).slice(0,7), topPages: [...pageMap].map(([label, value]) => ({ label, value, hint: "مشاهدة" })).sort((a,b) => b.value-a.value).slice(0,7), teamRows: [{ label: "ساعات الاستخدام", value: hours, hint: "ساعة" }, { label: "العمليات المسجلة", value: data.events.filter((row) => current(row.created_at)).length, hint: "عملية" }, { label: "المتصلون الآن", value: activeSessions, hint: "موظف" }, { label: "المهام المنجزة", value: completedTasks, hint: "مهمة" }], quality: [{ label: "أنشطة العملاء", value: data.activities.filter((row) => current(row.created_at)).length }, { label: "متابعات مستحقة", value: followupsDue }, { label: "متوسط الاستجابة", value: `${avgResponse} س` }, { label: "رسائل ناجحة", value: sentMessages }], due: allDue, allPaid, overdue, summary };
}

function useCrmData() { return null as unknown as { views: PageView[]; contacts: Contact[]; opportunities: Opportunity[]; activities: { activity_type: string; happened_at: string; next_follow_up: string | null; created_at: string }[]; payments: Payment[]; expenses: Expense[]; invoices: (Dated & { total: number; status: string; issue_date: string })[]; supply: (Dated & { status: string; updated_at: string })[]; listing: (Dated & { status: string; updated_at: string })[]; reservations: (Dated & { status: string; converted_at: string | null })[]; tasks: (Dated & { status: string; started_at: string | null; approved_at: string | null })[]; sessions: Session[]; events: (Dated & { actor_id: string | null })[]; messages: (Dated & { result: string })[] } }

function HeroMetric({ icon: Icon, label, value, change, good }: { icon: typeof TrendingUp; label: string; value: string; change: number; good: boolean }) { const positive = good ? change >= 0 : change <= 0; return <div className="flex items-center gap-4 border-border p-5 sm:border-l last:border-l-0"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-primary"><Icon className="size-5" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><b className="mt-1 block truncate text-xl">{value}</b><span className={cn("mt-1 flex items-center gap-1 text-xs font-bold", positive ? "text-success" : "text-destructive")}>{change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{change >= 0 ? "+" : ""}{change}% عن الفترة السابقة</span></div></div> }
function MetricCard({ icon: Icon, label, value, hint, tone }: { icon: typeof Eye; label: string; value: string; hint: string; tone: string }) { return <article className="surface-card p-4"><span className={cn("grid size-9 place-items-center rounded-lg", tone === "success" ? "bg-success/15 text-success" : tone === "gold" ? "bg-gold/15 text-gold" : "bg-accent text-primary")}><Icon className="size-4.5" /></span><b className="mt-4 block text-xl">{value}</b><p className="mt-1 text-xs font-bold">{label}</p><p className="mt-1 text-[11px] text-muted-foreground">{hint}</p></article> }
function Panel({ title, sub, icon: Icon, children, className }: { title: string; sub: string; icon: typeof Activity; children: ReactNode; className?: string }) { return <section className={cn("surface-card min-w-0 p-5", className)}><header className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-accent text-primary"><Icon className="size-4" /></span><div><h3 className="text-sm font-black">{title}</h3><p className="text-xs text-muted-foreground">{sub}</p></div></header>{children}</section> }
function MoneyTrend({ data }: { data: { label: string; revenue: number; expenses: number; net: number }[] }) { return <div className="h-72" dir="ltr"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="crmRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.35}/><stop offset="95%" stopColor="var(--color-success)" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3"/><XAxis dataKey="label" fontSize={10}/><YAxis fontSize={10}/><Tooltip formatter={(value) => formatCurrency(Number(value))}/><Area type="monotone" dataKey="revenue" name="المتحصل" stroke="var(--color-success)" fill="url(#crmRevenue)" strokeWidth={3}/><Area type="monotone" dataKey="expenses" name="المصروف" stroke="var(--color-destructive)" fill="transparent" strokeWidth={2}/><Area type="monotone" dataKey="net" name="الصافي" stroke="var(--color-gold)" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer></div> }
function SimpleBars({ data, valueKey }: { data: { label: string; value: number }[]; valueKey: string }) { return <div className="h-64" dir="ltr"><ResponsiveContainer><BarChart data={data} layout="vertical"><CartesianGrid horizontal={false} strokeDasharray="3 3"/><XAxis type="number" fontSize={10}/><YAxis dataKey="label" type="category" width={70} fontSize={10}/><Tooltip/><Bar dataKey={valueKey} name="العدد" fill="var(--color-primary)" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div> }
function RankList({ rows }: { rows: { label: string; value: number; hint: string }[] }) { return <div className="divide-y divide-border">{rows.length ? rows.map((row, index) => <div key={row.label} className="flex items-center gap-3 py-3"><b className="grid size-7 place-items-center rounded-md bg-muted text-xs">{index + 1}</b><span className="min-w-0 flex-1 truncate text-xs font-bold" dir={row.label.startsWith("/") ? "ltr" : "rtl"}>{row.label}</span><span className="text-xs text-muted-foreground">{row.value.toLocaleString("ar-SA")} {row.hint}</span></div>) : <p className="py-10 text-center text-xs text-muted-foreground">لا توجد بيانات كافية بعد.</p>}</div> }
function QualityGrid({ rows }: { rows: { label: string; value: string | number }[] }) { return <div className="grid grid-cols-2 gap-3">{rows.map((row) => <div key={row.label} className="rounded-lg border border-border bg-muted/40 p-4 text-center"><b className="block text-xl">{row.value}</b><span className="text-xs text-muted-foreground">{row.label}</span></div>)}</div> }
function CollectionBlock({ due, paid, overdue }: { due: number; paid: number; overdue: number }) { const value = ratio(paid, due); return <div><div className="flex items-end justify-between"><div><b className="text-3xl">{value}%</b><p className="text-xs text-muted-foreground">من إجمالي المستحقات</p></div><span className="text-xs font-bold text-destructive">متأخر: {formatCurrency(overdue)}</span></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${Math.min(value, 100)}%` }}/></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><span className="rounded-md bg-muted p-3">مستحق <b className="block mt-1">{formatCurrency(due)}</b></span><span className="rounded-md bg-muted p-3">محصل <b className="block mt-1 text-success">{formatCurrency(paid)}</b></span></div></div> }
function ExecutiveSummary({ items }: { items: string[] }) { return <div className="space-y-3">{items.map((item, index) => <p key={item} className="rounded-lg border border-border bg-muted/35 p-3 text-xs leading-6"><b className="me-2 text-primary">{index + 1}.</b>{item}</p>)}</div> }