import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, CalendarDays, Clock3, Database, DatabaseBackup, Download, FileText, Loader2, Receipt, User, Users } from "lucide-react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createSystemBackup } from "@/lib/backup.functions";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({ meta: [
    { title: "النسخ الاحتياطي | الرشودي للعقارات" },
    { name: "description", content: "إنشاء نسخة احتياطية مشفرة محليًا ومراجعة سجل النسخ السابقة." },
    { property: "og:title", content: "النسخ الاحتياطي | الرشودي للعقارات" },
    { property: "og:description", content: "نسخ بيانات النظام وسجل عمليات النسخ." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: BackupPage,
});

type BackupRow = { id: string; status: string; size_bytes: number | null; tables_count: number; created_at: string; completed_at: string | null; error_message: string | null };

function BackupPage() {
  const { isSuperAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const history = useQuery({ queryKey: ["backup-runs"], enabled: isSuperAdmin, queryFn: async () => {
    const { data, error } = await supabase.from("backup_runs").select("id,status,size_bytes,tables_count,created_at,completed_at,error_message").order("created_at", { ascending: false }).limit(50);
    if (error) throw error; return (data ?? []) as BackupRow[];
  }});
  const create = useMutation({ mutationFn: () => createSystemBackup(), onSuccess: (result) => {
    const url = URL.createObjectURL(new Blob([result.payload], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = result.fileName; link.click(); URL.revokeObjectURL(url);
    void qc.invalidateQueries({ queryKey: ["backup-runs"] }); toast.success("تم إنشاء وتنزيل النسخة الاحتياطية");
  }, onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر إنشاء النسخة") });

  const rows = history.data ?? [];
  const last = rows.find((r) => r.status === "completed");
  const size = (b: number | null) => b == null ? "—" : b > 1048576 ? `${(b / 1048576).toLocaleString("ar-SA", { maximumFractionDigits: 1 })} ميجابايت` : `${(b / 1024).toLocaleString("ar-SA", { maximumFractionDigits: 1 })} ك.ب`;
  const parts = [{ l: "العقارات", i: Building2 }, { l: "الملاك", i: Users }, { l: "العقود", i: FileText }, { l: "الفواتير", i: Receipt }, { l: "العملاء", i: User }];

  return <><PageHero title="النسخ الاحتياطي" subtitle="إدارة النسخ الاحتياطية للبيانات وحفظها بشكل آمن." icon={DatabaseBackup} />
    {!isSuperAdmin ? <div className="surface-card"><EmptyState text="هذه الصفحة للمدير العام فقط" /></div> : <>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <section className="surface-card space-y-4 p-5">
          <div className="flex items-center justify-between gap-2"><h2 className="text-[17px] font-bold">آخر نسخة احتياطية</h2>{last ? <Chip tone="success">مكتملة</Chip> : <Chip tone="neutral">لا توجد</Chip>}</div>
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/50 p-4">
            <div><p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><CalendarDays className="size-4" />تاريخ النسخة</p><p className="mt-1 text-[14px] font-bold">{last ? formatDate(last.created_at) : "—"}</p></div>
            <div><p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><Database className="size-4" />حجم النسخة</p><p className="mt-1 text-[14px] font-bold">{size(last?.size_bytes ?? null)}</p></div>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4 text-[12.5px] text-muted-foreground"><p className="flex items-center gap-2 font-bold text-foreground"><Clock3 className="size-4" />عدد الجداول في آخر نسخة: {last?.tables_count ?? 0}</p><p className="mt-1">عدد النسخ المسجلة: {rows.length}</p></div>
        </section>
        <section className="surface-card space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-[19px] font-bold">تنزيل نسخة كاملة</h2><p className="mt-1 text-[12.5px] text-muted-foreground">تشمل جميع بيانات النظام في ملف واحد</p></div>
            <span className="grid size-20 place-items-center rounded-2xl bg-primary/10 text-primary"><Database className="size-10" /></span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{parts.map((x) => <div key={x.l} className="grid place-items-center gap-1.5 rounded-xl bg-muted/50 py-4 text-[12.5px] font-semibold"><x.i className="size-6 text-primary" />{x.l}</div>)}</div>
          <button type="button" onClick={() => create.mutate()} disabled={create.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-60">{create.isPending ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}تنزيل نسخة كاملة الآن</button>
        </section>
      </div>
      <section className="surface-card space-y-3 p-5">
        <div><h2 className="text-[17px] font-bold">سجل النسخ الاحتياطية</h2><p className="text-[12px] text-muted-foreground">عرض جميع النسخ الاحتياطية السابقة</p></div>
      <DataTable rows={rows} emptyState={<EmptyState text="لم يتم إنشاء نسخ بعد" />} columns={[
        { header: "التاريخ والوقت", cell: (r: BackupRow) => formatDate(r.created_at) },
        { header: "الحالة", cell: (r: BackupRow) => <Chip tone={r.status === "completed" ? "success" : r.status === "failed" ? "danger" : "warning"}>{r.status === "completed" ? "مكتملة" : r.status === "failed" ? "فشلت" : "قيد التنفيذ"}</Chip> },
        { header: "الجداول", cell: (r: BackupRow) => r.tables_count },
        { header: "حجم الملف", cell: (r: BackupRow) => size(r.size_bytes) },
        { header: "ملاحظة", cell: (r: BackupRow) => r.error_message ?? "—" },
      ]} />
      </section>
    </>}
  </>;
}
