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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { lazy, Suspense } from "react";

import { Chip } from "@/components/kit/Chip";
import { formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";

const DashboardInsights = lazy(() =>
  import("@/components/dashboard/DashboardInsights").then((module) => ({
    default: module.DashboardInsights,
  })),
);

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | الرشودي للعقارات" },
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


  return (
    <>
      <PageHero
        title="لوحة التحكم"
        subtitle="ملخص موحد لأداء المحفظة العقارية والأولويات التي تحتاج متابعة."
        icon={LayoutDashboard}
        stats={[
          { value: String(s?.activeContracts ?? 0), label: "عقد نشط" },
          { value: `${s?.occupancy ?? 0}%`, label: "نسبة الإشغال" },
          { value: String(s?.overdueCount ?? 0), label: "دفعة متأخرة" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <DailyCard icon={LogIn} label="الدخول اليوم" value={String(operations.data?.sessions.length ?? 0)} />
        <DailyCard icon={LogOut} label="المغادرة اليوم" value={String((operations.data?.sessions ?? []).filter((row) => row.ended_at).length)} />
        <DailyCard icon={CalendarCheck} label="الحجوزات القائمة" value={String(operations.data?.reservations.length ?? 0)} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/contracts"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          عقد إيجار جديد
        </Link>
        <Link
          to="/contracts"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Upload className="size-4" />
          رفع عقد PDF
        </Link>
        <Link
          to="/reminders"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <BellRing className="size-4" />
          إدارة التذكيرات
        </Link>
      </div>

      {summary.isLoading ? (
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={TriangleAlert}
            label="إجمالي المتأخرات"
            value={formatCurrency(s?.overdueAmount ?? 0)}
            hint={`${s?.overdueCount ?? 0} دفعة تحتاج تحصيلًا`}
            linkText="فتح مركز التحصيل"
            to="/invoices"
            danger
          />
          <MetricCard
            icon={Wallet}
            label="تحصيل الشهر"
            value={`${s?.monthRate ?? 0}%`}
            hint={`${formatCurrency(s?.monthPaid ?? 0)} من ${formatCurrency(s?.monthDue ?? 0)}`}
            linkText="متابعة التحصيل"
            to="/invoices"
          />
          <MetricCard
            icon={Gauge}
            label="نسبة الإشغال"
            value={`${s?.occupancy ?? 0}%`}
            hint={`${s?.occupiedUnits ?? 0} من ${s?.totalUnits ?? 0} وحدة`}
            linkText={`${s?.vacantUnits ?? 0} وحدة شاغرة`}
            to="/properties"
          />
          <MetricCard
            icon={FileText}
            label="العقود النشطة"
            value={String(s?.activeContracts ?? 0)}
            hint={`${s?.endingSoon ?? 0} تنتهي خلال 60 يومًا`}
            linkText="عرض سجل العقود"
            to="/contracts"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="surface-card p-5 lg:col-span-1">
          <p className="text-[11.5px] font-bold text-primary">حالة المحفظة</p>
          <h2 className="mt-1 text-[15px] font-bold text-foreground">إشغال الوحدات</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            الوحدات المرتبطة بعقود نشطة الآن
          </p>

          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">{s?.occupancy ?? 0}%</span>
              <span className="text-[12.5px] text-muted-foreground">نسبة الإشغال</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${s?.occupancy ?? 0}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11.5px] text-muted-foreground">
              <span>من أصل {s?.totalUnits ?? 0} وحدة</span>
              <span>
                مشغولة {s?.occupiedUnits ?? 0} · شاغرة {s?.vacantUnits ?? 0}
              </span>
            </div>
          </div>

          <dl className="mt-4 divide-y divide-border text-[13px]">
            <Line label="العقود النشطة" icon={FileText} value={String(s?.activeContracts ?? 0)} />
            <Line label="تنتهي خلال 60 يومًا" icon={CalendarClock} value={String(s?.endingSoon ?? 0)} />
            <Line
              label="مستحق خلال 30 يومًا"
              icon={Wallet}
              value={formatCurrency(s?.due30 ?? 0)}
            />
            <Line
              label="طلبات مفتوحة"
              icon={Search}
              value={String((s?.supply ?? 0) + (s?.listing ?? 0))}
            />
          </dl>
        </section>

        <section className="surface-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11.5px] font-bold text-primary">المتابعة اليومية</p>
              <h2 className="mt-1 text-[15px] font-bold text-foreground">دفعات متأخرة</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {s?.overdueCount ?? 0} دفعة بإجمالي {formatCurrency(s?.overdueAmount ?? 0)}
              </p>
            </div>
            <Link
              to="/invoices"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
            >
              عرض الكل
              <ChevronLeft className="size-4" />
            </Link>
          </div>

          {overdue.isLoading ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">جاري التحميل…</p>
          ) : (overdue.data ?? []).length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">
              لا توجد دفعات متأخرة حاليًا.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-right">
                <thead>
                  <tr className="border-b border-border text-[12px] font-bold text-muted-foreground">
                    <th className="py-2">المستأجر والعقد</th>
                    <th className="py-2">تاريخ الاستحقاق</th>
                    <th className="py-2">الحالة</th>
                    <th className="py-2">المبلغ المتبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {(overdue.data ?? []).map((row) => {
                    const days = row.due_date
                      ? Math.max(
                          Math.floor(
                            (Date.now() - new Date(row.due_date).getTime()) / 86400000,
                          ),
                          0,
                        )
                      : 0;
                    return (
                      <tr key={row.id} className="border-b border-border/70 text-[13px] last:border-0">
                        <td className="py-3 font-semibold text-foreground">
                          {row.contract?.tenant?.full_name ?? "—"}
                          <span className="block text-[11.5px] font-normal text-muted-foreground">
                            {row.contract?.contract_number ?? "بدون رقم"}
                          </span>
                        </td>
                        <td className="py-3">{formatDate(row.due_date)}</td>
                        <td className="py-3">
                          <Chip tone="danger">متأخر {days} يومًا</Chip>
                        </td>
                        <td className="py-3 font-semibold">
                          {formatCurrency(
                            Number(row.amount_due ?? 0) - Number(row.amount_paid ?? 0),
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="surface-card p-5">
          <h2 className="text-[15px] font-bold">حركة الإشغال الأسبوعية</h2>
          <p className="mt-1 text-xs text-muted-foreground">قراءة سريعة لنسبة الإشغال الحالية خلال أيام الأسبوع</p>
          <div className="mt-6 flex h-48 items-end justify-between gap-3 border-b border-border px-2">
            {["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"].map((day, index) => <div key={day} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-10 rounded-t-md bg-primary/80" style={{ height: `${Math.max(12, (s?.occupancy ?? 0) - (index % 3) * 4)}%` }} /><span className="text-[10px] text-muted-foreground">{day}</span></div>)}
          </div>
        </section>
        <section className="surface-card p-5">
          <h2 className="text-[15px] font-bold">حالة الوحدات</h2>
          <div className="mx-auto mt-5 grid size-44 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-primary) 0 ${(s?.occupancy ?? 0)}%, var(--color-muted) ${(s?.occupancy ?? 0)}% 100%)` }}><div className="grid size-28 place-items-center rounded-full bg-card text-center"><span><b className="block text-2xl">{s?.totalUnits ?? 0}</b><small className="text-muted-foreground">إجمالي الوحدات</small></span></div></div>
          <div className="mt-4 flex justify-center gap-5 text-xs"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-primary" />مشغولة {s?.occupiedUnits ?? 0}</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-muted" />شاغرة {s?.vacantUnits ?? 0}</span></div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="text-[15px] font-bold text-foreground">قائمة العمل</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">عناصر تنتظر الإجراء</p>
          <div className="mt-4 grid gap-2">
            <WorkItem
              to="/supply-requests"
              icon={Search}
              title="طلبات توفير عقار"
              hint="بانتظار بدء المتابعة"
              count={s?.supply ?? 0}
            />
            <WorkItem
              to="/listing-requests"
              icon={Building2}
              title="عقارات مقدمة"
              hint="بانتظار المراجعة"
              count={s?.listing ?? 0}
            />
            <WorkItem
              to="/tasks"
              icon={ClipboardCheck}
              title="موافقات المهام"
              hint="تحتاج قرارًا إداريًا"
              count={s?.pendingTasks ?? 0}
            />
            <WorkItem
              to="/contracts"
              icon={Upload}
              title="عقود PDF مستوردة"
              hint="تحتاج مراجعة الاستخراج"
              count={0}
            />
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-foreground">عقود قريبة الانتهاء</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">خلال الستين يومًا القادمة</p>
            </div>
            <Link
              to="/contracts"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
            >
              عرض الكل
              <ChevronLeft className="size-4" />
            </Link>
          </div>

          {(ending.data ?? []).length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">
              لا توجد عقود تنتهي قريبًا.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {(ending.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">
                      {row.tenant?.full_name ?? "—"}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {row.contract_number ?? "بدون رقم"} · {formatDate(row.end_date)}
                    </p>
                  </div>
                  <Chip tone="warning">
                    {row.end_date
                      ? `${Math.max(
                          Math.ceil((new Date(row.end_date).getTime() - Date.now()) / 86400000),
                          0,
                        )} يوم`
                      : "—"}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="text-[15px] font-bold">حالة الوحدة حسب النوع</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">توزيع الوحدات المشغولة والشاغرة</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[360px] text-right text-[13px]">
              <thead>
                <tr className="border-b border-border text-[12px] font-bold text-muted-foreground">
                  <th className="py-2">نوع الوحدة</th>
                  <th className="py-2">مشغول</th>
                  <th className="py-2">شاغر</th>
                </tr>
              </thead>
              <tbody>
                {(board.data?.types ?? []).map((row) => (
                  <tr key={row.type} className="border-b border-border/70 last:border-0">
                    <td className="py-2.5 font-semibold">{row.type}</td>
                    <td className="py-2.5 text-destructive">{row.occupied}</td>
                    <td className="py-2.5 text-success">{row.vacant}</td>
                  </tr>
                ))}
                {!board.data?.types.length ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground">
                      لا توجد وحدات مسجلة.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold">حركة الحجوزات</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">الحجوزات القائمة والمؤقتة</p>
            </div>
            <Link to="/reservations" search={{ newReservation: false }} className="text-xs font-bold text-primary">
              عرض الكل
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {(board.data?.reservations ?? []).map((row) => (
              <li key={row.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">
                    {row.property?.name ?? "عقار غير محدد"}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {formatDate(row.starts_at)} — {formatDate(row.ends_at)}
                  </p>
                </div>
                <Chip tone={row.status === "active" ? "success" : "warning"}>
                  {row.status === "active" ? "قائم" : "مؤقت"}
                </Chip>
              </li>
            ))}
            {!board.data?.reservations.length ? (
              <li className="py-8 text-center text-[13px] text-muted-foreground">لا توجد حجوزات حالية.</li>
            ) : null}
          </ul>
        </section>
      </div>



      <Suspense fallback={<div className="surface-card p-10 text-center text-sm text-muted-foreground">جاري إعداد التحليلات المتقدمة…</div>}>
        <DashboardInsights />
      </Suspense>

      <section className="surface-card overflow-hidden">
        <header className="flex items-center justify-between border-b border-border p-5"><div><p className="text-[11.5px] font-bold text-primary">مباشر</p><h2 className="mt-1 text-[15px] font-bold">آخر أنشطة النظام</h2></div><Link to="/activity-log" className="text-xs font-bold text-primary">متابعة الموظفين</Link></header>
        <div className="divide-y divide-border">{(operations.data?.activities ?? []).map((row) => <div key={row.id} className="flex items-center gap-3 px-5 py-3"><span className="grid size-8 place-items-center rounded-lg bg-accent text-primary"><Activity className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.action} · {row.entity_type ?? "النظام"}</p><p className="text-xs text-muted-foreground">{(row.actor as { full_name?: string } | null)?.full_name ?? "النظام"}</p></div><time className="text-[11px] text-muted-foreground">{formatDate(row.created_at)}</time></div>)}{!operations.data?.activities.length ? <p className="p-8 text-center text-sm text-muted-foreground">لا توجد أنشطة بعد.</p> : null}</div>
      </section>
    </>
  );
}

function DailyCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="surface-card flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div><span className="grid size-10 place-items-center rounded-lg border border-border bg-muted text-primary"><Icon className="size-5" /></span></div>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  linkText,
  to,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  linkText: string;
  to: string;
  danger?: boolean;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className={danger ? "border-e-2 border-destructive p-5" : "p-5"}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12.5px] font-semibold text-muted-foreground">{label}</p>
            <p
              className={
                danger
                  ? "mt-2 text-2xl font-bold text-destructive"
                  : "mt-2 text-2xl font-bold text-foreground"
              }
            >
              {value}
            </p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>
          </div>
          <span className="grid size-9 place-items-center rounded-lg border border-border bg-muted text-primary">
            <Icon className="size-[18px]" />
          </span>
        </div>
      </div>
      <Link
        to={to}
        className="flex items-center justify-between border-t border-border px-5 py-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted"
      >
        {linkText}
        <ChevronLeft className="size-4" />
      </Link>
    </div>
  );
}

function Line({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function WorkItem({
  to,
  icon: Icon,
  title,
  hint,
  count,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  count: number;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-xl border border-border px-4 py-3 transition-colors hover:bg-muted"
    >
      <span className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg border border-border bg-muted text-primary">
          <Icon className="size-[18px]" />
        </span>
        <span>
          <span className="block text-[13px] font-semibold text-foreground">{title}</span>
          <span className="block text-[11.5px] text-muted-foreground">{hint}</span>
        </span>
      </span>
      <span className="inline-flex items-center gap-2">
        <Chip tone={count ? "warning" : "neutral"}>{count ? count : "لا يوجد"}</Chip>
        <ChevronLeft className="size-4 text-muted-foreground" />
      </span>
    </Link>
  );
}
