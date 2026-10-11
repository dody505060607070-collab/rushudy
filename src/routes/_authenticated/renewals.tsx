import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarClock, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip } from "@/components/kit/Chip";
import { EmptyState, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "تنبيهات تجديد العقود | الرشودي للعقارات";
const DESC = "متابعة العقود المنتهية خلال 90 و60 و30 يومًا مع خطة تفاوض وتجديد لكل عقد.";

export const Route = createFileRoute("/_authenticated/renewals")({
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
  component: RenewalsPage,
});

type Row = {
  id: string;
  contract_number: string;
  end_date: string | null;
  annual_rent: number | null;
  total_value: number | null;
  status: string;
  tenant: { full_name: string; phone: string | null } | null;
  owner: { full_name: string } | null;
  property: { name: string; code: string } | null;
};

function daysLeft(end: string | null) {
  if (!end) return null;
  const diff = new Date(end).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86_400_000);
}

function bucketOf(days: number | null) {
  if (days == null) return "later";
  if (days < 0) return "expired";
  if (days <= 30) return "d30";
  if (days <= 60) return "d60";
  if (days <= 90) return "d90";
  return "later";
}

const buckets: Record<
  string,
  { label: string; tone: "danger" | "warning" | "info" | "muted" | "neutral" }
> = {
  expired: { label: "منتهٍ بالفعل", tone: "danger" },
  d30: { label: "أقل من 30 يومًا", tone: "danger" },
  d60: { label: "خلال 60 يومًا", tone: "warning" },
  d90: { label: "خلال 90 يومًا", tone: "info" },
  later: { label: "لاحقًا", tone: "muted" },
};

