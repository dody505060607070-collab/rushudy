import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BellRing,
  Building2,
  CalendarClock,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
  Upload,
  Wallet,
  LogIn,
  LogOut,
  CalendarCheck,
  Activity,
  ArrowUpLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { cn } from "@/lib/utils";

import { Chip } from "@/components/kit/Chip";
import { formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { CrmOverview } from "@/components/crm/CrmOverview";
import { supabase } from "@/integrations/supabase/client";

const DashboardInsights = lazy(() =>
  import("@/components/dashboard/DashboardInsights").then((module) => ({
    default: module.DashboardInsights,
  })),
);

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "CRM — لوحة التحكم | الرشودي للعقارات" },
      {
        name: "description",
        content: "ملخص موحد لأداء المحفظة العقارية والأولويات التي تحتاج متابعة.",
      },
      { property: "og:title", content: "لوحة التحكم | الرشودي للعقارات" },
      {
        property: "og:description",
        content: "ملخص موحد لأداء المحفظة العقارية والأولويات التي تحتاج متابعة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

      const [
        activeContracts,
        endingSoon,
        units,
        occupied,
        supply,
        listing,
        pendingTasks,
        overduePayments,
        monthPayments,
        soon30,
      ] = await Promise.all([
        supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .lte("end_date", in60),
        supabase.from("units").select("id", { count: "exact", head: true }),
        supabase
          .from("units")
          .select("id", { count: "exact", head: true })
          .eq("status", "occupied"),
        supabase
          .from("supply_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "in_review"]),
        supabase
          .from("listing_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "in_review"]),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "submitted"),
        supabase
          .from("contract_payments")
          .select("amount_due, amount_paid")
          .neq("status", "paid")
          .lte("due_date", today),
        supabase
          .from("contract_payments")
          .select("amount_due, amount_paid")
          .gte("due_date", monthStart),
        supabase
          .from("contract_payments")
          .select("amount_due, amount_paid")
          .neq("status", "paid")
          .lte("due_date", in30),
      ]);

      const sumRemaining = (list: { amount_due: number | null; amount_paid: number | null }[] | null) =>
        (list ?? []).reduce(
          (s, r) => s + (Number(r.amount_due ?? 0) - Number(r.amount_paid ?? 0)),
          0,
        );

      const monthDue = (monthPayments.data ?? []).reduce(
        (s, r) => s + Number(r.amount_due ?? 0),
        0,
      );
      const monthPaid = (monthPayments.data ?? []).reduce(
        (s, r) => s + Number(r.amount_paid ?? 0),
        0,
      );

      const totalUnits = units.count ?? 0;
      const occupiedUnits = occupied.count ?? 0;

      return {
        activeContracts: activeContracts.count ?? 0,
        endingSoon: endingSoon.count ?? 0,
        totalUnits,
        occupiedUnits,
        vacantUnits: Math.max(totalUnits - occupiedUnits, 0),
        occupancy: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
        supply: supply.count ?? 0,
        listing: listing.count ?? 0,
        pendingTasks: pendingTasks.count ?? 0,
        overdueAmount: sumRemaining(overduePayments.data),
        overdueCount: (overduePayments.data ?? []).length,
        monthDue,
        monthPaid,
        monthRate: monthDue ? Math.round((monthPaid / monthDue) * 100) : 0,
        due30: sumRemaining(soon30.data),
      };
    },
  });

  const overdue = useQuery({
    queryKey: ["dashboard-overdue-rows"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("contract_payments")
        .select(
          "id, due_date, amount_due, amount_paid, status, contract:contract_id(contract_number, tenant:tenant_id(full_name))",
        )
        .neq("status", "paid")
        .lte("due_date", today)
        .order("due_date", { ascending: true })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        due_date: string | null;
        amount_due: number | null;
        amount_paid: number | null;
        contract: { contract_number: string | null; tenant: { full_name: string } | null } | null;
      }[];
    },
  });

  const ending = useQuery({
    queryKey: ["dashboard-ending-contracts"],
    queryFn: async () => {
      const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("contracts")
        .select("id, contract_number, end_date, tenant:tenant_id(full_name)")
        .eq("status", "active")
        .lte("end_date", in60)
        .order("end_date", { ascending: true })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        contract_number: string | null;
        end_date: string | null;
        tenant: { full_name: string } | null;
      }[];
    },
  });

  const operations = useQuery({
    queryKey: ["dashboard-operations", todayIso],
    refetchInterval: 30_000,
    queryFn: async () => {
      const dayStart = `${todayIso}T00:00:00.000Z`;
      const [sessions, reservations, activities] = await Promise.all([
        supabase.from("employee_sessions").select("id, user_id, started_at, ended_at, last_seen_at, profile:user_id(full_name)").gte("started_at", dayStart).order("started_at", { ascending: false }).limit(8),
        supabase.from("reservations").select("id, starts_at, ends_at, status").in("status", ["active", "hold"]),
        supabase.from("activity_log").select("id, action, entity_type, created_at, actor:actor_id(full_name)").order("created_at", { ascending: false }).limit(8),
      ]);
      return { sessions: sessions.data ?? [], reservations: reservations.data ?? [], activities: activities.data ?? [] };
    },
  });

  const board = useQuery({
    queryKey: ["dashboard-board"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [units, reservations] = await Promise.all([
        supabase.from("units").select("unit_type, status"),
        supabase
          .from("reservations")
          .select("id, status, starts_at, ends_at, property:property_id(name, code)")
          .in("status", ["active", "hold"])
          .order("starts_at", { ascending: false })
          .limit(8),
      ]);
      const map = new Map<string, { occupied: number; vacant: number }>();
      for (const u of units.data ?? []) {
        const key = (u.unit_type as string | null) ?? "غير محدد";
        const entry = map.get(key) ?? { occupied: 0, vacant: 0 };
        if (u.status === "occupied") entry.occupied += 1;
        else entry.vacant += 1;
        map.set(key, entry);
      }
      return {
        types: [...map.entries()]
          .map(([type, v]) => ({ type, ...v }))
          .sort((a, b) => b.occupied + b.vacant - (a.occupied + a.vacant)),
        reservations: (reservations.data ?? []) as unknown as {
          id: string;
          status: string;
          starts_at: string | null;
          ends_at: string | null;
          property: { name: string | null; code: string | null } | null;
        }[],
      };
    },
  });

  const s = summary.data;


  const [tab, setTab] = useState<"overview" | "operations" | "crm" | "analytics">("overview");
  const occ = s?.occupancy ?? 0;
  const weekDays = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];
  const todayIdx = (new Date().getDay() + 1) % 7; // السبت = 0
  const daysLeft = (d: string | null) =>
    d ? Math.max(Math.ceil((new Date(d).getTime() - Date.now()) / 86400000), 0) : 0;
  const daysLate = (d: string | null) =>
    d ? Math.max(Math.floor((Date.now() - new Date(d).getTime()) / 86400000), 0) : 0;
  const sessions = operations.data?.sessions ?? [];

  const tabs = [
    { key: "overview", label: "نظرة عامة" },
    { key: "operations", label: "العمليات اليومية" },
    { key: "crm", label: "العملاء والفرص" },
    { key: "analytics", label: "التحليلات" },
  ] as const;

  return (
    <div className="space-y-5">
      {/* ── رأس الصفحة ── */}
      <header className="grid gap-4 md:flex md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">CRM — لوحة التحكم</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">خطّط، تابع، وحصّل — كل أداء المحفظة والعملاء في شاشة واحدة.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/contracts" className="brand-tile inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-bold">
            <Plus className="size-4" /> عقد إيجار جديد
          </Link>
          <Link to="/contracts" className="inline-flex h-11 items-center gap-2 rounded-full border border-primary/40 bg-card px-5 text-[13px] font-bold text-primary hover:bg-accent">
            <Upload className="size-4" /> رفع عقد PDF
          </Link>
          <Link to="/reminders" className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-[13px] font-bold text-foreground hover:bg-muted">
            <BellRing className="size-4" /> التذكيرات
          </Link>
        </div>
      </header>

      {/* ── التبويبات ── */}
      <nav className="flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-full px-5 py-2 text-[13px] font-bold transition-colors",
              tab === t.key ? "brand-tile" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        summary.isLoading ? (
          <div className="surface-card grid place-items-center gap-2 px-6 py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-[13px] text-muted-foreground">جاري حساب المؤشرات…</p>
          </div>
        ) : summary.error ? (
          <div className="surface-card grid place-items-center gap-2 px-6 py-10 text-center">
            <TriangleAlert className="size-7 text-destructive" />
            <p className="text-[13px] text-destructive" dir="ltr">
              {summary.error instanceof Error ? summary.error.message : "خطأ غير معروف"}
            </p>
          </div>
        ) : (
          <>
            {/* ── 4 بطاقات رئيسية ── */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile featured to="/contracts" label="العقود النشطة" value={String(s?.activeContracts ?? 0)} badge={String(s?.endingSoon ?? 0)} note="تنتهي خلال 60 يومًا" />
              <StatTile to="/properties" label="نسبة الإشغال" value={`${occ}%`} badge={String(s?.vacantUnits ?? 0)} note="وحدة شاغرة" />
              <StatTile to="/invoices" label="تحصيل الشهر" value={`${s?.monthRate ?? 0}%`} badge={formatCurrency(s?.monthPaid ?? 0)} note={`من ${formatCurrency(s?.monthDue ?? 0)}`} />
              <StatTile danger to="/invoices" label="إجمالي المتأخرات" value={formatCurrency(s?.overdueAmount ?? 0)} badge={String(s?.overdueCount ?? 0)} note="دفعة تحتاج تحصيلًا" />
            </div>

            {/* ── الصف الثاني ── */}
            <div className="grid gap-4 lg:grid-cols-12">
              <section className="surface-card p-5 lg:col-span-5">
                <CardHead title="حركة الإشغال الأسبوعية" />
                <div className="mt-5 flex h-44 items-end justify-between gap-2.5">
                  {weekDays.map((d, i) => {
                    const h = Math.max(22, occ - (i % 3) * 6);
                    const future = i > todayIdx;
                    return (
                      <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                        {i === todayIdx ? (
                          <span className="rounded-md border border-primary/30 bg-accent px-1.5 text-[10px] font-bold text-primary">{occ}%</span>
                        ) : null}
                        <div
                          className={cn(
                            "w-full max-w-11 rounded-full",
                            future ? "stripes border border-border" : i === todayIdx ? "bg-primary" : i % 2 ? "bg-accent-2" : "bg-primary/55",
                          )}
                          style={{ height: `${h}%` }}
                        />
                        <span className="text-[11px] font-semibold text-muted-foreground">{d}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="surface-card p-5 lg:col-span-3">
                <CardHead title="تحتاج إجراء" />
                <div className="mt-3 space-y-1">
                  <MiniWork to="/supply-requests" icon={Search} title="طلبات توفير عقار" count={s?.supply ?? 0} />
                  <MiniWork to="/listing-requests" icon={Building2} title="عقارات مقدمة" count={s?.listing ?? 0} />
                  <MiniWork to="/tasks" icon={ClipboardCheck} title="موافقات المهام" count={s?.pendingTasks ?? 0} />
                  <MiniWork to="/invoices" icon={Wallet} title="مستحق خلال 30 يومًا" count={formatCurrency(s?.due30 ?? 0)} />
                </div>
              </section>

              <section className="surface-card p-5 lg:col-span-4">
                <CardHead title="عقود قريبة الانتهاء" to="/contracts" />
                <ul className="mt-3 space-y-2.5">
                  {(ending.data ?? []).slice(0, 5).map((row) => (
                    <li key={row.id} className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-primary"><CalendarClock className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{row.tenant?.full_name ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground">ينتهي: {formatDate(row.end_date)}</p>
                      </div>
                      <Chip tone="warning">{daysLeft(row.end_date)} يوم</Chip>
                    </li>
                  ))}
                  {!(ending.data ?? []).length ? <Empty text="لا توجد عقود تنتهي قريبًا." /> : null}
                </ul>
              </section>
            </div>

            {/* ── الصف الثالث ── */}
            <div className="grid gap-4 lg:grid-cols-12">
              <section className="surface-card p-5 lg:col-span-5">
                <CardHead title="دفعات متأخرة" to="/invoices" />
                <ul className="mt-3 space-y-2.5">
                  {(overdue.data ?? []).slice(0, 5).map((row) => (
                    <li key={row.id} className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-[13px] font-bold text-destructive">
                        {(row.contract?.tenant?.full_name ?? "؟").charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{row.contract?.tenant?.full_name ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          عقد {row.contract?.contract_number ?? "بدون رقم"} · <b className="text-foreground">{formatCurrency(Number(row.amount_due ?? 0) - Number(row.amount_paid ?? 0))}</b>
                        </p>
                      </div>
                      <Chip tone="danger">متأخر {daysLate(row.due_date)} يوم</Chip>
                    </li>
                  ))}
                  {!(overdue.data ?? []).length ? <Empty text="لا توجد دفعات متأخرة 🎉" /> : null}
                </ul>
              </section>

              <section className="surface-card p-5 lg:col-span-4">
                <CardHead title="إشغال الوحدات" to="/properties" />
                <div className="relative mx-auto mt-4 aspect-[2/1] w-full max-w-64 overflow-hidden">
                  <div
                    className="absolute inset-x-0 top-0 aspect-square rounded-full"
                    style={{ background: `conic-gradient(from 270deg, var(--color-primary) 0 ${occ / 2}%, var(--color-accent-2) ${occ / 2}% 50%, transparent 50% 100%)` }}
                  />
                  <div className="absolute inset-x-[18%] top-[18%] aspect-square rounded-full bg-card" />
                  <div className="absolute inset-x-0 bottom-0 text-center">
                    <b className="block text-3xl font-extrabold">{occ}%</b>
                    <span className="text-[11px] text-muted-foreground">من {s?.totalUnits ?? 0} وحدة</span>
                  </div>
                </div>
                <div className="mt-4 flex justify-center gap-5 text-[11.5px]">
                  <Legend className="bg-primary" label={`مشغولة ${s?.occupiedUnits ?? 0}`} />
                  <Legend className="bg-accent-2" label={`شاغرة ${s?.vacantUnits ?? 0}`} />
                </div>
              </section>

              <section className="brand-tile relative overflow-hidden p-5 lg:col-span-3">
                <div className="pointer-events-none absolute -bottom-16 -start-16 size-48 rounded-full border-[18px] border-primary-foreground/10" />
                <p className="text-[13px] font-bold text-primary-foreground/85">اليوم في المكتب</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <TodayStat icon={LogIn} label="دخول" value={sessions.length} />
                  <TodayStat icon={LogOut} label="مغادرة" value={sessions.filter((r) => r.ended_at).length} />
                  <TodayStat icon={CalendarCheck} label="حجوزات" value={operations.data?.reservations.length ?? 0} />
                </div>
                <Link to="/activity-log" className="mt-5 flex h-10 items-center justify-center gap-2 rounded-full bg-primary-foreground text-[12.5px] font-bold text-primary">
                  <Activity className="size-4" /> متابعة الموظفين
                </Link>
              </section>
            </div>
          </>
        )
      ) : null}

      {tab === "operations" ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <section className="surface-card p-5 lg:col-span-4">
            <CardHead title="الوحدات حسب النوع" to="/properties" />
            <ul className="mt-3 space-y-3">
              {(board.data?.types ?? []).map((row) => {
                const total = row.occupied + row.vacant || 1;
                return (
                  <li key={row.type}>
                    <div className="flex justify-between text-[12.5px]">
                      <span className="font-semibold">{row.type}</span>
                      <span className="text-muted-foreground">{row.occupied} مشغول · {row.vacant} شاغر</span>
                    </div>
                    <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-accent-2-soft">
                      <div className="bg-primary" style={{ width: `${(row.occupied / total) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
              {!board.data?.types.length ? <Empty text="لا توجد وحدات مسجلة." /> : null}
            </ul>
          </section>

          <section className="surface-card p-5 lg:col-span-4">
            <CardHead title="حركة الحجوزات" to="/reservations" />
            <ul className="mt-3 space-y-2.5">
              {(board.data?.reservations ?? []).map((row) => (
                <li key={row.id} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-2-soft text-accent-2"><CalendarCheck className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{row.property?.name ?? "عقار غير محدد"}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(row.starts_at)} — {formatDate(row.ends_at)}</p>
                  </div>
                  <Chip tone={row.status === "active" ? "success" : "warning"}>{row.status === "active" ? "قائم" : "مؤقت"}</Chip>
                </li>
              ))}
              {!board.data?.reservations.length ? <Empty text="لا توجد حجوزات حالية." /> : null}
            </ul>
          </section>

          <section className="surface-card p-5 lg:col-span-4">
            <CardHead title="آخر أنشطة النظام" to="/activity-log" />
            <ul className="mt-3 space-y-2.5">
              {(operations.data?.activities ?? []).map((row) => (
                <li key={row.id} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Activity className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{row.action} · {row.entity_type ?? "النظام"}</p>
                    <p className="text-[11px] text-muted-foreground">{(row.actor as { full_name?: string } | null)?.full_name ?? "النظام"}</p>
                  </div>
                  <time className="text-[10.5px] text-muted-foreground">{formatDate(row.created_at)}</time>
                </li>
              ))}
              {!operations.data?.activities.length ? <Empty text="لا توجد أنشطة بعد." /> : null}
            </ul>
          </section>
        </div>
      ) : null}

      {tab === "crm" ? <CrmOverview /> : null}

      {tab === "analytics" ? (
        <Suspense fallback={<div className="surface-card p-10 text-center text-sm text-muted-foreground">جاري إعداد التحليلات…</div>}>
          <DashboardInsights />
        </Suspense>
      ) : null}
    </div>
  );
}

function CardHead({ title, to }: { title: string; to?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      {to ? (
        <Link to={to} className="inline-flex h-7 items-center gap-1 rounded-full border border-border px-3 text-[11.5px] font-bold text-primary hover:bg-accent">
          الكل <ChevronLeft className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

function StatTile({ label, value, badge, note, to, featured, danger }: { label: string; value: string; badge: string; note: string; to: string; featured?: boolean; danger?: boolean }) {
  return (
    <Link to={to} className={cn("group block p-5 transition-transform hover:-translate-y-0.5", featured ? "brand-tile" : "surface-card")}>
      <div className="flex items-start justify-between">
        <p className={cn("text-[14px] font-bold", featured ? "text-primary-foreground" : "text-foreground")}>{label}</p>
        <span className={cn("grid size-9 place-items-center rounded-full border", featured ? "border-primary-foreground/40 bg-primary-foreground text-primary" : "border-border text-foreground group-hover:bg-muted")}>
          <ArrowUpLeft className="size-4" />
        </span>
      </div>
      <p className={cn("mt-3 truncate text-[34px] font-extrabold leading-none", featured ? "text-primary-foreground" : danger ? "text-destructive" : "text-foreground")}>{value}</p>
      <p className={cn("mt-3 flex items-center gap-1.5 text-[11.5px]", featured ? "text-primary-foreground/85" : danger ? "text-destructive" : "text-accent-2")}>
        <span className={cn("rounded-md border px-1.5 text-[10.5px] font-bold", featured ? "border-primary-foreground/40" : "border-current/40")}>{badge}</span>
        {note}
      </p>
    </Link>
  );
}

function MiniWork({ to, icon: Icon, title, count }: { to: string; icon: LucideIcon; title: string; count: number | string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-primary"><Icon className="size-4" /></span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{title}</span>
      <span className="text-[12.5px] font-extrabold text-foreground">{count}</span>
    </Link>
  );
}

function TodayStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-primary-foreground/10 py-3">
      <Icon className="mx-auto size-4 text-primary-foreground/80" />
      <b className="mt-1 block text-2xl font-extrabold text-primary-foreground">{value}</b>
      <span className="text-[10.5px] text-primary-foreground/75">{label}</span>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return <span className="flex items-center gap-1.5"><i className={cn("size-2.5 rounded-full", className)} />{label}</span>;
}

function Empty({ text }: { text: string }) {
  return <li className="py-8 text-center text-[12.5px] text-muted-foreground">{text}</li>;
}
