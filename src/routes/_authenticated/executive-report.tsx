import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, FileBarChart, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, formatCurrency } from "@/components/kit/LiveTable";
import { GhostButton, PrimaryButton } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "التقرير التنفيذي | الرشودي للعقارات";
const DESC = "ملخص تنفيذي أسبوعي أو شهري للتحصيل والعقود والطلبات والمهام جاهز للطباعة والإرسال.";

export const Route = createFileRoute("/_authenticated/executive-report")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExecutiveReportPage,
});

const ranges: Record<string, { label: string; days: number }> = {
  week: { label: "آخر أسبوع", days: 7 },
  month: { label: "آخر شهر", days: 30 },
  quarter: { label: "آخر 90 يومًا", days: 90 },
};

function ExecutiveReportPage() {
  const [range, setRange] = useState("week");
  const days = ranges[range].days;
  const since = useMemo(() => new Date(Date.now() - days * 86_400_000).toISOString(), [days]);

  const { data, isLoading } = useQuery({
    queryKey: ["executive-report", range],
    queryFn: async () => {
      const [payments, contracts, listing, supply, tasks, views, offers] = await Promise.all([
        supabase.from("contract_payments").select("amount, status, due_date, paid_at"),
        supabase.from("contracts").select("id, status, total_value, annual_rent, created_at").gte("created_at", since),
        supabase.from("listing_requests").select("id, created_at").gte("created_at", since),
        supabase.from("supply_requests").select("id, created_at").gte("created_at", since),
        supabase.from("tasks").select("id, status, created_at").gte("created_at", since),
        supabase.from("site_page_views").select("id, visitor_id").gte("visited_at", since),
        supabase.from("price_offers").select("id, offer_amount, status").gte("created_at", since),
      ]);

      const paymentRows = payments.data ?? [];
      const collected = paymentRows
        .filter((p) => p.status === "paid" && p.paid_at && p.paid_at >= since)
        .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
      const overdue = paymentRows
        .filter((p) => p.status !== "paid" && p.due_date && p.due_date < new Date().toISOString().slice(0, 10))
        .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
      const upcoming = paymentRows
        .filter((p) => p.status !== "paid" && p.due_date && p.due_date >= new Date().toISOString().slice(0, 10))
        .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

      const contractRows = contracts.data ?? [];
      const taskRows = tasks.data ?? [];
      const viewRows = views.data ?? [];

      return {
        collected,
        overdue,
        upcoming,
        newContracts: contractRows.length,
        contractValue: contractRows.reduce((sum, c) => sum + Number(c.total_value ?? c.annual_rent ?? 0), 0),
        listingRequests: (listing.data ?? []).length,
        supplyRequests: (supply.data ?? []).length,
        tasksCreated: taskRows.length,
        tasksDone: taskRows.filter((t) => t.status === "done" || t.status === "completed").length,
        pageViews: viewRows.length,
        visitors: new Set(viewRows.map((v) => v.visitor_id)).size,
        offers: (offers.data ?? []).length,
        offersValue: (offers.data ?? []).reduce((sum, o) => sum + Number(o.offer_amount ?? 0), 0),
      };
    },
  });

  const text = useMemo(() => {
    if (!data) return "";
    return [
      `📊 التقرير التنفيذي — ${ranges[range].label}`,
      "",
      `• المحصل: ${formatCurrency(data.collected)}`,
      `• متأخرات: ${formatCurrency(data.overdue)}`,
      `• دفعات قادمة: ${formatCurrency(data.upcoming)}`,
      `• عقود جديدة: ${data.newContracts} بقيمة ${formatCurrency(data.contractValue)}`,
      `• طلبات عرض عقار: ${data.listingRequests}`,
      `• طلبات توفير عقار: ${data.supplyRequests}`,
      `• مهام: ${data.tasksDone} منجزة من ${data.tasksCreated}`,
      `• زوار الموقع: ${data.visitors} زائر / ${data.pageViews} مشاهدة`,
      `• عروض أسعار: ${data.offers} بقيمة ${formatCurrency(data.offersValue)}`,
      "",
      "الرشودي للعقارات",
    ].join("\n");
  }, [data, range]);

  const cards = data
    ? [
        { label: "إجمالي المحصل", value: formatCurrency(data.collected) },
        { label: "المتأخرات", value: formatCurrency(data.overdue) },
        { label: "الدفعات القادمة", value: formatCurrency(data.upcoming) },
        { label: "عقود جديدة", value: `${data.newContracts}` },
        { label: "قيمة العقود الجديدة", value: formatCurrency(data.contractValue) },
        { label: "طلبات عرض عقار", value: `${data.listingRequests}` },
        { label: "طلبات توفير عقار", value: `${data.supplyRequests}` },
        { label: "مهام منجزة", value: `${data.tasksDone} / ${data.tasksCreated}` },
        { label: "زوار الموقع", value: `${data.visitors}` },
        { label: "مشاهدات الصفحات", value: `${data.pageViews}` },
        { label: "عروض الأسعار", value: `${data.offers}` },
        { label: "قيمة عروض الأسعار", value: formatCurrency(data.offersValue) },
      ]
    : [];

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        title="التقرير التنفيذي"
        subtitle="ملخص جاهز للإدارة: التحصيل والعقود والطلبات والمهام وحركة الموقع."
        icon={FileBarChart}
        stats={
          data
            ? [
                { value: formatCurrency(data.collected), label: "محصل في الفترة" },
                { value: String(data.newContracts), label: "عقد جديد" },
                { value: String(data.visitors), label: "زائر" },
              ]
            : []
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills
          defaultKey="week"
          onChange={setRange}
          items={Object.entries(ranges).map(([key, value]) => ({ key, label: value.label }))}
        />
        <div className="flex items-center gap-2">
          <GhostButton
            onClick={() => {
              navigator.clipboard?.writeText(text);
              toast.success("تم نسخ التقرير");
            }}
          >
            <Copy className="size-4" /> نسخ الملخص
          </GhostButton>
          <PrimaryButton onClick={() => window.print()}>
            <Printer className="size-4" /> طباعة
          </PrimaryButton>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">جارٍ التحميل…</div>
      ) : !data ? (
        <EmptyState text="تعذر إنشاء التقرير" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="text-[12px] text-muted-foreground">{card.label}</div>
                <div className="mt-1 text-lg font-bold text-foreground">{card.value}</div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 text-base font-bold text-foreground">نص الملخص الجاهز للإرسال</h2>
            <pre className="whitespace-pre-wrap rounded-lg border border-border bg-background p-4 text-[12.5px] leading-7 text-foreground">
              {text}
            </pre>
            <p className="mt-3 text-[12px] text-muted-foreground">
              لا يُرسل التقرير تلقائيًا؛ انسخه وأرسله بنفسك وقتما تشاء.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
