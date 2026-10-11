import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, Eye, GripVertical, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate, useTableRows } from "@/components/kit/LiveTable";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Toggle } from "@/components/kit/Toggle";
import { supabase } from "@/integrations/supabase/client";
import { describeDbError } from "@/lib/db-errors";
import { deleteOwners } from "@/lib/delete-helpers";

type Row = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  national_id: string | null;
  address: string | null;
  notes: string | null;
  roles: string[] | null;
  is_active: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/owners/")({
  head: () => ({
    meta: [
      { title: "الملاك | الرشودي للعقارات" },
      { name: "description", content: "سجل الملاك وبيانات التواصل والعقارات والعقود المرتبطة بهم." },
      { property: "og:title", content: "الملاك | الرشودي للعقارات" },
      { property: "og:description", content: "سجل الملاك وبيانات التواصل والعقارات المرتبطة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnersPage,
});

const SELECT =
  "id, full_name, phone, whatsapp, email, national_id, address, notes, roles, is_active, created_at";

type FormState = {
  full_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  national_id: string;
  address: string;
  notes: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  full_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  national_id: "",
  address: "",
  notes: "",
  is_active: true,
};

function OwnersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ rows: Row[]; clear?: (() => void) | undefined } | null>(null);
  const [withContracts, setWithContracts] = useState(true);
  const [kind, setKind] = useState<"all" | "rent" | "sale">("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<"rent" | "sale" | null>(null);

  const { data, isLoading } = useTableRows<Row>({
    table: "contacts",
    select: SELECT,
    filter: (q) => q.contains("roles", ["owner"]),
    orderBy: { column: "created_at" },
    queryKey: ["contacts", "owners"],
  });

  const links = useQuery({
    queryKey: ["owner-links"],
    queryFn: async () => {
      const [props, contracts] = await Promise.all([
        supabase.from("properties").select("owner_id"),
        supabase.from("contracts").select("owner_id, status"),
      ]);
      if (props.error) throw props.error;
      if (contracts.error) throw contracts.error;
      const properties: Record<string, number> = {};
      for (const row of props.data ?? [])
        if (row.owner_id) properties[row.owner_id] = (properties[row.owner_id] ?? 0) + 1;
      const active: Record<string, number> = {};
      for (const row of contracts.data ?? [])
        if (row.owner_id && row.status === "active")
          active[row.owner_id] = (active[row.owner_id] ?? 0) + 1;
      return { properties, active };
    },
  });

  const allRows = data ?? [];
  const isSale = (r: Row) => (r.roles ?? []).includes("sale_owner");
  const rows = kind === "all" ? allRows : allRows.filter((r) => (kind === "sale") === isSale(r));
  const saleRows = allRows.filter(isSale);
  const rentRows = allRows.filter((r) => !isSale(r));

  const moveOwner = useMutation({
    mutationFn: async ({ row, to }: { row: Row; to: "rent" | "sale" }) => {
      const base = (row.roles ?? []).filter((r) => r !== "sale_owner");
      const roles = Array.from(new Set([...base, "owner", ...(to === "sale" ? ["sale_owner"] : [])]));
      const { data: upd, error } = await supabase.from("contacts").update({ roles }).eq("id", row.id).select("id");
      if (error) throw error;
      if (!upd?.length) throw new Error("لم يتم التحديث — تحقق من الصلاحيات");
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["sale-owners"] });
      toast.success(v.to === "sale" ? `نُقل ${v.row.full_name} إلى ملاك البيع` : `نُقل ${v.row.full_name} إلى ملاك الإيجار`);
    },
    onError: (err) => toast.error(describeDbError(err, "تعذّر النقل")),
  });
  const dropTo = (to: "rent" | "sale") => {
    const row = allRows.find((r) => r.id === dragId);
    setDragId(null);
    setOverZone(null);
    if (row && isSale(row) !== (to === "sale")) moveOwner.mutate({ row, to });
  };
  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));




  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      full_name: row.full_name ?? "",
      phone: row.phone ?? "",
      whatsapp: row.whatsapp ?? "",
      email: row.email ?? "",
      national_id: row.national_id ?? "",
      address: row.address ?? "",
      notes: row.notes ?? "",
      is_active: row.is_active,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("اسم المالك مطلوب");
      const base = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        national_id: form.national_id.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        const roles = Array.from(new Set([...(editing.roles ?? []), "owner"]));
        const { error } = await supabase
          .from("contacts")
          .update({ ...base, roles })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contacts")
          .insert({ ...base, kind: "individual", roles: ["owner"] });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success(editing ? "تم تحديث بيانات المالك" : "تم إضافة المالك");
      setOpen(false);
    },
    onError: (err) => toast.error(describeDbError(err, "تعذّر الحفظ")),
  });

  const toggleActive = useMutation({
    mutationFn: async (input: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ is_active: input.value })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("تم تحديث الحالة");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const remove = useMutation({
    mutationFn: async (input: { ids: string[]; withContracts: boolean }) =>
      deleteOwners(input.ids, input.withContracts),
    onSuccess: (_d, input) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["owner-links"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success(`تم حذف ${input.ids.length} مالك`);
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const askDelete = (targets: Row[], clear?: () => void) =>
    setDeleteTarget({ rows: targets, clear });


  const stats = useMemo(
    () => ({
      all: allRows.length,
      sale: allRows.filter(isSale).length,
      rent: allRows.filter((r) => !isSale(r)).length,
    }),
    [allRows],
  );

  return (
    <>
      <PageHero
        title="الملاك"
        subtitle="إدارة بيانات الملاك وعقاراتهم وعقودهم الإيجارية"
        icon={Users}
        stats={[
          { value: String(stats.all), label: "إجمالي الملاك" },
          { value: String(stats.rent), label: "ملاك إيجار" },
          { value: String(stats.sale), label: "ملاك بيع" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/owner-form"
          search={{ id: "" }}
          className="shine inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="size-4" />
          إضافة مالك جديد
        </Link>
      </div>


      <section className="grid gap-4 md:grid-cols-2">
        {(["rent", "sale"] as const).map((zone) => {
          const list = zone === "sale" ? saleRows : rentRows;
          return (
            <div
              key={zone}
              onDragOver={(e) => { e.preventDefault(); setOverZone(zone); }}
              onDragLeave={() => setOverZone((z) => (z === zone ? null : z))}
              onDrop={(e) => { e.preventDefault(); dropTo(zone); }}
              className={`surface-card p-4 transition-colors ${overZone === zone ? "ring-2 ring-primary bg-accent" : ""}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-bold">{zone === "sale" ? "ملاك البيع" : "ملاك الإيجار"}</h2>
                <Chip tone={zone === "sale" ? "gold" : "primary"}>{list.length}</Chip>
              </div>
              <p className="mb-3 text-[11.5px] text-muted-foreground">
                {zone === "sale"
                  ? "تصلهم رسالة المتابعة كل 14 يومًا يوم الجمعة الساعة 4 العصر."
                  : "اسحب أي مالك وأفلته هنا لنقله إلى الإيجار."}
              </p>
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {list.map((r) => (
                  <li
                    key={r.id}
                    draggable
                    onDragStart={() => setDragId(r.id)}
                    onDragEnd={() => { setDragId(null); setOverZone(null); }}
                    className={`flex cursor-grab items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[13px] active:cursor-grabbing ${dragId === r.id ? "opacity-50" : ""}`}
                  >
                    <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                    <Link to="/owners/$ownerId" params={{ ownerId: r.id }} className="min-w-0 flex-1 truncate font-semibold hover:text-primary">{r.full_name}</Link>
                    <span dir="ltr" className="text-[11.5px] text-muted-foreground">{r.phone ?? ""}</span>
                    <button
                      type="button"
                      title={zone === "sale" ? "نقل إلى الإيجار" : "نقل إلى البيع"}
                      onClick={() => moveOwner.mutate({ row: r, to: zone === "sale" ? "rent" : "sale" })}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                    >
                      <ArrowLeftRight className="size-4" />
                    </button>
                  </li>
                ))}
                {!list.length ? <li className="rounded-xl border border-dashed border-border py-6 text-center text-[12px] text-muted-foreground">أفلت مالكًا هنا</li> : null}
              </ul>
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {([["all", "كل الملاك"], ["rent", "ملاك الإيجار"], ["sale", "ملاك البيع"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold ${kind === k ? "brand-tile" : "border border-border bg-card text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {isLoading ? (
        <div className="surface-card grid place-items-center px-6 py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable<Row>
          rows={rows}
          onRowClick={(r) => navigate({ to: "/owners/$ownerId", params: { ownerId: r.id } })}
          selectable
          showColumnsButton
          draggableRows
          dragLabel="مالك"
          exportFileName="قائمة الملاك"
          bulkActions={(selectedRows, clear) => (
            <button
              type="button"
              onClick={() => askDelete(selectedRows, clear)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-destructive px-3 text-[12.5px] font-semibold text-destructive-foreground"
            >
              <Trash2 className="size-4" />
              حذف المحدد ({selectedRows.length})
            </button>
          )}
          searchPlaceholder="بحث بالاسم أو الجوال أو الهوية"
          emptyState={
            <EmptyState
              text="لا يوجد ملاك مسجلون"
              hint="أضِف مالكًا جديدًا أو حوّل أحد مقدمي الطلبات إلى مالك."
            />
          }
          columns={[
            {
              header: "المالك",
              sortable: true,
              value: (r) => r.full_name,
              cell: (r) => (
                <Link
                  to="/owners/$ownerId"
                  params={{ ownerId: r.id }}
                  className="font-bold text-primary hover:underline"
                >
                  {r.full_name}
                </Link>
              ),
              className: "font-semibold",
            },
            {
              header: "النوع",
              value: (r) => (isSale(r) ? "بيع" : "إيجار"),
              cell: (r) => <Chip tone={isSale(r) ? "gold" : "primary"}>{isSale(r) ? "مالك بيع" : "مالك إيجار"}</Chip>,
            },
            { header: "رقم الهوية / السجل", cell: (r) => <span dir="ltr">{r.national_id ?? "—"}</span> },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone ?? "—"}</span> },
            {
              header: "العقارات",
              sortable: true,
              value: (r) => links.data?.properties[r.id] ?? 0,
              cell: (r) => String(links.data?.properties[r.id] ?? 0),
            },
            {
              header: "عقود سارية",
              sortable: true,
              value: (r) => links.data?.active[r.id] ?? 0,
              cell: (r) => (
                <Chip tone={(links.data?.active[r.id] ?? 0) > 0 ? "success" : "neutral"}>
                  {links.data?.active[r.id] ?? 0}
                </Chip>
              ),
            },
            {
              header: "الحالة",
              cell: (r) => (
                <Toggle
                  label={`تفعيل ${r.full_name}`}
                  checked={r.is_active}
                  disabled={toggleActive.isPending}
                  onChange={(value) => toggleActive.mutate({ id: r.id, value })}
                />
              ),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <div className="flex items-center gap-1">
                  <Link
                    to="/owners/$ownerId"
                    params={{ ownerId: r.id }}
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                    aria-label={`عرض ${r.full_name}`}
                    title="عرض الملف الكامل"
                  >
                    <Eye className="size-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                    aria-label={`تعديل ${r.full_name}`}
                    title="تعديل"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => askDelete([r])}
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`حذف ${r.full_name}`}
                    title="حذف المالك"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        title={editing ? "تعديل بيانات المالك" : "إضافة مالك جديد"}
        subtitle="تُستخدم هذه البيانات في العقارات والعقود والفواتير والتذكيرات."
        footer={
          <>
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              حفظ
            </PrimaryButton>
            <GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم الكامل" className="sm:col-span-2">
            <input
              className={inputClass}
              value={form.full_name}
              onChange={(e) => set({ full_name: e.target.value })}
            />
          </Field>
          <Field label="الجوال">
            <input
              className={inputClass}
              dir="ltr"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </Field>
          <Field label="واتساب">
            <input
              className={inputClass}
              dir="ltr"
              value={form.whatsapp}
              onChange={(e) => set({ whatsapp: e.target.value })}
            />
          </Field>
          <Field label="البريد الإلكتروني">
            <input
              className={inputClass}
              dir="ltr"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </Field>
          <Field label="رقم الهوية">
            <input
              className={inputClass}
              dir="ltr"
              value={form.national_id}
              onChange={(e) => set({ national_id: e.target.value })}
            />
          </Field>
          <Field label="العنوان" className="sm:col-span-2">
            <input
              className={inputClass}
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
            />
          </Field>
          <Field label="ملاحظات" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>
          <span className="flex items-center gap-2 text-[12.5px] font-semibold sm:col-span-2">
            <Toggle label="مالك نشط" checked={form.is_active} onChange={(v) => set({ is_active: v })} />
            مالك نشط
          </span>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={
          deleteTarget && deleteTarget.rows.length > 1
            ? `حذف ${deleteTarget.rows.length} مالك`
            : `حذف المالك ${deleteTarget?.rows[0]?.full_name ?? ""}`
        }
        subtitle="لا يمكن التراجع عن هذا الإجراء."
        footer={
          <>
            <PrimaryButton
              onClick={() => {
                if (!deleteTarget) return;
                const ids = deleteTarget.rows.map((r) => r.id);
                const clear = deleteTarget.clear;
                remove.mutate({ ids, withContracts }, { onSuccess: () => clear?.() });
              }}
              disabled={remove.isPending}
            >
              {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              تأكيد الحذف
            </PrimaryButton>
            <GhostButton onClick={() => setDeleteTarget(null)}>إلغاء</GhostButton>
          </>
        }
      >
        <div className="space-y-3 text-[13px]">
          <p className="text-muted-foreground">
            سيتم فصل عقارات ووحدات {deleteTarget && deleteTarget.rows.length > 1 ? "الملاك" : "المالك"} عن
            الملف قبل الحذف.
          </p>
          <label className="flex items-center gap-2 font-semibold">
            <Toggle
              label="حذف العقود المرتبطة"
              checked={withContracts}
              onChange={(v) => setWithContracts(v)}
            />
            حذف العقود المرتبطة بالمالك أيضًا
          </label>
          <p className="text-[12px] text-muted-foreground">
            لو أوقفت هذا الخيار سيتم الاحتفاظ بالعقود بدون مالك.
          </p>
        </div>
      </Modal>
    </>
  );
}
