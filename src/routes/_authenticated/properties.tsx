import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  ChevronLeft,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { sendPropertyToMarketer } from "@/lib/marketing.functions";

type PropertyRow = {
  id: string;
  code: string | null;
  name: string;
  purpose: string;
  property_type: string | null;
  status: string;
  price_value: number | null;
  price_text: string | null;
  city: string | null;
  district: string | null;
  description: string | null;
  map_url: string | null;
  whatsapp_number: string | null;
  is_visible: boolean;
  is_featured: boolean;
  needs_review: boolean;
  sort_order: number | null;
  created_at: string;
  building_id: string | null;
};

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({
    meta: [
      { title: "العقارات | الرشودي للعقارات" },
      { name: "description", content: "إدارة بيانات العقارات، الأسعار، الحالة والنشر على الموقع." },
      { property: "og:title", content: "العقارات | الرشودي للعقارات" },
      { property: "og:description", content: "إدارة بيانات العقارات، الأسعار، الحالة والنشر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropertiesPage,
});

const statusLabels: Record<string, string> = {
  available: "متاح",
  reserved: "محجوز",
  rented: "مؤجر",
  sold: "مبيع",
  hidden: "مخفي",
};

const SELECT =
  "id, code, name, purpose, property_type, status, price_value, price_text, city, district, description, map_url, whatsapp_number, is_visible, is_featured, needs_review, sort_order, created_at, building_id";

type FormState = {
  name: string;
  code: string;
  purpose: string;
  property_type: string;
  city: string;
  district: string;
  price_text: string;
  price_value: string;
  status: string;
  description: string;
  map_url: string;
  whatsapp_number: string;
  sort_order: string;
  is_visible: boolean;
  is_featured: boolean;
};

const emptyForm: FormState = {
  name: "",
  code: "",
  purpose: "rent",
  property_type: "",
  city: "بريدة",
  district: "",
  price_text: "",
  price_value: "",
  status: "available",
  description: "",
  map_url: "",
  whatsapp_number: "",
  sort_order: "0",
  is_visible: true,
  is_featured: false,
};

function PropertiesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [editing, setEditing] = useState<PropertyRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [shareProperty, setShareProperty] = useState<PropertyRow | null>(null);
  const [selectedMarketer, setSelectedMarketer] = useState("");
  const queryClient = useQueryClient();
  const sendToMarketer = useServerFn(sendPropertyToMarketer);
  const marketers = useQuery({
    queryKey: ["marketing-active-list"],
    queryFn: async () => {
      const { data: items, error: marketersError } = await supabase
        .from("marketers")
        .select("id, full_name, phone")
        .eq("status", "active")
        .order("full_name");
      if (marketersError) throw marketersError;
      return items ?? [];
    },
  });
  const { data, isLoading, error } = useTableRows<PropertyRow>({
    table: "properties",
    select: SELECT,
    orderBy: { column: "created_at" },
  });

  // وحدات العمارات تُدار من صفحة العمارات فقط حتى لا تختلط بقائمة العقارات المستقلة.
  const rows = (data ?? []).filter((row) => !row.building_id);
  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: PropertyRow) => {
    setEditing(row);
    setForm({
      name: row.name ?? "",
      code: row.code ?? "",
      purpose: row.purpose ?? "rent",
      property_type: row.property_type ?? "",
      city: row.city ?? "",
      district: row.district ?? "",
      price_text: row.price_text ?? "",
      price_value: row.price_value != null ? String(row.price_value) : "",
      status: row.status ?? "available",
      description: row.description ?? "",
      map_url: row.map_url ?? "",
      whatsapp_number: row.whatsapp_number ?? "",
      sort_order: String(row.sort_order ?? 0),
      is_visible: row.is_visible,
      is_featured: row.is_featured,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("اسم العقار مطلوب");
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || `P-${Date.now().toString(36).toUpperCase()}`,
        purpose: form.purpose,
        property_type: form.property_type.trim() || null,
        city: form.city.trim() || null,
        district: form.district.trim() || null,
        price_text: form.price_text.trim() || null,
        price_value: form.price_value ? Number(form.price_value) : null,
        status: form.status,
        description: form.description.trim() || null,
        map_url: form.map_url.trim() || null,
        whatsapp_number: form.whatsapp_number.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_visible: form.is_visible,
        is_featured: form.is_featured,
      };
      if (editing) {
        const { error: err } = await supabase
          .from("properties")
          .update(payload)
          .eq("id", editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("properties").insert(payload);
        if (err) throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      queryClient.invalidateQueries({ queryKey: ["public-properties"] });
      toast.success(editing ? "تم تحديث العقار" : "تم إضافة العقار وسيظهر على الموقع");
      setOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const flags = useMutation({
    mutationFn: async (input: {
      id: string;
      field: "is_visible" | "is_featured";
      value: boolean;
    }) => {
      const patch =
        input.field === "is_visible" ? { is_visible: input.value } : { is_featured: input.value };
      const { error: err } = await supabase.from("properties").update(patch).eq("id", input.id);
      if (err) throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["public-properties"] });
      toast.success("تم تحديث حالة العقار");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const statusToggle = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      const { error: err } = await supabase
        .from("properties")
        .update({ status: input.status })
        .eq("id", input.id);
      if (err) throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["public-properties"] });
      toast.success("تم تحديث حالة العقار");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await supabase.from("properties").delete().eq("id", id);
      if (err) throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["public-properties"] });
      toast.success("تم حذف العقار");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const share = useMutation({
    mutationFn: async () => {
      if (!shareProperty || !selectedMarketer) throw new Error("اختر المسوق");
      return sendToMarketer({
        data: { marketerId: selectedMarketer, propertyId: shareProperty.id },
      });
    },
    onSuccess: () => {
      toast.success("تم إرسال العقار للمسوق برابطه الخاص");
      setShareProperty(null);
      setSelectedMarketer("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر الإرسال"),
  });

  const counts = useMemo(
    () => ({
      all: rows.length,
      rent: rows.filter((r) => r.purpose !== "sale").length,
      sale: rows.filter((r) => r.purpose === "sale").length,
      visible: rows.filter((r) => r.is_visible).length,
      review: rows.filter((r) => r.needs_review).length,
    }),
    [rows],
  );

  const filtered = rows.filter((r) =>
    tab === "all" ? true : tab === "sale" ? r.purpose === "sale" : r.purpose !== "sale",
  );

  return (
    <>
      <PageHero
        title="العقارات"
        subtitle="إدارة العقارات المعروضة وبياناتها وحالة ظهورها على الموقع."
        icon={Building2}
        stats={[
          { value: String(counts.all), label: "إجمالي العقارات" },
          { value: String(counts.visible), label: "عقار ظاهر" },
          { value: String(counts.review), label: "بانتظار المراجعة" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/property-form"
            search={{ id: "" }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            إضافة عقار
          </Link>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            إضافة سريعة
          </button>
        </div>

        <nav className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
          <span className="font-semibold text-foreground">العقارات</span>
          <ChevronLeft className="size-3.5" />
          <span>القائمة</span>
        </nav>
      </div>

      <Pills
        variant="card"
        defaultKey="all"
        onChange={setTab}
        items={[
          { key: "all", label: "الكل", count: counts.all },
          { key: "rent", label: "الإيجار", count: counts.rent },
          { key: "sale", label: "البيع", count: counts.sale },
        ]}
      />

      {isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري تحميل العقارات…</p>
        </div>
      ) : error ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <TriangleAlert className="size-7 text-destructive" />
          <p className="text-[14px] font-semibold text-foreground">تعذّر تحميل العقارات</p>
          <p className="text-[12.5px] text-muted-foreground" dir="ltr">
            {error instanceof Error ? error.message : "خطأ غير معروف"}
          </p>
        </div>
      ) : (
        <DataTable<PropertyRow>
          rows={filtered}
          rowClassName={(r) =>
            r.needs_review
              ? "bg-warning/8"
              : r.status === "available"
                ? "bg-success/5"
                : r.status === "reserved"
                  ? "bg-primary/5"
                  : ""
          }
          onRowClick={(r) => navigate({ to: "/property-form", search: { id: r.id } })}
          selectable
          showColumnsButton
          draggableRows
          dragLabel="عقار"
          searchPlaceholder="بحث بالاسم أو الكود أو الحي"
          emptyState={
            <EmptyState
              text="لا توجد عقارات مسجلة"
              hint="ابدأ بإضافة عقار أو باعتماد أحد طلبات عرض العقار لتظهر هنا."
            />
          }
          columns={[
            {
              header: "العقار",
              sortable: true,
              value: (r) => r.name,
              cell: (r) => r.name,
              className: "font-semibold",
            },
            {
              header: "الكود",
              sortable: true,
              value: (r) => r.code ?? "",
              cell: (r) => r.code ?? "—",
            },
            {
              header: "النوع",
              cell: (r) => (
                <Chip tone={r.purpose === "sale" ? "success" : "warning"}>
                  {r.purpose === "sale" ? "بيع" : "إيجار"}
                </Chip>
              ),
            },
            { header: "الحي", cell: (r) => r.district ?? "—" },
            { header: "المدينة", cell: (r) => r.city ?? "—" },
            {
              header: "السعر",
              sortable: true,
              value: (r) => r.price_value ?? 0,
              cell: (r) => r.price_text ?? formatCurrency(r.price_value),
            },
            {
              header: "الحالة",
              cell: (r) => {
                const next =
                  r.status === "available" ? (r.purpose === "sale" ? "sold" : "rented") : "available";
                return (
                  <button
                    type="button"
                    title={`تحويل الحالة إلى «${statusLabels[next]}»`}
                    disabled={statusToggle.isPending}
                    onClick={(event) => {
                      event.stopPropagation();
                      statusToggle.mutate({ id: r.id, status: next });
                    }}
                  >
                    <Chip tone={r.status === "available" ? "success" : "warning"}>
                      {statusLabels[r.status] ?? r.status}
                    </Chip>
                  </button>
                );
              },
            },
            {
              header: "مرئي",
              cell: (r) => (
                <Toggle
                  label="ظهور العقار على الموقع"
                  checked={r.is_visible}
                  disabled={flags.isPending}
                  onChange={(value) => flags.mutate({ id: r.id, field: "is_visible", value })}
                />
              ),
            },
            {
              header: "مميز",
              cell: (r) => (
                <Toggle
                  label="عقار مميز"
                  checked={r.is_featured}
                  disabled={flags.isPending}
                  onChange={(value) => flags.mutate({ id: r.id, field: "is_featured", value })}
                />
              ),
            },
            {
              header: "الترتيب",
              sortable: true,
              value: (r) => r.sort_order ?? 0,
              cell: (r) => r.sort_order ?? 0,
            },
            {
              header: "تاريخ الإضافة",
              sortable: true,
              value: (r) => r.created_at,
              cell: (r) => formatDate(r.created_at),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <span className="inline-flex items-center gap-3">
                  <Link
                    to="/property-form"
                    search={{ id: r.id }}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                  >
                    <Pencil className="size-4" />
                    تعديل
                  </Link>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShareProperty(r);
                      setSelectedMarketer("");
                    }}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                  >
                    <Megaphone className="size-4" />
                    إرسال لمسوق
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="text-[12.5px] font-semibold text-muted-foreground"
                  >
                    سريع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`حذف العقار "${r.name}"؟`)) remove.mutate(r.id);
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
        title={editing ? "تعديل العقار" : "إضافة عقار جديد"}
        subtitle="البيانات المحفوظة تظهر مباشرة على الموقع العام عند تفعيل خيار «مرئي»."
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
          <Field label="اسم العقار" className="sm:col-span-2">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="مثال: شقة في حي الرحاب"
            />
          </Field>
          <Field label="الكود" hint="يُولَّد تلقائيًا إذا تُرك فارغًا">
            <input
              className={inputClass}
              value={form.code}
              onChange={(e) => set({ code: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="الغرض">
            <select
              className={inputClass}
              value={form.purpose}
              onChange={(e) => set({ purpose: e.target.value })}
            >
              <option value="rent">إيجار</option>
              <option value="sale">بيع</option>
              <option value="investment">استثمار</option>
            </select>
          </Field>
          <Field label="نوع العقار">
            <input
              className={inputClass}
              value={form.property_type}
              onChange={(e) => set({ property_type: e.target.value })}
              placeholder="شقة / فيلا / أرض"
            />
          </Field>
          <Field label="الحالة">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set({ status: e.target.value })}
            >
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المدينة">
            <input
              className={inputClass}
              value={form.city}
              onChange={(e) => set({ city: e.target.value })}
            />
          </Field>
          <Field label="الحي">
            <input
              className={inputClass}
              value={form.district}
              onChange={(e) => set({ district: e.target.value })}
            />
          </Field>
          <Field label="السعر (نص للعرض)">
            <input
              className={inputClass}
              value={form.price_text}
              onChange={(e) => set({ price_text: e.target.value })}
              placeholder="35,000 ريال سنويًا"
            />
          </Field>
          <Field label="السعر (رقم)">
            <input
              className={inputClass}
              value={form.price_value}
              onChange={(e) => set({ price_value: e.target.value })}
              inputMode="numeric"
              dir="ltr"
            />
          </Field>
          <Field label="رابط الخريطة">
            <input
              className={inputClass}
              value={form.map_url}
              onChange={(e) => set({ map_url: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="رقم واتساب للتواصل">
            <input
              className={inputClass}
              value={form.whatsapp_number}
              onChange={(e) => set({ whatsapp_number: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="ترتيب الظهور">
            <input
              className={inputClass}
              value={form.sort_order}
              onChange={(e) => set({ sort_order: e.target.value })}
              inputMode="numeric"
              dir="ltr"
            />
          </Field>
          <Field label="الوصف" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          <div className="flex items-center gap-6 sm:col-span-2">
            <span className="flex items-center gap-2 text-[12.5px] font-semibold">
              <Toggle
                label="مرئي على الموقع"
                checked={form.is_visible}
                onChange={(v) => set({ is_visible: v })}
              />
              مرئي على الموقع
            </span>
            <span className="flex items-center gap-2 text-[12.5px] font-semibold">
              <Toggle
                label="عقار مميز"
                checked={form.is_featured}
                onChange={(v) => set({ is_featured: v })}
              />
              عقار مميز
            </span>
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(shareProperty)}
        onClose={() => setShareProperty(null)}
        title="إرسال العقار لمسوق"
        subtitle={`سيُرسل «${shareProperty?.name ?? "العقار"}» عبر واتساب برابط إحالة خاص. لن يحدث أي إرسال قبل تأكيدك.`}
        footer={
          <>
            <GhostButton onClick={() => setShareProperty(null)}>إلغاء</GhostButton>
            <PrimaryButton
              onClick={() => share.mutate()}
              disabled={share.isPending || !selectedMarketer}
            >
              {share.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              إرسال الآن
            </PrimaryButton>
          </>
        }
      >
        <Field label="المسوق المستلم" required>
          <select
            className={inputClass}
            value={selectedMarketer}
            onChange={(event) => setSelectedMarketer(event.target.value)}
          >
            <option value="">اختر مسوقًا واحدًا</option>
            {(marketers.data ?? []).map((marketer) => (
              <option key={marketer.id} value={marketer.id}>
                {marketer.full_name} — {marketer.phone}
              </option>
            ))}
          </select>
        </Field>
        {(marketers.data ?? []).length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            أضف مسوقًا نشطًا من قسم التسويق العقاري أولًا.
          </p>
        ) : null}
      </Modal>
    </>
  );
}
