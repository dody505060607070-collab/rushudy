import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Building2, Coins, LineChart, MapPin, PieChart, TrendingUp } from "lucide-react";
import { useMemo } from "react";

import { Bars, Empty, PortalCard, Progress, Stat, money, num, pct } from "@/components/portal/ui";
import { getOwnerInsights } from "@/lib/owner-portal.functions";

export const Route = createFileRoute("/portal/insights")({
  head: () => ({
    meta: [
      { title: "تحليلات محفظتي | بوابة المالك" },
      { name: "description", content: "تحليلات دخل المالك: صافي الدخل، العائد على الاستثمار، الإشغال، وتوقع الدخل القادم." },
      { property: "og:title", content: "تحليلات محفظتي | بوابة المالك" },
      { property: "og:description", content: "صافي الدخل والعائد والإشغال وتوقع الدخل لعقارات المالك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerInsightsPage,
});

function OwnerInsightsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["owner-insights"], queryFn: () => getOwnerInsights() });

  const last12 = useMemo(() => (data?.months ?? []).slice(-12), [data]);
  const thisMonth = last12.at(-1);
  const prevMonth = last12.at(-2);
  const lastYearSame = (data?.months ?? []).at(-13);

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري تحميل التحليلات…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const s = data.summary;
  const mapPoints = data.roi.filter((r) => r.latitude && r.longitude);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-card">
        <h1 className="text-lg font-bold">تحليلات محفظتي العقارية</h1>
        <p className="mt-1 text-[12.5px] text-primary-foreground/80">
          صورة كاملة عن دخلك ومصروفاتك وعائد كل عقار ونسبة الإشغال وتوقع الدخل القادم.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "صافي دخلي", value: money(s.netIncome) },
            { label: "قيمة المحفظة", value: money(s.portfolioValue) },
            { label: "الإيجار السنوي التعاقدي", value: money(s.annualRentRoll) },
            { label: "نسبة الإشغال", value: pct(s.occupancyRate) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl bg-primary-foreground/10 px-4 py-3">
              <p className="text-[11px] text-primary-foreground/70">{k.label}</p>
              <p className="mt-1 text-lg font-extrabold">{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="محصّل" value={money(s.collected)} tone="good" hint="إجمالي ما تم تحصيله" />
        <Stat label="مصروفات" value={money(s.expenses)} tone="warn" hint="صيانة وخدمات ورسوم" />
        <Stat label="عمولة المكتب" value={money(s.officeCommission)} hint={`${(s.commissionRate * 100).toFixed(1)}% من المحصّل`} />
        <Stat label="متأخرات المستأجرين" value={money(s.arrears)} tone="bad" hint="مستحق ولم يُسدد" />
      </div>

      <PortalCard title="مقارنة الأداء" icon={BarChart3} subtitle="هذا الشهر مقابل الشهر الماضي ونفس الشهر العام الماضي">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={`هذا الشهر (${thisMonth?.label ?? ""})`} value={money(thisMonth?.collected ?? 0)} tone="good" />
          <Stat label={`الشهر الماضي (${prevMonth?.label ?? ""})`} value={money(prevMonth?.collected ?? 0)} />
          <Stat label={`نفس الشهر العام الماضي`} value={money(lastYearSame?.collected ?? 0)} />
        </div>
        <div className="mt-4">
          <Bars items={last12.map((m) => ({ label: m.label, value: m.collected, secondary: m.expenses }))} />
          <p className="mt-2 text-[11px] text-muted-foreground">العمود العريض: المحصّل — الشريط السفلي: المصروفات.</p>
        </div>
      </PortalCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PortalCard title="صافي الدخل شهريًا" icon={LineChart} subtitle="المحصّل بعد خصم المصروفات وعمولة المكتب">
          <Bars items={last12.map((m) => ({ label: m.label, value: Math.max(0, m.net) }))} />
        </PortalCard>

        <PortalCard title="توقّع الدخل لـ 12 شهرًا" icon={TrendingUp} subtitle="بناءً على دفعات العقود الحالية غير المسددة">
          {data.forecast.every((f) => f.expected === 0) ? (
            <Empty text="لا توجد دفعات مستقبلية مسجلة حاليًا." />
          ) : (
            <Bars items={data.forecast.map((f) => ({ label: f.label, value: f.expected }))} />
          )}
        </PortalCard>
      </div>

      <PortalCard title="العائد على الاستثمار لكل عقار" icon={Coins} subtitle="معدل العائد السنوي = (الإيجار − المصروفات) ÷ قيمة العقار">
        {data.roi.length === 0 ? (
          <Empty text="لا توجد عقارات مسجلة باسمك بعد." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-[12.5px]">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2">العقار</th>
                  <th>القيمة</th>
                  <th>الإيجار السنوي</th>
                  <th>المصروفات</th>
                  <th>الصافي</th>
                  <th>العائد</th>
                </tr>
              </thead>
              <tbody>
                {data.roi.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 font-semibold text-foreground">
                      {r.name}
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {[r.city, r.district].filter(Boolean).join(" — ") || r.code}
                      </span>
                    </td>
                    <td>{money(r.value)}</td>
                    <td>{money(r.annualRent)}</td>
                    <td>{money(r.expenses)}</td>
                    <td className="font-semibold text-foreground">{money(r.netAnnual)}</td>
                    <td className="font-bold text-primary">{r.value > 0 ? pct(r.capRate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PortalCard title="الإشغال" icon={PieChart} subtitle="حالة وحداتك بين المؤجر والشاغر">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="إجمالي الوحدات" value={num(s.unitsCount)} />
            <Stat label="مؤجرة" value={num(s.occupiedUnits)} tone="good" />
            <Stat label="شاغرة" value={num(s.vacantUnits)} tone="warn" />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
              <span>نسبة الإشغال</span>
              <span className="font-bold text-foreground">{pct(s.occupancyRate)}</span>
            </div>
            <div className="mt-2">
              <Progress value={s.occupancyRate} />
            </div>
          </div>
        </PortalCard>

        <PortalCard title="خريطة عقاراتي" icon={MapPin} subtitle="مواقع العقارات المسجلة بإحداثيات">
          {mapPoints.length === 0 ? (
            <Empty text="لا توجد إحداثيات مسجلة لعقاراتك بعد." />
          ) : (
            <ul className="space-y-2">
              {mapPoints.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[12.5px]">
                  <span className="font-semibold text-foreground">{p.name}</span>
                  <a
                    className="text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                  >
                    فتح على الخريطة
                  </a>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>

      <PortalCard title="المباني والعقارات" icon={Building2} subtitle="ملخص أصولك المسجلة لدى المكتب">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="مبانٍ" value={num(s.buildingsCount)} />
          <Stat label="عقارات" value={num(s.propertiesCount)} />
          <Stat label="وحدات" value={num(s.unitsCount)} />
          <Stat label="عقود نشطة" value={num(s.activeContracts)} />
        </div>
      </PortalCard>
    </div>
  );
}
