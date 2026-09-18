import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Bars, PortalCard, Stat, money, pct } from "@/components/portal/ui";
import { getSharedOwnerReport } from "@/lib/owner-portal.functions";

export const Route = createFileRoute("/owner-report/$token")({
  head: () => ({
    meta: [
      { title: "تقرير أداء المحفظة العقارية | الرشودي العقارية" },
      { name: "description", content: "تقرير ملخص لأداء المحفظة العقارية تمت مشاركته برابط مؤقت من مالك العقار." },
      { property: "og:title", content: "تقرير أداء المحفظة العقارية" },
      { property: "og:description", content: "ملخص الدخل والمصروفات والإشغال والعائد للمحفظة العقارية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: SharedOwnerReportPage,
});

function SharedOwnerReportPage() {
  const { token } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-owner-report", token],
    queryFn: () => getSharedOwnerReport({ data: { token } }),
    retry: false,
  });

  return (
    <main dir="rtl" className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
      {isLoading ? <p className="text-sm text-muted-foreground">جاري تحميل التقرير…</p> : null}
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h1 className="text-base font-bold text-foreground">تعذّر عرض التقرير</h1>
          <p className="mt-1 text-[12.5px] text-destructive">{(error as Error).message}</p>
        </div>
      ) : null}

      {data ? (
        <>
          <header className="rounded-2xl bg-primary p-6 text-primary-foreground">
            <h1 className="text-lg font-bold">تقرير أداء المحفظة العقارية</h1>
            <p className="mt-1 text-[12.5px] text-primary-foreground/80">
              {data.ownerName}
              {data.label ? ` — ${data.label}` : ""} · صالح حتى {String(data.expiresAt).slice(0, 10)}
            </p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="محصّل" value={money(data.summary.collected)} tone="good" />
            <Stat label="مصروفات" value={money(data.summary.expenses)} tone="warn" />
            <Stat label="صافي الدخل" value={money(data.summary.netIncome)} />
            <Stat label="نسبة الإشغال" value={pct(data.summary.occupancyRate)} />
          </div>

          <PortalCard title="الدخل خلال الأشهر الماضية" subtitle="المحصّل شهريًا">
            <Bars items={data.months.slice(-12).map((m) => ({ label: m.label, value: m.collected }))} />
          </PortalCard>

          <PortalCard title="العائد لكل عقار" subtitle="الإيجار السنوي والمصروفات ومعدل العائد">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-right text-[12.5px]">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2">العقار</th>
                    <th>الإيجار السنوي</th>
                    <th>المصروفات</th>
                    <th>العائد</th>
                  </tr>
                </thead>
                <tbody>
                  {data.roi.map((r) => (
                    <tr key={r.name} className="border-b border-border/60">
                      <td className="py-2 font-semibold text-foreground">{r.name}</td>
                      <td>{money(r.annualRent)}</td>
                      <td>{money(r.expenses)}</td>
                      <td className="font-bold text-primary">{pct(r.capRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PortalCard>

          <PortalCard title={`ملخص ${data.taxReport.year}`} subtitle="أرقام استرشادية للمحاسب">
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="المحصّل" value={money(data.taxReport.collected)} />
              <Stat label="المصروفات" value={money(data.taxReport.expenses)} />
              <Stat label="عمولة المكتب" value={money(data.taxReport.commission)} />
              <Stat label="الصافي" value={money(data.taxReport.net)} tone="good" />
            </div>
          </PortalCard>

          <p className="text-center text-[11px] text-muted-foreground">
            تقرير ملخص بدون بيانات المستأجرين — الرشودي العقارية
          </p>
        </>
      ) : null}
    </main>
  );
}
