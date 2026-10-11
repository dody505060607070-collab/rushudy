import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Handshake, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState } from "@/components/kit/LiveTable";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
};

export const Route = createFileRoute("/_authenticated/partners")({
  head: () => ({
    meta: [
      { title: "الشركاء | الرشودي للعقارات" },
      { name: "description", content: "إدارة شعارات الشركاء وروابطهم وترتيب ظهورهم في الموقع." },
      { property: "og:title", content: "الشركاء | الرشودي للعقارات" },
      { property: "og:description", content: "إدارة شعارات الشركاء وروابطهم وترتيب ظهورهم في الموقع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnersPage,
});

const empty = {
  name: "",
  logo_url: "",
  website_url: "",
  description: "",
  sort_order: 0,
  is_active: true,
};

function PartnersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });

  const list = useQuery({
    queryKey: ["partners-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, name, logo_url, website_url, description, sort_order, is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["partners-admin"] });
    queryClient.invalidateQueries({ queryKey: ["partners"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("اكتب اسم الشريك");
      const payload = {
        name: form.name.trim(),
        logo_url: form.logo_url.trim() || null,
        website_url: form.website_url.trim() || null,
        description: form.description.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      const res = editId
        ? await supabase.from("partners").update(payload).eq("id", editId)
        : await supabase.from("partners").insert(payload);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success(editId ? "تم تحديث الشريك" : "تمت إضافة الشريك");
      setOpen(false);
      setEditId(null);
      setForm({ ...empty });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحفظ"),
  });

  const toggleActive = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase
        .from("partners")
        .update({ is_active: !row.is_active })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر التحديث"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الشريك");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحذف"),
  });

  const startEdit = (row: Row) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      logo_url: row.logo_url ?? "",
      website_url: row.website_url ?? "",
      description: row.description ?? "",
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active,
    });
    setOpen(true);
  };

  const rows = list.data ?? [];

  return (
    <>
      <PageHero
        title="الشركاء"
        subtitle="الشركاء الذين تظهر شعاراتهم في الموقع العام مع روابطهم."
        icon={Handshake}
        stats={[
          { label: "إجمالي الشركاء", value: String(rows.length) },
          { label: "ظاهرون", value: String(rows.filter((r) => r.is_active).length) },
        ]}
      />

      <div className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-foreground">قائمة الشركاء</h2>
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setForm({ ...empty, sort_order: rows.length + 1 });
              setOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" />
            إضافة شريك
          </button>
        </div>

        <DataTable<Row>
          rows={rows}
          searchPlaceholder="بحث باسم الشريك"
          dragLabel="شريك"
          emptyState={
            <EmptyState
              text="لا يوجد شركاء مضافون"
              hint="اضغط «إضافة شريك» وأدخل اسمه ورابط شعاره."
            />
          }
          columns={[
            {
              header: "الشعار",
              cell: (r) =>
                r.logo_url ? (
                  <span className="grid h-14 w-20 place-items-center rounded-xl bg-muted/60 p-2"><img src={r.logo_url} alt={r.name} className="max-h-full w-auto object-contain" /></span>
                ) : (
                  "—"
                ),
            },
            { header: "الشريك", cell: (r) => r.name, className: "font-semibold" },
            {
              header: "الرابط",
              cell: (r) =>
                r.website_url ? (
                  <a
                    href={r.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="text-primary hover:underline"
                  >
                    {r.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
                  </a>
                ) : (
                  "—"
                ),
            },
            { header: "الترتيب", cell: (r) => r.sort_order ?? 0, value: (r) => r.sort_order ?? 0 },
            {
              header: "الحالة",
              cell: (r) => (
                <button type="button" onClick={() => toggleActive.mutate(r)} className={`inline-flex items-center gap-2 rounded-full px-1 py-1 pe-3 text-[12px] font-bold ${r.is_active ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
                  <span className={`relative h-6 w-11 rounded-full transition-colors ${r.is_active ? "bg-success" : "bg-border"}`}>
                    <span className={`absolute top-0.5 size-5 rounded-full bg-card shadow transition-all ${r.is_active ? "start-0.5" : "start-[22px]"}`} />
                  </span>
                  {r.is_active ? "مفعل" : "مخفي"}
                </button>
              ),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEdit(r)} aria-label="تعديل" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted">
                    <Pencil className="size-4" /> تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`حذف الشريك «${r.name}»؟`)) remove.mutate(r.id);
                    }}
                    aria-label="حذف"
                    className="grid size-9 place-items-center rounded-xl bg-destructive/10"
                  >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {rows.some((r) => r.is_active) ? (
        <section className="surface-card space-y-4 bg-[color:var(--warning)]/[0.06] p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[color:var(--warning)]/15 text-[color:var(--warning)]"><Eye className="size-5" /></span>
            <div><h2 className="text-[17px] font-bold">كيف تظهر الشعارات في الموقع</h2><p className="text-[12px] text-muted-foreground">معاينة لطريقة عرض شعارات الشركاء في الموقع العام</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-2xl bg-card p-5 sm:grid-cols-4">
            {rows.filter((r) => r.is_active).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((r) => (
              <div key={r.id} className="grid place-items-center gap-2 text-center">
                {r.logo_url ? <img src={r.logo_url} alt={r.name} className="h-16 w-auto object-contain" /> : <span className="grid size-16 place-items-center rounded-xl bg-muted"><Handshake className="size-7 text-muted-foreground" /></span>}
                <span className="text-[13px] font-bold">{r.name}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "تعديل شريك" : "إضافة شريك"}
        subtitle="الشعار يظهر في قسم «شركاؤنا» بالموقع العام."
        footer={
          <>
            <GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
              حفظ
            </PrimaryButton>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="اسم الشريك">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="الترتيب">
            <input
              type="number"
              className={inputClass}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            />
          </Field>
          <Field label="رابط الشعار">
            <input
              dir="ltr"
              className={inputClass}
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            />
          </Field>
          <Field label="رابط الشريك">
            <input
              dir="ltr"
              className={inputClass}
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="نبذة">
              <textarea
                className={textareaClass}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            ظاهر في الموقع
          </label>
        </div>
      </Modal>
    </>
  );
}
