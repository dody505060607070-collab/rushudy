import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, Clock3, Loader2, Plus, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate } from "@/components/kit/LiveTable";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { ReservationStatusLegend } from "@/components/kit/StatusLegend";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { reservationStatusLabels } from "@/lib/labels";
import {
  cancelReservation,
  convertReservation,
  createReservation,
  expireReservations,
  extendReservation,
} from "@/lib/reservations.functions";
import { reservationTone, toneRowClass } from "@/lib/status-tone";

type Row = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  extended_count: number;
  notes: string | null;
  property_id: string | null;
  employee_id: string | null;
  contact_id: string | null;
  created_by: string | null;
  created_at: string;
  creator: { full_name: string } | null;
  properties: { name: string; code: string | null } | null;
  employee: { full_name: string } | null;
  contact: { full_name: string } | null;
};

type DurationHours = 24 | 48 | 72 | 168;

const durationOptions: { value: DurationHours; label: string }[] = [
  { value: 24, label: "24 ساعة" },
  { value: 48, label: "48 ساعة" },
  { value: 72, label: "3 أيام" },
  { value: 168, label: "أسبوع" },
];

const emptyForm = {
  property_id: "",
  employee_id: "",
  contact_id: "",
  duration_hours: 24 as DurationHours,
  notes: "",
};

