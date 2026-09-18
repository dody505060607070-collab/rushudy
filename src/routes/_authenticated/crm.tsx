import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Contact, PhoneCall, Users } from "lucide-react";
import { lazy, Suspense } from "react";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { stageLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

const CrmIntelligence = lazy(() =>
  import("@/components/crm/CrmIntelligence").then((module) => ({
    default: module.CrmIntelligence,
  })),
);

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "نظام CRM | الرشودي للعقارات" },
      {
        name: "description",
        content: "مركز إدارة العلاقات: العملاء، الفرص، المتابعات والتقارير في شاشة واحدة.",
      },
      { property: "og:title", content: "نظام CRM | الرشودي للعقارات" },
      { property: "og:description", content: "العملاء والفرص والمتابعات ومؤشرات الأداء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrmPage,
});

type Opportunity = {
  id: string;
  title: string;
  stage: string;
  deal_type: string | null;
  expected_value: number | null;
  next_follow_up: string | null;
  contact: { full_name: string } | null;
  created_at: string;
};

const pipeline = ["new", "qualified", "viewing", "negotiation", "contract", "won", "lost"];

function CrmPage() {
  const opportunities = useQuery({
    queryKey: ["crm", "opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          "id, title, stage, deal_type, expected_value, next_follow_up, created_at, contact:contact_id(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Opportunity[];
    },
  });

  const totals = useQuery({
    queryKey: ["crm", "totals"],
    queryFn: async () => {
      const [contacts, leads, activities, openDeals] = await Promise.all([
        supabase.from("contacts").select("*", { count: "exact", head: true }),
        supabase.from("contacts").select("*", { count: "exact", head: true }).contains("roles", ["lead"]),
        supabase.from("crm_activities").select("*", { count: "exact", head: true }),
        supabase
          .from("opportunities")
          .select("*", { count: "exact", head: true })
          .not("stage", "in", '("won","lost")'),
      ]);
      return {
        contacts: contacts.count ?? 0,
        leads: leads.count ?? 0,
        activities: activities.count ?? 0,
        openDeals: openDeals.count ?? 0,
      };
    },
  });


  const rows = opportunities.data ?? [];
  const stageCounts = pipeline.map((stage) => ({
    stage,
    count: rows.filter((r) => r.stage === stage).length,
    value: rows
      .filter((r) => r.stage === stage)
      .reduce((sum, r) => sum + (r.expected_value ?? 0), 0),
  }));

  const won = rows.filter((r) => r.stage === "won").length;
  const closed = rows.filter((r) => r.stage === "won" || r.stage === "lost").length;
  const winRate = closed ? Math.round((won / closed) * 100) : 0;

  return (
    <>
      <PageHero
        title="نظام CRM"
        subtitle="مركز موحّد لمتابعة العملاء والموقع والفريق والفرص والأرباح والخسائر."
        icon={Users}
        stats={[
          { value: String(totals.data?.contacts ?? 0), label: "عميل مسجّل" },
          { value: String(totals.data?.openDeals ?? 0), label: "فرصة مفتوحة" },
          { value: `${winRate}%`, label: "نسبة النجاح" },
        ]}
      />

      <Suspense fallback={<div className="surface-card p-10 text-center text-sm text-muted-foreground">جاري تحميل مركز التحليلات…</div>}>
        <CrmIntelligence />
      </Suspense>

      <div className="grid gap-4 sm:grid-cols-2">
        <CrmCard
          to="/clients"
          icon={Contact}
          label="العملاء"
          value={totals.data?.contacts ?? 0}
          hint="ملاك، مستأجرون، مشترون ووسطاء"
        />
        <CrmCard
          to="/activities"
          icon={PhoneCall}
          label="المتابعات والأنشطة"
          value={totals.data?.activities ?? 0}
          hint="مكالمات، زيارات وملاحظات"
        />
      </div>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[14px] font-bold text-foreground">مسار البيع</h2>
          <p className="text-[12px] text-muted-foreground">
            توزيع الفرص على المراحل مع القيمة المتوقعة لكل مرحلة.
          </p>
        </div>
        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {stageCounts.map((s) => (
            <div
              key={s.stage}
              className={cn(
                "rounded-xl border border-border px-4 py-3",
                s.stage === "won" && "border-success/30 bg-success/5",
                s.stage === "lost" && "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-bold text-foreground">{s.count}</span>
                <span className="text-[12.5px] font-semibold text-muted-foreground">
                  {stageLabels[s.stage] ?? s.stage}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-muted-foreground">{formatCurrency(s.value)}</p>
            </div>
          ))}
        </div>
      </section>

      <DataTable<Opportunity>
        rows={rows}
        draggableRows
        dragLabel="فرصة"
        showColumnsButton
        searchPlaceholder="بحث بعنوان الفرصة أو العميل"
        emptyState={
          <EmptyState
            text="لا توجد فرص بعد"
            hint="حوّل طلبًا واردًا إلى فرصة لبدء متابعة العميل خطوة بخطوة."
          />
        }
        columns={[
          { header: "الفرصة", sortable: true, cell: (r) => r.title, className: "font-semibold" },
          { header: "العميل", cell: (r) => r.contact?.full_name ?? "—" },
          { header: "النوع", cell: (r) => (r.deal_type === "sale" ? "بيع" : "إيجار") },
          {
            header: "المرحلة",
            cell: (r) => (
              <Chip tone={r.stage === "won" ? "success" : r.stage === "lost" ? "danger" : "primary"}>
                {stageLabels[r.stage] ?? r.stage}
              </Chip>
            ),
          },
          {
            header: "القيمة المتوقعة",
            sortable: true,
            value: (r) => r.expected_value ?? 0,
            cell: (r) => formatCurrency(r.expected_value),
          },
          { header: "المتابعة القادمة", cell: (r) => formatDate(r.next_follow_up) },
          {
            header: "أُنشئت",
            sortable: true,
            value: (r) => r.created_at,
            cell: (r) => formatDate(r.created_at),
          },
        ]}
      />
    </>
  );
}

function CrmCard({
  to,
  icon: Icon,
  label,
  value,
  hint,
}: {
  to: string;
  icon: typeof Users;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="surface-card flex items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-accent/40"
    >
      <div>
        <p className="text-[12.5px] font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>
      </div>
      <span className="grid size-10 place-items-center rounded-xl border border-border bg-card text-primary">
        <Icon className="size-5" />
      </span>
    </Link>
  );
}
