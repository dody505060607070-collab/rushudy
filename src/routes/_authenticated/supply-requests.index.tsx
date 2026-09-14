import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatCurrency, formatDate, useTableRows } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { requestStatusLabels } from "@/lib/labels";

type SupplyRow = {
  id: string;
  full_name: string;
  phone: string;
  request_type: string;
  city: string | null;
  districts: string | null;
  property_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  requester_type: string | null;
  broker_name: string | null;
  admin_notes: string | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/supply-requests/")({
  head: () => ({
    meta: [
      { title: "طلبات توفير العقار | الرشودي للعقارات" },
      {
        name: "description",
        content: "متابعة طلبات توفير العقار الواردة من العملاء والوسطاء حتى إغلاق الطلب.",
      },
      { property: "og:title", content: "طلبات توفير العقار | الرشودي للعقارات" },
      { property: "og:description", content: "إدارة طلبات توفير العقار ومتابعتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplyRequestsPage,
});

function SupplyRequestsPage() {
  const [tab, setTab] = useState("all");
  const navigate = useNavigate();

  const supply = useTableRows<SupplyRow>({
    table: "supply_requests",
    select:
      "id, full_name, phone, request_type, city, districts, property_type, budget_min, budget_max, requester_type, broker_name, admin_notes, status, created_at",
    orderBy: { column: "created_at" },
    queryKey: ["supply_requests"],
  });

  const rows = supply.data ?? [];

  const counts = useMemo(
    () => ({
      all: rows.length,
      open: rows.filter((r) => r.status === "new" || r.status === "in_review").length,
      contacted: rows.filter((r) => r.status === "contacted").length,
      done: rows.filter((r) => r.status === "converted" || r.status === "approved").length,
      closed: rows.filter((r) => r.status === "closed" || r.status === "rejected").length,
    }),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "open") return r.status === "new" || r.status === "in_review";
    if (tab === "contacted") return r.status === "contacted";
    if (tab === "done") return r.status === "converted" || r.status === "approved";
    return r.status === "closed" || r.status === "rejected";
  });

  return (
    <>
      <PageHero
        title="طلبات توفير العقار"
        subtitle="الطلبات الواردة من العملاء والوسطاء للبحث عن عقار مناسب — اضغط على أي صف لعرض الطلب كاملًا."
        icon={Search}
        stats={[
          { value: String(counts.open), label: "قيد المراجعة" },
          { value: String(counts.contacted), label: "جاري المتابعة" },
          { value: String(counts.done), label: "تم الإنجاز" },
        ]}
      />

      <Pills
        defaultKey="all"
        onChange={setTab}
        items={[
          { key: "all", label: "الكل", count: counts.all },
          { key: "open", label: "قيد المراجعة", count: counts.open },
          { key: "contacted", label: "تم التواصل", count: counts.contacted },
          { key: "done", label: "منجزة", count: counts.done },
          { key: "closed", label: "مغلقة", count: counts.closed },
        ]}
      />

      {supply.isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري تحميل الطلبات…</p>
        </div>
      ) : supply.error ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <TriangleAlert className="size-7 text-destructive" />
          <p className="text-[14px] font-semibold text-foreground">تعذّر تحميل الطلبات</p>
          <p className="text-[12.5px] text-muted-foreground" dir="ltr">
            {supply.error instanceof Error ? supply.error.message : "خطأ غير معروف"}
          </p>
        </div>
      ) : (
        <DataTable<SupplyRow>
          rows={filtered}
          showColumnsButton
          searchPlaceholder="بحث بالاسم أو الجوال"
          onRowClick={(r) =>
            navigate({ to: "/supply-requests/$requestId", params: { requestId: r.id } })
          }
          emptyState={
            <EmptyState
              text="لا توجد طلبات توفير عقار"
              hint="الطلبات الواردة من الموقع أو المسجلة من الفريق ستظهر هنا."
            />
          }
          columns={[
            { header: "مقدّم الطلب", sortable: true, cell: (r) => r.full_name, className: "font-semibold" },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone}</span> },
            { header: "نوع الطلب", cell: (r) => (r.request_type === "buy" ? "شراء" : "إيجار") },
            { header: "نوع العقار", cell: (r) => r.property_type ?? "—" },
            { header: "الموقع", cell: (r) => [r.city, r.districts].filter(Boolean).join(" - ") || "—" },
            {
              header: "الميزانية",
              cell: (r) =>
                r.budget_min || r.budget_max
                  ? `${formatCurrency(r.budget_min)} — ${formatCurrency(r.budget_max)}`
                  : "—",
            },
            {
              header: "الصفة",
              cell: (r) => (
                <Chip tone={r.requester_type === "broker" ? "gold" : "primary"}>
                  {r.requester_type === "broker" ? (r.broker_name ?? "وسيط") : "عميل"}
                </Chip>
              ),
            },
            { header: "الحالة", cell: (r) => <Chip>{requestStatusLabels[r.status] ?? r.status}</Chip> },
            { header: "التاريخ", sortable: true, value: (r) => r.created_at, cell: (r) => formatDate(r.created_at) },
          ]}
        />
      )}
    </>
  );
}
