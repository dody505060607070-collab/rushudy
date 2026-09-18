import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Calculator, LineChart } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip } from "@/components/kit/Chip";
import { EmptyState, formatCurrency } from "@/components/kit/LiveTable";
import { Field, inputClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "التقييم والعائد الاستثماري | الرشودي للعقارات";
const DESC = "تقدير سعر العقار من متوسطات الأحياء وحساب العائد الاستثماري الصافي للمالك.";

export const Route = createFileRoute("/_authenticated/valuation")({
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
  component: ValuationPage,
});

type Row = {
  id: string;
  name: string;
  purpose: string;
  property_type: string | null;
  city: string | null;
  district: string | null;
  price_value: number | null;
};

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function ValuationPage() {
  const [purpose, setPurpose] = useState("rent");
  const [district, setDistrict] = useState("");
  const [type, setType] = useState("");

  const [roi, setRoi] = useState({
    price: "",
    annualRent: "",
    maintenance: "",
    management: "",
    vacancy: "5",
    otherFees: "",
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["valuation-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, purpose, property_type, city, district, price_value")
        .not("price_value", "is", null)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const scoped = useMemo(() => data.filter((r) => r.purpose === purpose), [data, purpose]);

  const districts = useMemo(
    () => [...new Set(scoped.map((r) => r.district).filter(Boolean) as string[])].sort(),
    [scoped],
  );
  const types = useMemo(
    () => [...new Set(scoped.map((r) => r.property_type).filter(Boolean) as string[])].sort(),
    [scoped],
  );

  const districtStats = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const row of scoped) {
      const key = row.district || "غير محدد";
      if (type && row.property_type !== type) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(Number(row.price_value));
    }
    return [...map.entries()]
      .map(([name, prices]) => ({
        name,
        count: prices.length,
        avg: prices.reduce((a, b) => a + b, 0) / prices.length,
        mid: median(prices),
        min: Math.min(...prices),
        max: Math.max(...prices),
      }))
      .sort((a, b) => b.count - a.count);
  }, [scoped, type]);

  const selected = districtStats.find((d) => d.name === district) ?? null;

  const price = Number(roi.price || 0);
  const annualRent = Number(roi.annualRent || 0);
  const vacancyLoss = annualRent * (Number(roi.vacancy || 0) / 100);
  const costs = Number(roi.maintenance || 0) + Number(roi.management || 0) + Number(roi.otherFees || 0);
  const netIncome = annualRent - vacancyLoss - costs;
  const grossYield = price ? (annualRent / price) * 100 : 0;
  const netYield = price ? (netIncome / price) * 100 : 0;
  const payback = netIncome > 0 && price ? price / netIncome : 0;

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        title="التقييم الذكي والعائد الاستثماري"
        subtitle="قارن سعر العقار بمتوسط حيّه، واحسب صافي العائد السنوي للمالك."
        icon={LineChart}
        stats={[
          { value: String(scoped.length), label: "عقار بسعر معلن" },
          { value: String(districtStats.length), label: "حي تحت التحليل" },
          { value: selected ? formatCurrency(selected.mid) : "—", label: "وسيط سعر الحي" },
        ]}
      />

      <Pills defaultKey="rent" onChange={setPurpose} items={[{ key: "rent", label: "إيجار" }, { key: "sale", label: "بيع" }]} />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <header className="mb-4">
          <h2 className="text-base font-bold text-foreground">تقييم تلقائي حسب الحي</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            التقدير مبني على أسعار العقارات المشابهة المسجلة لدينا في نفس الحي والنوع.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الحي">
            <select value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass}>
              <option value="">كل الأحياء</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نوع العقار">
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              <option value="">كل الأنواع</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {isLoading ? (
          <div className="mt-5 text-center text-muted-foreground">جارٍ التحميل…</div>
        ) : districtStats.length === 0 ? (
          <div className="mt-5">
            <EmptyState text="لا توجد أسعار كافية للتحليل" hint="أضف أسعارًا للعقارات لتظهر المقارنة." />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-right text-[12.5px]">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 font-semibold">الحي</th>
                  <th className="py-2 font-semibold">عدد العقارات</th>
                  <th className="py-2 font-semibold">المتوسط</th>
                  <th className="py-2 font-semibold">الوسيط</th>
                  <th className="py-2 font-semibold">أقل سعر</th>
                  <th className="py-2 font-semibold">أعلى سعر</th>
                </tr>
              </thead>
              <tbody>
                {(district ? districtStats.filter((d) => d.name === district) : districtStats).map((row) => (
                  <tr key={row.name} className="border-b border-border/60">
                    <td className="py-2 font-semibold text-foreground">{row.name}</td>
                    <td className="py-2">{row.count}</td>
                    <td className="py-2">{formatCurrency(row.avg)}</td>
                    <td className="py-2 font-semibold text-foreground">{formatCurrency(row.mid)}</td>
                    <td className="py-2">{formatCurrency(row.min)}</td>
                    <td className="py-2">{formatCurrency(row.max)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <header className="mb-4 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-border bg-background text-primary">
            <Calculator className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">حاسبة العائد الاستثماري للمالك</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              أدخل قيمة العقار والإيجار والمصاريف لتعرف الصافي ونسبة العائد ومدة الاسترداد.
            </p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="قيمة العقار (ريال)">
            <input type="number" value={roi.price} onChange={(e) => setRoi({ ...roi, price: e.target.value })} className={inputClass} />
          </Field>
          <Field label="الإيجار السنوي (ريال)">
            <input type="number" value={roi.annualRent} onChange={(e) => setRoi({ ...roi, annualRent: e.target.value })} className={inputClass} />
          </Field>
          <Field label="نسبة الشواغر %">
            <input type="number" value={roi.vacancy} onChange={(e) => setRoi({ ...roi, vacancy: e.target.value })} className={inputClass} />
          </Field>
          <Field label="صيانة سنوية">
            <input type="number" value={roi.maintenance} onChange={(e) => setRoi({ ...roi, maintenance: e.target.value })} className={inputClass} />
          </Field>
          <Field label="إدارة أملاك سنوية">
            <input type="number" value={roi.management} onChange={(e) => setRoi({ ...roi, management: e.target.value })} className={inputClass} />
          </Field>
          <Field label="مصاريف أخرى">
            <input type="number" value={roi.otherFees} onChange={(e) => setRoi({ ...roi, otherFees: e.target.value })} className={inputClass} />
          </Field>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="text-[12px] text-muted-foreground">صافي الدخل السنوي</div>
            <div className="mt-1 text-lg font-bold text-foreground">{formatCurrency(netIncome)}</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="text-[12px] text-muted-foreground">العائد الإجمالي</div>
            <div className="mt-1 text-lg font-bold text-foreground">{grossYield.toFixed(2)}%</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="text-[12px] text-muted-foreground">العائد الصافي</div>
            <div className="mt-1 flex items-center gap-2 text-lg font-bold text-foreground">
              {netYield.toFixed(2)}%
              <Chip tone={netYield >= 7 ? "success" : netYield >= 4 ? "info" : "warning"}>
                {netYield >= 7 ? "ممتاز" : netYield >= 4 ? "جيد" : "منخفض"}
              </Chip>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="text-[12px] text-muted-foreground">مدة استرداد رأس المال</div>
            <div className="mt-1 text-lg font-bold text-foreground">
              {payback ? `${payback.toFixed(1)} سنة` : "—"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