export const Route = createFileRoute("/_authenticated/reservations")({
  validateSearch: (search: Record<string, unknown>) => ({
    newReservation: search["newReservation"] === true || search["newReservation"] === "true",
  }),
  head: () => ({
    meta: [
      { title: "إدارة الحجوزات | الرشودي للعقارات" },
      { name: "description", content: "إنشاء وتمديد وإلغاء حجوزات الموظفين وتحويلها إلى عقود." },
      { property: "og:title", content: "إدارة الحجوزات | الرشودي للعقارات" },
      { property: "og:description", content: "حجوزات العقارات ومدتها وحالتها وتحويلها للعقود." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReservationsPage,
});

function errorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("RESERVATION_CONFLICT")) return "العقار محجوز بالفعل في هذه المدة";
  if (message.includes("RESERVATION_NOT_ACTIVE")) return "الحجز منتهي أو لم يعد نشطًا";
  if (message.includes("RESERVATION_INVALID_DURATION")) return "مدة الحجز غير صحيحة";
  return message;
}

function ReservationsPage() {
  const { newReservation } = Route.useSearch();
  const { userId, roles, isSuperAdmin, loading: authLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(newReservation);
  const [form, setForm] = useState(emptyForm);
  const isStaff = isSuperAdmin || roles.includes("employee");
  const canView = isStaff;
  const canBook = isStaff;

  useEffect(() => {
    if (userId && !form.employee_id) setForm((current) => ({ ...current, employee_id: userId }));
  }, [form.employee_id, userId]);

  const query = useQuery({
    queryKey: ["reservations"],
    enabled: canView,
    queryFn: async () => {
      if (canBook) await expireReservations();
      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id,status,starts_at,ends_at,extended_count,notes,property_id,employee_id,contact_id,created_by,created_at,properties:property_id(name,code),employee:employee_id(full_name),contact:contact_id(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const creatorIds = Array.from(
        new Set(
          (data ?? []).map((row) => row.created_by).filter((id): id is string => Boolean(id)),
        ),
      );
      const creators = creatorIds.length
        ? await supabase.from("profiles").select("id,full_name").in("id", creatorIds)
        : { data: [], error: null };
      if (creators.error) throw creators.error;
      const creatorNames = new Map(
        (creators.data ?? []).map((profile) => [profile.id, profile.full_name]),
      );
      return (data ?? []).map((row) => ({
        ...row,
        creator: row.created_by ? { full_name: creatorNames.get(row.created_by) ?? "—" } : null,
      })) as Row[];
    },
  });

  const [picker, setPicker] = useState(false);

  // معرض الإعلانات: نفس شكل الموقع العام لاختيار العقار المراد حجزه.
  const gallery = useQuery({
    queryKey: ["reservation-gallery"],
    enabled: canBook && picker,
    queryFn: async () => {
      const [properties, activeReservations] = await Promise.all([
        supabase
          .from("properties")
          .select(
            "id,name,code,city,district,purpose,price_text,price_value,property_images(url,is_cover,sort_order)",
          )
          .eq("status", "available")
          .order("name")
          .limit(200),
        supabase
          .from("reservations")
          .select("property_id")
          .in("status", ["hold", "active"])
          .gt("ends_at", new Date().toISOString()),
      ]);
      if (properties.error) throw properties.error;
      if (activeReservations.error) throw activeReservations.error;
      const reserved = new Set((activeReservations.data ?? []).map((row) => row.property_id));
      return (properties.data ?? []).filter((row) => !reserved.has(row.id));
    },
  });

  const options = useQuery({
    queryKey: ["reservation-options"],
    enabled: canBook,
    queryFn: async () => {
      const [properties, staff, contacts, activeReservations] = await Promise.all([
        supabase.from("properties").select("id,name,code").eq("status", "available").order("name"),
        supabase.from("profiles").select("id,full_name").eq("is_active", true).order("full_name"),
        supabase.from("contacts").select("id,full_name").order("full_name").limit(500),
        supabase
          .from("reservations")
          .select("property_id")
          .in("status", ["hold", "active"])
          .gt("ends_at", new Date().toISOString()),
      ]);
      for (const result of [properties, staff, contacts, activeReservations])
        if (result.error) throw result.error;
      const reservedPropertyIds = new Set(
        (activeReservations.data ?? []).map((row) => row.property_id),
      );
      return {
        properties: (properties.data ?? []).filter(
          (property) => !reservedPropertyIds.has(property.id),
        ),
        staff: staff.data ?? [],
        contacts: contacts.data ?? [],
      };
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["reservations"] });
    void queryClient.invalidateQueries({ queryKey: ["properties"] });
    void queryClient.invalidateQueries({ queryKey: ["reservation-options"] });
    void queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!form.property_id || !form.employee_id) throw new Error("اختر العقار والموظف");
      return createReservation({
        data: {
          propertyId: form.property_id,
          employeeId: form.employee_id,
          contactId: form.contact_id || null,
          durationHours: form.duration_hours,
          notes: form.notes.trim() || null,
        },
      });
    },
    onSuccess: () => {
      refresh();
      setOpen(false);
      setForm({ ...emptyForm, employee_id: userId ?? "" });
      toast.success(
        `تم حجز العقار لمدة ${durationOptions.find((item) => item.value === form.duration_hours)?.label ?? "24 ساعة"}`,
      );
    },
    onError: (error) => toast.error(errorMessage(error, "تعذّر الحجز")),
  });

  const update = useMutation({
    mutationFn: async ({ row, action }: { row: Row; action: "extend" | "cancel" | "approve" }) => {
      if (action === "extend") {
        await extendReservation({ data: { reservationId: row.id } });
        return { action, contractId: null as string | null };
      }
      if (action === "cancel") {
        await cancelReservation({ data: { reservationId: row.id } });
        return { action, contractId: null as string | null };
      }
      const result = await convertReservation({ data: { reservationId: row.id } });
      return { action, contractId: result.contractId };
    },
    onSuccess: ({ action, contractId }) => {
      refresh();
      toast.success(
        action === "extend"
          ? "تم تمديد الحجز 24 ساعة"
          : action === "cancel"
            ? "تم إلغاء الحجز"
            : "تم إنشاء مسودة العقد من الحجز",
      );
      if (contractId) void navigate({ to: "/contracts/$contractId", params: { contractId } });
    },
    onError: (error) => toast.error(errorMessage(error, "تعذّر تحديث الحجز")),
  });

  if (authLoading) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-[13px] text-muted-foreground">جاري التحقق من الصلاحية…</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <EmptyState
        text="لا تملك صلاحية عرض الحجوزات"
        hint="اطلب من مدير النظام منحك صلاحية الحجوزات."
      />
    );
  }

  const rows = query.data ?? [];
  const active = rows.filter((row) => ["hold", "active"].includes(row.status));

  return (
    <>
      <PageHero
        title="إدارة الحجوزات"
        subtitle="حجز العقارات بمدة محددة، مع منع التعارض والتمديد أو التحويل إلى عقد."
        icon={CalendarClock}
        stats={[
          { value: String(active.length), label: "حجز نشط" },
          {
            value: String(rows.filter((row) => row.status === "converted").length),
            label: "تحولت لعقود",
          },
          {
            value: String(rows.filter((row) => row.status === "expired").length),
            label: "حجز منتهي",
          },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReservationStatusLegend />
        {canBook ? (
          <Button onClick={() => setPicker(true)}>
            <Plus />
            حجز جديد
          </Button>
        ) : null}
      </div>

      {query.isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري تحميل الحجوزات…</p>
        </div>
      ) : (
        <DataTable<Row>
          rows={rows}
          rowClassName={(row) => toneRowClass[reservationTone(row.status)]}
          exportFileName="قائمة الحجوزات"
          searchPlaceholder="بحث بالعقار أو الموظف أو العميل"
          emptyState={
            <EmptyState text="لا توجد حجوزات" hint="أنشئ حجزًا جديدًا ليظهر هنا مع حالته ومدته." />
          }
          columns={[
            {
              header: "العقار",
              value: (row) => row.properties?.name,
              cell: (row) => row.properties?.name ?? "—",
              className: "font-semibold",
            },
            {
              header: "الكود",
              value: (row) => row.properties?.code,
              cell: (row) => row.properties?.code ?? "—",
            },
            {
              header: "الموظف",
              value: (row) => row.employee?.full_name,
              cell: (row) => row.employee?.full_name ?? "—",
            },
            {
              header: "العميل",
              value: (row) => row.contact?.full_name,
              cell: (row) => row.contact?.full_name ?? "—",
            },
            {
              header: "بواسطة",
              value: (row) => row.creator?.full_name,
              cell: (row) => row.creator?.full_name ?? "—",
            },
            {
              header: "أُنشئ",
              value: (row) => row.created_at,
              cell: (row) => formatDate(row.created_at),
            },
            {
              header: "ينتهي",
              value: (row) => row.ends_at,
              cell: (row) => formatDate(row.ends_at),
            },
            { header: "التمديد", cell: (row) => row.extended_count },
            {
              header: "الحالة",
              value: (row) => reservationStatusLabels[row.status] ?? row.status,
              cell: (row) => {
                const tone = reservationTone(row.status);
                return <Chip tone={tone}>{reservationStatusLabels[row.status] ?? row.status}</Chip>;
              },
            },
            {
              header: "إجراءات",
              cell: (row) =>
                canBook && ["hold", "active"].includes(row.status) ? (
                  <span className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => update.mutate({ row, action: "extend" })}
                      disabled={update.isPending}
                    >
                      <Clock3 />
                      تمديد 24س
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => update.mutate({ row, action: "approve" })}
                      disabled={update.isPending}
                    >
                      <CheckCircle2 />
                      تحويل لعقد
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => update.mutate({ row, action: "cancel" })}
                      disabled={update.isPending}
                    >
                      <XCircle />
                      إلغاء
                    </Button>
                  </span>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="حجز عقار جديد"
        subtitle="لن يقبل النظام حجزًا متعارضًا على نفس العقار."
        footer={
          <>
            <PrimaryButton onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              تأكيد الحجز
            </PrimaryButton>
            <GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="العقار" required className="sm:col-span-2">
            <select
              className={inputClass}
              value={form.property_id}
              onChange={(event) =>
                setForm((current) => ({ ...current, property_id: event.target.value }))
              }
            >
              <option value="">اختر العقار</option>
              {options.data?.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.code} — {property.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الموظف" required>
            <select
              className={inputClass}
              value={form.employee_id}
              onChange={(event) =>
                setForm((current) => ({ ...current, employee_id: event.target.value }))
              }
            >
              <option value="">اختر الموظف</option>
              {options.data?.staff.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="مدة الحجز" required>
            <select
              className={inputClass}
              value={form.duration_hours}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  duration_hours: Number(event.target.value) as DurationHours,
                }))
              }
            >
              {durationOptions.map((duration) => (
                <option key={duration.value} value={duration.value}>
                  {duration.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="العميل" className="sm:col-span-2">
            <select
              className={inputClass}
              value={form.contact_id}
              onChange={(event) =>
                setForm((current) => ({ ...current, contact_id: event.target.value }))
              }
            >
              <option value="">بدون عميل</option>
              {options.data?.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ملاحظات" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={picker}
        onClose={() => setPicker(false)}
        title="اختر العقار من الإعلانات"
        subtitle="تصفح الإعلانات كما يراها العميل، ثم اختر العقار لإتمام الحجز."
        footer={<GhostButton onClick={() => setPicker(false)}>إغلاق</GhostButton>}
      >
        {gallery.isLoading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : !gallery.data?.length ? (
          <EmptyState
            text="لا توجد عقارات متاحة للحجز"
            hint="كل العقارات محجوزة أو غير متاحة حاليًا."
          />
        ) : (
          <div className="grid max-h-[65vh] gap-4 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.data.map((property) => {
              const image = [...(property.property_images ?? [])].sort(
                (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
              )[0]?.url;
              const price =
                property.price_text ??
                (property.price_value
                  ? `${Number(property.price_value).toLocaleString("ar-SA")} ريال`
                  : "السعر عند الطلب");
              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => {
                    setForm((current) => ({ ...current, property_id: property.id }));
                    setPicker(false);
                    setOpen(true);
                  }}
                  className="overflow-hidden rounded-xl border border-border bg-card text-start transition-shadow hover:shadow-card"
                >
                  <div className="h-36 bg-muted">
                    {image ? (
                      <img
                        src={image}
                        alt={property.name}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-1 text-[13.5px] font-bold text-foreground">
                      {property.name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {[property.district, property.city].filter(Boolean).join(" — ") ||
                        property.code}
                    </p>
                    <p className="text-[13px] font-bold text-primary">{price}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