function RenewalsPage() {
  const [tab, setTab] = useState("d90");

  const { data = [], isLoading } = useQuery({
    queryKey: ["contract-renewals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(
          "id, contract_number, end_date, annual_rent, total_value, status, tenant:tenant_id(full_name, phone), owner:owner_id(full_name), property:property_id(name, code)",
        )
        .not("end_date", "is", null)
        .order("end_date");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  // أقرب دفعة غير مسددة لكل عقد، لفتح قالب التذكير الجاهز بدل واتساب المباشر.
  const { data: nextPayments = new Map<string, string>() } = useQuery({
    queryKey: ["contract-renewals", "next-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_payments")
        .select("id, contract_id, due_date, status")
        .not("status", "in", '("paid","cancelled")')
        .order("due_date");
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data ?? []) if (!map.has(row.contract_id)) map.set(row.contract_id, row.id);
      return map;
    },
  });

  const enriched = useMemo(
    () =>
      data
        .filter((row) => !["cancelled", "closed"].includes(row.status))
        .map((row) => ({
          row,
          days: daysLeft(row.end_date),
          bucket: bucketOf(daysLeft(row.end_date)),
        })),
    [data],
  );

  const counts = enriched.reduce<Record<string, number>>((acc, item) => {
    acc[item.bucket] = (acc[item.bucket] ?? 0) + 1;
    return acc;
  }, {});

  const visible = enriched.filter((item) => {
    if (tab === "all") return true;
    if (tab === "d90") return ["d30", "d60", "d90"].includes(item.bucket);
    return item.bucket === tab;
  });

  const atRisk = (counts["d30"] ?? 0) + (counts["expired"] ?? 0);
  const valueAtRisk = enriched
    .filter((i) => ["d30", "d60", "d90", "expired"].includes(i.bucket))
    .reduce((sum, i) => sum + Number(i.row.annual_rent ?? i.row.total_value ?? 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        title="تنبيهات تجديد العقود"
        subtitle="تابع العقود المقتربة من الانتهاء قبل 90 و60 و30 يومًا وابدأ التفاوض مبكرًا."
        icon={CalendarClock}
        stats={[
          { value: String(enriched.length), label: "عقد نشط" },
          { value: String(atRisk), label: "يحتاج تحركًا عاجلًا" },
          { value: formatCurrency(valueAtRisk), label: "قيمة قابلة للتجديد" },
        ]}
      />

      <Pills
        defaultKey="d90"
        onChange={setTab}
        items={[
          {
            key: "d90",
            label: "خلال 90 يومًا",
            count: (counts["d30"] ?? 0) + (counts["d60"] ?? 0) + (counts["d90"] ?? 0),
          },
          { key: "d30", label: "أقل من 30 يومًا", count: counts["d30"] ?? 0 },
          { key: "d60", label: "خلال 60 يومًا", count: counts["d60"] ?? 0 },
          { key: "expired", label: "منتهية", count: counts["expired"] ?? 0 },
          { key: "all", label: "كل العقود", count: enriched.length },
        ]}
      />

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          جارٍ التحميل…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState text="لا توجد عقود في هذه الفترة" hint="جرّب تبويبًا آخر." />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {(["expired", "d30", "d60", "d90", "later"] as const)
            .filter((b) => visible.some((v) => v.bucket === b))
            .map((b) => {
              const list = visible.filter((v) => v.bucket === b);
              const info = buckets[b]!;
              const head =
                b === "d60"
                  ? "bg-warning/10 text-warning"
                  : b === "d90"
                    ? "bg-success/10 text-success"
                    : b === "later"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary";
              const btn = b === "d60" ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground";
              return (
                <section key={b} className="surface-card space-y-3 p-3">
                  <header className={`flex items-center justify-between rounded-xl px-4 py-3 ${head}`}>
                    <div>
                      <h2 className="text-[17px] font-bold">{info.label}</h2>
                      <p className="text-[11.5px] opacity-80">
                        {b === "d90"
                          ? "تواصل تمهيدي لقياس رغبة المستأجر في الاستمرار"
                          : b === "d60"
                            ? "عرض شروط التجديد والزيادة المقترحة"
                            : "تفاوض نهائي أو بدء تسويق الوحدة فورًا"}
                      </p>
                    </div>
                    <span className="grid size-10 place-items-center rounded-full bg-card text-[15px] font-bold">{list.length}</span>
                  </header>
                  {list.map(({ row, days }) => {
                    const reminderId = nextPayments.get(row.id) ?? null;
                    return (
                      <article key={row.id} className="space-y-3 rounded-xl border border-border bg-card p-3">
                        <div className="flex items-start gap-3">
                          <div className={`grid min-w-14 place-items-center rounded-xl px-2 py-1.5 ${head}`}>
                            <b className="text-[20px] leading-6">{days != null ? Math.abs(days) : "—"}</b>
                            <span className="text-[10.5px]">{days != null && days < 0 ? "يوم مضى" : "يوم"}</span>
                          </div>
                          <div className="min-w-0 flex-1 text-[12.5px]">
                            <p className="font-bold" dir="auto">عقد {row.contract_number}</p>
                            <p className="truncate text-muted-foreground">المالك: {row.owner?.full_name ?? "—"}</p>
                            <p className="truncate text-muted-foreground">المستأجر: {row.tenant?.full_name ?? "غير محدد"}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[12px]">
                          <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                            <p className="text-muted-foreground">قيمة العقد</p>
                            <b>{formatCurrency(row.annual_rent ?? row.total_value)}</b>
                          </div>
                          <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                            <p className="text-muted-foreground">العقار</p>
                            <b className="block truncate">{row.property?.name ?? "—"}</b>
                          </div>
                        </div>
                        <p className="text-[11.5px] text-muted-foreground">ينتهي: {formatDate(row.end_date)}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Link
                            to="/contracts/$contractId"
                            params={{ contractId: row.id }}
                            className={`inline-flex h-9 items-center justify-center rounded-lg text-[12.5px] font-semibold ${btn} ${reminderId ? "" : "col-span-2"}`}
                          >
                            بدء المتابعة — فتح العقد
                          </Link>
                          {reminderId ? (
                            <Link
                              to="/payment-reminder/$paymentId"
                              params={{ paymentId: reminderId }}
                              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-border text-[12px] font-semibold hover:bg-muted"
                            >
                              <MessageCircle className="size-4" /> مراسلة المستأجر
                            </Link>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
