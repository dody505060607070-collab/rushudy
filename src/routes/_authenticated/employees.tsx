import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, CalendarDays, History, Mail, Pencil, Phone, Plus, Trash2, User, UserCog, UserX, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { deleteStaffAccount } from "@/lib/staff.functions";

type Row = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  job_title: string | null;
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "الموظفون | الرشودي للعقارات" },
      { name: "description", content: "حسابات فريق العمل وحالتها وصلاحياتها في النظام." },
      { property: "og:title", content: "الموظفون | الرشودي للعقارات" },
      { property: "og:description", content: "حسابات فريق العمل وحالتها وصلاحياتها في النظام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async (vars: { userId: string; mode: "disable" | "delete" }) =>
      deleteStaffAccount({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.mode === "delete" ? "تم حذف الموظف" : "تم إيقاف حساب الموظف");
      queryClient.invalidateQueries({ queryKey: ["employees-list"] });
      queryClient.invalidateQueries({ queryKey: ["staff-with-roles"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر تنفيذ العملية"),
  });

  const list = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, whatsapp, job_title, hire_date, is_active, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = list.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sel = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <>
      <PageHero
        title="الموظفون"
        subtitle="حسابات الفريق وبيانات الدخول والصلاحيات وملاحظات الإدارة."
        icon={UserCog}
        stats={[
          { label: "إجمالي الموظفين", value: String(rows.length), icon: Users },
          { label: "نشِط", value: String(rows.filter((r) => r.is_active).length), icon: User },
          { label: "الموظفون الموقوفون", value: String(rows.filter((r) => !r.is_active).length), icon: UserX },
        ]}
      />

      <div className={sel ? "grid gap-4 xl:grid-cols-[1fr_340px]" : ""}>
      <div className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-foreground">قائمة الموظفين</h2>
          <Link
            to="/employee-form"
            search={{ id: "" }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" />
            إضافة موظف
          </Link>
        </div>

        <DataTable<Row>
          rows={rows}
          searchPlaceholder="بحث بالاسم أو البريد"
          dragLabel="موظف"
          emptyState={
            <EmptyState
              text="لا توجد حسابات موظفين"
              hint="اضغط «إضافة موظف» لإنشاء حساب دخول وتحديد صلاحياته."
            />
          }
          columns={[
            { header: "الموظف", cell: (r) => (
              <button type="button" onClick={() => setSelectedId(r.id)} className="flex items-center gap-2.5 text-start font-semibold hover:text-primary">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><User className="size-4" /></span>
                {r.full_name}
              </button>
            ) },
            { header: "البريد", cell: (r) => <span dir="ltr">{r.email ?? "—"}</span> },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone ?? "—"}</span> },
            { header: "الواتساب", cell: (r) => <span dir="ltr">{r.whatsapp ?? "—"}</span> },
            { header: "المسمى", cell: (r) => r.job_title ?? "—" },
            { header: "التعيين", cell: (r) => formatDate(r.hire_date) },
            {
              header: "الحالة",
              cell: (r) => (
                <Chip tone={r.is_active ? "success" : "neutral"}>
                  {r.is_active ? "نشط" : "موقوف"}
                </Chip>
              ),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <div className="flex items-center gap-2">
                <Link to="/activity-log" aria-label="عرض النشاط" title="عرض سجل النشاط">
                  <History className="size-4 text-muted-foreground hover:text-primary" />
                </Link>
                <Link to="/employee-form" search={{ id: r.id }} aria-label="تعديل">
                  <Pencil className="size-4 text-muted-foreground hover:text-primary" />
                </Link>
                <button
                  type="button"
                  aria-label="إيقاف الحساب"
                  title="إيقاف حساب الموظف (منع الدخول)"
                  disabled={remove.isPending || !r.is_active}
                  onClick={() => {
                    if (!window.confirm(`إيقاف حساب ${r.full_name}؟ لن يستطيع الدخول للنظام.`)) return;
                    remove.mutate({ userId: r.id, mode: "disable" });
                  }}
                >
                  <Ban className="size-4 text-muted-foreground hover:text-primary disabled:opacity-40" />
                </button>
                <button
                  type="button"
                  aria-label="حذف الموظف"
                  title="حذف الموظف نهائيًا"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (!window.confirm(`حذف ${r.full_name} نهائيًا؟ لا يمكن التراجع.`)) return;
                    remove.mutate({ userId: r.id, mode: "delete" });
                  }}
                >
                  <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                </button>
                </div>
              ),
            },
          ]}
        />
      </div>
      {sel ? (
        <aside className="surface-card h-fit space-y-4 p-5 xl:sticky xl:top-4">
          <div className="flex items-start justify-between">
            <div><h2 className="text-[17px] font-bold">بيانات الموظف</h2><p className="text-[12px] text-muted-foreground">معلومات الحساب</p></div>
            <button type="button" onClick={() => setSelectedId(null)} className="grid size-9 place-items-center rounded-full border border-border hover:bg-muted" aria-label="إغلاق"><X className="size-4" /></button>
          </div>
          <div className="grid place-items-center gap-2 rounded-2xl bg-muted/40 py-5 text-center">
            <span className="grid size-20 place-items-center rounded-full bg-primary/10 text-primary"><User className="size-9" /></span>
            <Chip tone={sel.is_active ? "success" : "neutral"}>{sel.is_active ? "نشط" : "موقوف"}</Chip>
            <p className="text-[17px] font-bold">{sel.full_name}</p>
            <p className="text-[13px] text-muted-foreground">{sel.job_title ?? "موظف"}</p>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border text-[13px]">
            {[
              { i: Mail, l: "البريد", v: sel.email ?? "—" },
              { i: Phone, l: "الجوال", v: sel.phone ?? "—" },
              { i: Phone, l: "الواتساب", v: sel.whatsapp ?? "—" },
              { i: CalendarDays, l: "تاريخ الانضمام", v: formatDate(sel.hire_date) },
            ].map((x) => (
              <div key={x.l} className="flex items-center justify-between gap-2 px-4 py-3">
                <span className="flex items-center gap-2 text-muted-foreground"><x.i className="size-4" />{x.l}</span>
                <span dir="ltr" className="font-semibold">{x.v}</span>
              </div>
            ))}
          </div>
          <Link to="/employee-form" search={{ id: sel.id }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[14px] font-bold text-primary-foreground hover:opacity-90"><Pencil className="size-4" /> تعديل بيانات الموظف</Link>
          <button
            type="button"
            disabled={remove.isPending || !sel.is_active}
            onClick={() => { if (window.confirm(`إيقاف حساب ${sel.full_name}؟ لن يستطيع الدخول للنظام.`)) remove.mutate({ userId: sel.id, mode: "disable" }); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-3 text-[14px] font-bold text-destructive hover:bg-destructive/5 disabled:opacity-40"
          ><Ban className="size-4" /> إيقاف الحساب</button>
        </aside>
      ) : null}
      </div>
    </>
  );
}
