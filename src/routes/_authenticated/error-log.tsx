import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock3, ShieldCheck, TriangleAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";

type Row = {
  id: string;
  source: string | null;
  message: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/error-log")({
  head: () => ({
    meta: [
      { title: "سجل الأخطاء | الرشودي للعقارات" },
      { name: "description", content: "أخطاء النظام وفشل الإرسال والتكاملات للمعالجة." },
      { property: "og:title", content: "سجل الأخطاء | الرشودي للعقارات" },
      { property: "og:description", content: "أخطاء النظام وفشل الإرسال والتكاملات للمعالجة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ErrorLogPage,
});

function ErrorLogPage() {
  const stats = useQuery({
    queryKey: ["error-log-stats"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const [all, week, last] = await Promise.all([
        supabase.from("error_log").select("id", { count: "exact", head: true }),
        supabase.from("error_log").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("error_log").select("created_at").order("created_at", { ascending: false }).limit(1),
      ]);
      return { all: all.count ?? 0, week: week.count ?? 0, last: last.data?.[0]?.created_at ?? null };
    },
  });
  return (
    <>
      <PageHero
        title="سجل الأخطاء"
        subtitle="كل فشل حقيقي يُسجَّل هنا بسببه، ولا يُعرض أي نجاح وهمي في النظام."
        icon={TriangleAlert}
        stats={[
          { value: String(stats.data?.week ?? 0), label: "أخطاء آخر 7 أيام", icon: TriangleAlert },
          { value: String(stats.data?.all ?? 0), label: "إجمالي الأخطاء المسجلة", icon: ShieldCheck },
          { value: stats.data?.last ? formatDate(stats.data.last) : "—", label: "آخر حدوث خطأ", icon: Clock3 },
        ]}
      />

      <LiveTable<Row>
        table="error_log"
        select="id, source, message, created_at"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث في الأخطاء"
        emptyText="لا توجد أخطاء مسجلة"
        emptyHint="هذه علامة جيدة — لم يسجّل النظام أي فشل حتى الآن."
        columns={[
          { header: "المصدر", cell: (r) => r.source ?? "—", className: "font-semibold" },
          { header: "الرسالة", cell: (r) => <span dir="ltr">{r.message}</span> },
          { header: "التاريخ", cell: (r) => formatDate(r.created_at) },
        ]}
      />
    </>
  );
}
