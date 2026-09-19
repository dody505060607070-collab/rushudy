import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Contact, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatCurrency, formatDate, useTableRows } from "@/components/kit/LiveTable";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { Toggle } from "@/components/kit/Toggle";
import { supabase } from "@/integrations/supabase/client";
import { contactRoleLabels } from "@/lib/labels";
import { getClientAccess, issueClientAccess } from "@/lib/portal.functions";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  full_name: string;
  kind: string;
  phone: string | null;
  phone_alt: string | null;
  whatsapp: string | null;
  email: string | null;
  national_id: string | null;
  address: string | null;
  roles: string[] | null;
  source: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_districts: string[] | null;
  interested_property_type: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/clients")({
  validateSearch: (search: Record<string, unknown>): { edit?: string } =>
    typeof search["edit"] === "string" ? { edit: search["edit"] } : {},
  head: () => ({
    meta: [
      { title: "العملاء | الرشودي للعقارات" },
      {
        name: "description",
        content: "قاعدة العملاء والوسطاء وبيانات التواصل والميزانيات والمتابعة.",
      },
      { property: "og:title", content: "العملاء | الرشودي للعقارات" },
      { property: "og:description", content: "إدارة كاملة لبيانات العملاء وأدوارهم وتفضيلاتهم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientsPage,
});

const SELECT =
  "id, full_name, kind, phone, phone_alt, whatsapp, email, national_id, address, roles, source, budget_min, budget_max, preferred_districts, interested_property_type, notes, is_active, created_at";

const allRoles = ["owner", "tenant", "buyer", "broker"];

type FormState = {
  full_name: string;
  kind: string;
  phone: string;
  phone_alt: string;
  whatsapp: string;
  email: string;
  national_id: string;
  address: string;
  roles: string[];
  source: string;
  budget_min: string;
  budget_max: string;
  preferred_districts: string;
  interested_property_type: string;
  notes: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  full_name: "",
  kind: "individual",
  phone: "",
  phone_alt: "",
  whatsapp: "",
  email: "",
  national_id: "",
  address: "",
  roles: ["buyer"],
  source: "",
  budget_min: "",
  budget_max: "",
  preferred_districts: "",
  interested_property_type: "",
  notes: "",
  is_active: true,
};

function ClientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isLoading } = useTableRows<Row>({
    table: "contacts",
    select: SELECT,
    orderBy: { column: "created_at" },
    queryKey: ["contacts", "all"],
  });

  const rows = data ?? [];
  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      full_name: row.full_name ?? "",
      kind: row.kind ?? "individual",
      phone: row.phone ?? "",
      phone_alt: row.phone_alt ?? "",
      whatsapp: row.whatsapp ?? "",
      email: row.email ?? "",
      national_id: row.national_id ?? "",
      address: row.address ?? "",
      roles: row.roles ?? [],
      source: row.source ?? "",
      budget_min: row.budget_min != null ? String(row.budget_min) : "",
      budget_max: row.budget_max != null ? String(row.budget_max) : "",
      preferred_districts: (row.preferred_districts ?? []).join(", "),
      interested_property_type: row.interested_property_type ?? "",
      notes: row.notes ?? "",
      is_active: row.is_active,
    });
    setOpen(true);
  };

  const { edit: editId } = Route.useSearch();
  const handledEditId = useRef<string | null>(null);
  useEffect(() => {
    if (!editId || handledEditId.current === editId) return;
    const row = rows.find((item) => item.id === editId);
    if (!row) return;
    handledEditId.current = editId;
    openEdit(row);
    void navigate({ to: "/clients", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, rows]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("اسم العميل مطلوب");
      const payload = {
        full_name: form.full_name.trim(),
        kind: form.kind,
        phone: form.phone.trim() || null,
        phone_alt: form.phone_alt.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        national_id: form.national_id.trim() || null,
        address: form.address.trim() || null,
        roles: form.roles.length ? form.roles : ["buyer"],
        source: form.source.trim() || null,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        preferred_districts: form.preferred_districts
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        interested_property_type: form.interested_property_type.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success(editing ? "تم تحديث بيانات العميل" : "تم إضافة العميل");
      setOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("تم حذف العميل");
    },
    onError: (err) =>
      toast.error(
        err instanceof Error
          ? "لا يمكن حذف عميل مرتبط بعقود أو فواتير — أوقفه بدلًا من ذلك."
          : "تعذّر الحذف",
      ),
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
      toast.success("تم تحديث حالة العميل");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const counts = useMemo(
    () => ({
      all: rows.length,
      buyer: rows.filter((r) => (r.roles ?? []).includes("buyer")).length,
      tenant: rows.filter((r) => (r.roles ?? []).includes("tenant")).length,
      broker: rows.filter((r) => (r.roles ?? []).includes("broker")).length,
    }),
    [rows],
  );

  const filtered = tab === "all" ? rows : rows.filter((r) => (r.roles ?? []).includes(tab));

  return (
    <>
      <PageHero
        title="العملاء"
        subtitle="كل جهات الاتصال في مكان واحد: ملاك، مستأجرون، مشترون ووسطاء عقود — مع بيانات التواصل والارتباطات."
        icon={Contact}
        stats={[
          { value: String(counts.all), label: "إجمالي العملاء" },
          { value: String(counts.tenant), label: "مستأجر" },
          { value: String(rows.filter((r) => r.is_active).length), label: "نشط" },
        ]}
      />

      <div className="surface-card px-5 py-4 text-[12.5px] leading-6 text-muted-foreground">
        <strong className="text-foreground">كيف يعمل هذا القسم؟</strong> المالك والمستأجر يُضافان
        تلقائيًا عند تسجيل العقد، ويمكن إضافة المشتري يدويًا. «وسيط العقد» هو الشخص المذكور في بيانات
        عقد الإيجار، ويُضاف تلقائيًا فقط إذا كان اسمه موجودًا في العقد؛ ويمكن أيضًا إضافته يدويًا عند الحاجة.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" />
          إضافة عميل
        </button>
      </div>

      <Pills
        variant="card"
        defaultKey="all"
        onChange={setTab}
        items={[
          { key: "all", label: "الكل", count: counts.all },
          { key: "buyer", label: "مشترون", count: counts.buyer },
          { key: "tenant", label: "مستأجرون", count: counts.tenant },
          { key: "broker", label: "وسطاء العقود", count: counts.broker },
        ]}
      />

      {isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable<Row>
          rows={filtered}
          selectable
          showColumnsButton
          draggableRows
          dragLabel="عميل"
          searchPlaceholder="بحث بالاسم أو الجوال أو البريد"
          emptyState={
            <EmptyState
              text="لا يوجد عملاء مسجلون"
              hint="أضِف عميلًا أو حوّل أحد طلبات التقديم إلى عميل ليظهر هنا."
            />
          }
          columns={[
            {
              header: "العميل",
              sortable: true,
              value: (r) => r.full_name,
              cell: (r) => (
                <button
                  type="button"
                  onClick={() => setDetail(r)}
                  className="font-semibold text-primary"
                >
                  {r.full_name}
                </button>
              ),
            },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone ?? "—"}</span> },
            { header: "واتساب", cell: (r) => <span dir="ltr">{r.whatsapp ?? "—"}</span> },
            { header: "البريد", cell: (r) => <span dir="ltr">{r.email ?? "—"}</span> },
            {
              header: "الأدوار",
              cell: (r) => (
                <span className="flex flex-wrap gap-1">
                  {(r.roles ?? []).filter((role) => role !== "lead").map((role) => (
                    <Chip key={role} tone="primary">
                      {contactRoleLabels[role] ?? role}
                    </Chip>
                  ))}
                </span>
              ),
            },
            { header: "المصدر", cell: (r) => r.source ?? "—" },
            {
              header: "الميزانية",
              sortable: true,
              value: (r) => r.budget_max ?? 0,
              cell: (r) =>
                r.budget_min || r.budget_max
                  ? `${formatCurrency(r.budget_min)} — ${formatCurrency(r.budget_max)}`
                  : "—",
            },
            {
              header: "نشط",
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
              header: "أُضيف",
              sortable: true,
              value: (r) => r.created_at,
              cell: (r) => formatDate(r.created_at),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <span className="inline-flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                  >
                    <Pencil className="size-4" />
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`حذف العميل "${r.full_name}"؟`)) remove.mutate(r.id);
                    }}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-destructive"
                  >
                    <Trash2 className="size-4" />
                    حذف
                  </button>
                </span>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        title={editing ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
        subtitle="الأدوار تحدد مكان ظهور العميل: المالك يظهر في قسم الملاك، والمستأجر في العقود."
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
          <Field label="النوع">
            <select
              className={inputClass}
              value={form.kind}
              onChange={(e) => set({ kind: e.target.value })}
            >
              <option value="individual">فرد</option>
              <option value="company">شركة / مؤسسة</option>
            </select>
          </Field>
          <Field label="المصدر" hint="كيف وصل إلينا؟ (الموقع، واتساب، إحالة…)">
            <input
              className={inputClass}
              value={form.source}
              onChange={(e) => set({ source: e.target.value })}
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
          <Field label="جوال بديل">
            <input
              className={inputClass}
              dir="ltr"
              value={form.phone_alt}
              onChange={(e) => set({ phone_alt: e.target.value })}
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
          <Field label="العنوان">
            <input
              className={inputClass}
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
            />
          </Field>
          <Field label="الميزانية من">
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              value={form.budget_min}
              onChange={(e) => set({ budget_min: e.target.value })}
            />
          </Field>
          <Field label="الميزانية إلى">
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              value={form.budget_max}
              onChange={(e) => set({ budget_max: e.target.value })}
            />
          </Field>
          <Field label="نوع العقار المطلوب">
            <input
              className={inputClass}
              value={form.interested_property_type}
              onChange={(e) => set({ interested_property_type: e.target.value })}
            />
          </Field>
          <Field label="الأحياء المفضّلة" hint="افصل بينها بفاصلة">
            <input
              className={inputClass}
              value={form.preferred_districts}
              onChange={(e) => set({ preferred_districts: e.target.value })}
            />
          </Field>
          <Field label="الأدوار" className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {allRoles.map((role) => {
                const active = form.roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() =>
                      set({
                        roles: active
                          ? form.roles.filter((x) => x !== role)
                          : [...form.roles, role],
                      })
                    }
                    className={cn(
                      "rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                      active ? "border-primary bg-accent/50" : "border-border hover:bg-muted",
                    )}
                  >
                    {contactRoleLabels[role] ?? role}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="ملاحظات" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>
          <span className="flex items-center gap-2 text-[12.5px] font-semibold sm:col-span-2">
            <Toggle
              label="عميل نشط"
              checked={form.is_active}
              onChange={(v) => set({ is_active: v })}
            />
            عميل نشط
          </span>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.full_name ?? ""}
        subtitle="ملف العميل الكامل"
      >
        {detail ? (
          <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
            {[
              ["الجوال", detail.phone],
              ["جوال بديل", detail.phone_alt],
              ["واتساب", detail.whatsapp],
              ["البريد", detail.email],
              ["الهوية", detail.national_id],
              ["العنوان", detail.address],
              ["المصدر", detail.source],
              ["نوع العقار المطلوب", detail.interested_property_type],
              [
                "الميزانية",
                detail.budget_min || detail.budget_max
                  ? `${formatCurrency(detail.budget_min)} — ${formatCurrency(detail.budget_max)}`
                  : null,
              ],
              ["الأحياء المفضّلة", (detail.preferred_districts ?? []).join("، ")],
              ["ملاحظات", detail.notes],
              ["أُضيف", formatDate(detail.created_at)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-border px-3 py-2">
                <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 font-semibold">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {detail ? (
          <ClientAccessPanel contactId={detail.id} phone={detail.whatsapp ?? detail.phone} />
        ) : null}
      </Modal>
    </>
  );
}

function ClientAccessPanel({ contactId, phone }: { contactId: string; phone: string | null }) {
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);
  const [manualUser, setManualUser] = useState("");
  const [manualPass, setManualPass] = useState("");

  const access = useQuery({
    queryKey: ["client-access", contactId],
    queryFn: () => getClientAccess({ data: { contactId } }),
  });

  const issue = useMutation({
    mutationFn: () =>
      issueClientAccess({
        data: {
          contactId,
          ...(manualUser.trim() ? { username: manualUser.trim() } : {}),
          ...(manualPass.trim() ? { password: manualPass.trim() } : {}),
        },
      }),
    onSuccess: (res) => {
      setIssued({ username: res.username, password: res.password });
      access.refetch();
      toast.success(res.created ? "تم إنشاء حساب العميل" : "تم تحديث بيانات الدخول");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر إصدار بيانات الدخول"),
  });

  const shown = issued;
  const waText = shown
    ? encodeURIComponent(
        `بيانات دخول بوابة العميل:\nاسم المستخدم: ${shown.username}\nكلمة المرور: ${shown.password}`,
      )
    : "";
  const waPhone = String(phone ?? "").replace(/\D/g, "");

  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <h3 className="text-[13px] font-bold text-foreground">بيانات دخول بوابة العميل</h3>
      <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
        تُنشأ تلقائيًا من العقد (اسم المستخدم = رقم الهوية، كلمة المرور = الجوال 05…). ولو العقد
        بدون هوية أو جوال يولّد النظام بيانات دخول تلقائية يمكنك تسليمها للعميل.
      </p>

      <div className="mt-3 text-[12.5px]">
        {access.isLoading ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
          </span>
        ) : access.data?.account ? (
          <p>
            اسم المستخدم الحالي: <strong dir="ltr">{access.data.account.username}</strong>
          </p>
        ) : (
          <p className="text-muted-foreground">لا يوجد حساب دخول لهذا العميل بعد.</p>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          dir="ltr"
          className={inputClass}
          placeholder={`اسم مستخدم (اختياري) ${access.data?.suggestedUsername ?? ""}`}
          value={manualUser}
          onChange={(e) => setManualUser(e.target.value)}
        />
        <input
          dir="ltr"
          className={inputClass}
          placeholder="كلمة مرور (اختياري — 6 أرقام فأكثر)"
          value={manualPass}
          onChange={(e) => setManualPass(e.target.value)}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryButton onClick={() => issue.mutate()} disabled={issue.isPending}>
          {access.data?.account ? "إعادة إصدار كلمة المرور" : "إنشاء حساب دخول"}
        </PrimaryButton>
        {shown ? (
          <>
            <GhostButton
              onClick={() => {
                void navigator.clipboard.writeText(
                  `اسم المستخدم: ${shown.username} - كلمة المرور: ${shown.password}`,
                );
                toast.success("تم نسخ بيانات الدخول");
              }}
            >
              نسخ البيانات
            </GhostButton>
            {waPhone ? (
              <a
                href={`https://wa.me/${waPhone.startsWith("0") ? `966${waPhone.slice(1)}` : waPhone}?text=${waText}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-[12.5px] font-semibold"
              >
                إرسال واتساب
              </a>
            ) : null}
          </>
        ) : null}
      </div>

      {shown ? (
        <div className="mt-3 grid gap-2 rounded-lg bg-muted p-3 text-[13px] sm:grid-cols-2">
          <div>
            <span className="text-[11.5px] text-muted-foreground">اسم المستخدم</span>
            <p dir="ltr" className="font-bold">
              {shown.username}
            </p>
          </div>
          <div>
            <span className="text-[11.5px] text-muted-foreground">كلمة المرور</span>
            <p dir="ltr" className="font-bold">
              {shown.password}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
