import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarClock, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip } from "@/components/kit/Chip";
import { EmptyState, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink } from "@/lib/site-data";

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

const buckets: Record<string, { label: string; tone: "danger" | "warning" | "info" | "muted" | "neutral" }> = {
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

  const enriched = useMemo(
    () =>
      data
        .filter((row) => !["cancelled", "closed"].includes(row.status))
        .map((row) => ({ row, days: daysLeft(row.end_date), bucket: bucketOf(daysLeft(row.end_date)) })),
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

  const atRisk = (counts['d30'] ?? 0) + (counts['expired'] ?? 0);
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
          { key: "d90", label: "خلال 90 يومًا", count: (counts['d30'] ?? 0) + (counts['d60'] ?? 0) + (counts['d90'] ?? 0) },
          { key: "d30", label: "أقل من 30 يومًا", count: counts['d30'] ?? 0 },
          { key: "d60", label: "خلال 60 يومًا", count: counts['d60'] ?? 0 },
          { key: "expired", label: "منتهية", count: counts['expired'] ?? 0 },
          { key: "all", label: "كل العقود", count: enriched.length },
        ]}
      />

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">جارٍ التحميل…</div>
      ) : visible.length === 0 ? (
        <EmptyState text="لا توجد عقود في هذه الفترة" hint="جرّب تبويبًا آخر." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map(({ row, days, bucket }) => {
            const info = buckets[bucket] ?? buckets["later"]!;
            const phone = row.tenant?.phone;
            const message = [
              "السلام عليكم ورحمة الله 🌿",
              `بخصوص العقد رقم ${row.contract_number}`,
              row.property?.name ? `العقار: ${row.property.name}` : null,
              row.end_date ? `ينتهي بتاريخ ${formatDate(row.end_date)}` : null,
              "",
              "نرغب في الاتفاق على التجديد، فهل نحدد موعدًا للتفاوض؟",
            ]
              .filter(Boolean)
              .join("\n");

            return (
              <article key={row.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground">عقد {row.contract_number}</h2>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {row.property?.name ?? "بدون عقار"} — المستأجر: {row.tenant?.full_name ?? "غير محدد"}
                    </p>
                  </div>
                  <Chip tone={info.tone}>
                    {days != null && days >= 0 ? `متبقٍ ${days} يوم` : info.label}
                  </Chip>
                </header>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <dt className="text-muted-foreground">تاريخ الانتهاء</dt>
                    <dd className="mt-1 font-semibold text-foreground">{formatDate(row.end_date)}</dd>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <dt className="text-muted-foreground">الإيجار السنوي</dt>
                    <dd className="mt-1 font-semibold text-foreground">{formatCurrency(row.annual_rent)}</dd>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <dt className="text-muted-foreground">المالك</dt>
                    <dd className="mt-1 font-semibold text-foreground">{row.owner?.full_name ?? "—"}</dd>
                  </div>
                </dl>

                <div className="mt-4 rounded-lg border border-border bg-background p-3 text-[12.5px] leading-6 text-muted-foreground">
                  <span className="font-semibold text-foreground">خطة التفاوض المقترحة: </span>
                  {bucket === "d90"
                    ? "تواصل تمهيدي لقياس رغبة المستأجر في الاستمرار، وجمع ملاحظاته على الوحدة."
                    : bucket === "d60"
                      ? "عرض شروط التجديد والزيادة المقترحة، وتثبيت موعد للرد."
                      : "تفاوض نهائي وإصدار عقد التجديد، أو بدء تسويق الوحدة فورًا."}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    to="/contracts/$contractId"
                    params={{ contractId: row.id }}
                    className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    فتح العقد
                  </Link>
                  {phone ? (
                    <a
                      href={whatsappLink(phone, message)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <MessageCircle className="size-4" /> مراسلة المستأجر
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
