import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, DoorOpen, Eye, EyeOff, Layers, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { EmptyState } from "@/components/kit/EmptyState";
import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Toggle } from "@/components/kit/Toggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/buildings")({
  head: () => ({
    meta: [
      { title: "العمارات | الرشودي للعقارات" },
      { name: "description", content: "إنشاء العمارات وتقسيمها إلى أدوار وشقق وعرضها على الموقع." },
      { property: "og:title", content: "العمارات | الرشودي للعقارات" },
      { property: "og:description", content: "إدارة العمارات والأدوار والشقق التابعة لها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuildingsPage,
});

type BuildingRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  district: string | null;
  address: string | null;
  description: string | null;
  purpose: string;
  floors_count: number | null;
  cover_url: string | null;
  is_visible: boolean;
  sort_order: number;
  owner_id: string | null;
};

type UnitProperty = {
  id: string;
  code: string | null;
  name: string;
  floor: string | null;
  status: string;
  is_visible: boolean;
  price_value: number | null;
  building_id: string | null;
};

type FormState = {
  name: string;
  code: string;
  purpose: string;
  city: string;
  district: string;
  address: string;
  description: string;
  cover_url: string;
  floors_count: string;
  sort_order: string;
  owner_id: string;
  is_visible: boolean;
};

const emptyForm: FormState = {
  name: "",
  code: "",
  purpose: "rent",
  city: "بريدة",
  district: "",
  address: "",
  description: "",
  cover_url: "",
  floors_count: "4",
  sort_order: "0",
  owner_id: "",
  is_visible: true,
};

function BuildingsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BuildingRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [generatorFor, setGeneratorFor] = useState<BuildingRow | null>(null);

  const buildings = useQuery({
    queryKey: ["buildings", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buildings")
        .select("id, code, name, city, district, address, description, purpose, floors_count, cover_url, is_visible, sort_order, owner_id")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BuildingRow[];
    },
  });

  const units = useQuery({
    queryKey: ["building-units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, code, name, floor, status, is_visible, price_value, building_id")
        .not("building_id", "is", null)
        .order("floor")
        .order("name");
      if (error) throw error;
      return (data ?? []) as UnitProperty[];
    },
  });

  const owners = useQuery({
    queryKey: ["contacts", "owners", "buildings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name")
        .order("full_name")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  const unitsByBuilding = useMemo(() => {
    const map = new Map<string, UnitProperty[]>();
    for (const u of units.data ?? []) {
      if (!u.building_id) continue;
      map.set(u.building_id, [...(map.get(u.building_id) ?? []), u]);
    }
    return map;
  }, [units.data]);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: BuildingRow) => {
    setEditing(row);
    setForm({
      name: row.name ?? "",
      code: row.code ?? "",
      purpose: row.purpose ?? "rent",
      city: row.city ?? "",
      district: row.district ?? "",
      address: row.address ?? "",
      description: row.description ?? "",
      cover_url: row.cover_url ?? "",
      floors_count: row.floors_count != null ? String(row.floors_count) : "",
      sort_order: String(row.sort_order ?? 0),
      owner_id: row.owner_id ?? "",
      is_visible: row.is_visible,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("اسم العمارة مطلوب");
      const values = {
        name: form.name.trim(),
        code: form.code.trim() || `B-${Date.now().toString(36).toUpperCase()}`,
        purpose: form.purpose,
        city: form.city.trim() || null,
        district: form.district.trim() || null,
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        cover_url: form.cover_url.trim() || null,
        floors_count: form.floors_count ? Number(form.floors_count) : null,
        sort_order: Number(form.sort_order) || 0,
        owner_id: form.owner_id || null,
        is_visible: form.is_visible,
      };
      const res = editing
        ? await supabase.from("buildings").update(values).eq("id", editing.id)
        : await supabase.from("buildings").insert(values);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success(editing ? "تم تحديث العمارة" : "تمت إضافة العمارة");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["buildings", "admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleVisible = useMutation({
    mutationFn: async (row: BuildingRow) => {
      const { error } = await supabase.from("buildings").update({ is_visible: !row.is_visible }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["buildings", "admin"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: BuildingRow) => {
      const { error } = await supabase.from("buildings").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف العمارة");
      void qc.invalidateQueries({ queryKey: ["buildings", "admin"] });
      void qc.invalidateQueries({ queryKey: ["building-units"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = buildings.data ?? [];

  return (
    <>
      <PageHero
        title="العمارات"
        subtitle="أنشئ عمارة، وزّع شققها على الأدوار، واعرضها على الموقع بضغطة واحدة."
        icon={Building2}
        stats={[
          { value: String(rows.length), label: "عمارة" },
          { value: String((units.data ?? []).length), label: "شقة" },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={openCreate}>
          <Plus className="size-4" /> إضافة عمارة
        </PrimaryButton>
        <Link to="/properties" className="text-[13px] font-semibold text-primary hover:underline">
          الانتقال لإدارة العقارات
        </Link>
      </div>

      {buildings.isLoading ? (
        <div className="grid gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState icon={Building2} title="لا توجد عمارات بعد" description="ابدأ بإضافة عمارة ثم وزّع شققها على الأدوار." />
      ) : (
        <div className="grid w-full gap-4">
          {rows.map((b) => {
            const list = unitsByBuilding.get(b.id) ?? [];
            const floors = new Map<string, UnitProperty[]>();
            for (const u of list) {
              const key = (u.floor ?? "").trim() || "بدون دور";
              floors.set(key, [...(floors.get(key) ?? []), u]);
            }
            return (
              <article key={b.id} className="surface-card w-full overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-[15px] font-bold text-foreground">
                      <Building2 className="size-4 text-primary" /> {b.name}
                      <span className="text-[12px] font-normal text-muted-foreground" dir="ltr">
                        {b.code}
                      </span>
                    </h2>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {[b.district, b.city, b.address].filter(Boolean).join(" — ") || "بدون عنوان"} •{" "}
                      {(b.floors_count ?? floors.size).toLocaleString("ar-SA")} أدوار •{" "}
                      {list.length.toLocaleString("ar-SA")} شقة
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={b.is_visible ? "success" : "neutral"}>{b.is_visible ? "معروضة" : "مخفية"}</Chip>
                    <button
                      type="button"
                      onClick={() => toggleVisible.mutate(b)}
                      className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                      title={b.is_visible ? "إخفاء من الموقع" : "عرض على الموقع"}
                    >
                      {b.is_visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeneratorFor(b)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-semibold text-foreground hover:bg-muted"
                    >
                      <Sparkles className="size-4 text-primary" /> توليد الشقق
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(b)}
                      className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                      title="تعديل"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`حذف العمارة «${b.name}»؟ الشقق لن تُحذف لكنها ستفقد ارتباطها.`)) remove.mutate(b);
                      }}
                      className="grid size-9 place-items-center rounded-lg border border-border text-destructive hover:bg-destructive/10"
                      title="حذف"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </header>

                <div className="space-y-4 p-4">
                  {!list.length ? (
                    <p className="text-[13px] text-muted-foreground">لا توجد شقق بعد — استخدم «توليد الشقق».</p>
                  ) : (
                    [...floors.entries()]
                      .sort((a, b2) => a[0].localeCompare(b2[0], "ar", { numeric: true }))
                      .map(([floor, items]) => (
                        <div key={floor} className="space-y-2">
                          <p className="flex items-center gap-2 text-[13px] font-bold text-foreground">
                            <Layers className="size-4 text-primary" /> {floor}
                            <span className="text-[11.5px] font-normal text-muted-foreground">
                              {items.length.toLocaleString("ar-SA")} شقة
                            </span>
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {items.map((u) => (
                              <Link
                                key={u.id}
                                to="/property-form"
                                search={{ id: u.id }}
                                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-[12.5px] transition-colors hover:bg-muted"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <DoorOpen className="size-4 shrink-0 text-primary/70" />
                                  <span className="truncate font-semibold text-foreground">{u.name}</span>
                                </span>
                                <Chip tone={u.is_visible ? "success" : "neutral"}>
                                  {u.is_visible ? "معروضة" : "مخفية"}
                                </Chip>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "تعديل العمارة" : "إضافة عمارة"}
        subtitle="بيانات العمارة الأساسية وطريقة ظهورها على الموقع."
        wide
        footer={
          <>
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} حفظ
            </PrimaryButton>
            <GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم العمارة" required>
            <input className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="كود العمارة" hint="يُستخدم في رابط العمارة على الموقع">
            <input className={inputClass} dir="ltr" value={form.code} onChange={(e) => set({ code: e.target.value })} />
          </Field>
          <Field label="الغرض">
            <select className={inputClass} value={form.purpose} onChange={(e) => set({ purpose: e.target.value })}>
              <option value="rent">إيجار</option>
              <option value="sale">بيع</option>
            </select>
          </Field>
          <Field label="المالك">
            <select className={inputClass} value={form.owner_id} onChange={(e) => set({ owner_id: e.target.value })}>
              <option value="">بدون مالك</option>
              {(owners.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المدينة">
            <input className={inputClass} value={form.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="الحي">
            <input className={inputClass} value={form.district} onChange={(e) => set({ district: e.target.value })} />
          </Field>
          <Field label="العنوان التفصيلي" className="sm:col-span-2">
            <input className={inputClass} value={form.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="عدد الأدوار">
            <input
              type="number"
              className={inputClass}
              value={form.floors_count}
              onChange={(e) => set({ floors_count: e.target.value })}
            />
          </Field>
          <Field label="ترتيب العرض">
            <input
              type="number"
              className={inputClass}
              value={form.sort_order}
              onChange={(e) => set({ sort_order: e.target.value })}
            />
          </Field>
          <Field label="رابط صورة الغلاف" className="sm:col-span-2" hint="اتركه فارغًا لاستخدام صورة أول شقة">
            <input className={inputClass} dir="ltr" value={form.cover_url} onChange={(e) => set({ cover_url: e.target.value })} />
          </Field>
          <Field label="وصف العمارة" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          <Toggle
            label="عرض العمارة على الموقع"
            checked={form.is_visible}
            onChange={(v) => set({ is_visible: v })}
          />
        </div>
      </Modal>

      <GeneratorModal
        building={generatorFor}
        onClose={() => setGeneratorFor(null)}
        onDone={() => {
          setGeneratorFor(null);
          void qc.invalidateQueries({ queryKey: ["building-units"] });
          void qc.invalidateQueries({ queryKey: ["properties"] });
        }}
      />
    </>
  );
}

/** توليد شقق العمارة: عدد الأدوار × عدد الشقق في الدور. */
function GeneratorModal({
  building,
  onClose,
  onDone,
}: {
  building: BuildingRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [floors, setFloors] = useState("4");
  const [perFloor, setPerFloor] = useState("4");
  const [startFloor, setStartFloor] = useState("1");
  const [price, setPrice] = useState("");
  const [visible, setVisible] = useState(false);

  const generate = useMutation({
    mutationFn: async () => {
      if (!building) return 0;
      const floorsCount = Math.max(1, Math.min(Number(floors) || 1, 40));
      const per = Math.max(1, Math.min(Number(perFloor) || 1, 40));
      const start = Number(startFloor) || 1;
      const priceValue = price ? Number(price) : null;

      const unitsPayload: Record<string, unknown>[] = [];
      const meta: { floorLabel: string; unitNumber: string }[] = [];
      for (let f = 0; f < floorsCount; f += 1) {
        const floorNo = start + f;
        const floorLabel = `الدور ${floorNo}`;
        for (let u = 1; u <= per; u += 1) {
          const unitNumber = `${floorNo}${String(u).padStart(2, "0")}`;
          meta.push({ floorLabel, unitNumber });
          unitsPayload.push({
            building_id: building.id,
            owner_id: building.owner_id,
            unit_number: unitNumber,
            unit_type: "شقة",
            floor: floorLabel,
            status: "available",
            is_rentable: building.purpose === "rent",
          });
        }
      }

      const insertedUnits = await supabase.from("units").insert(unitsPayload).select("id, unit_number");
      if (insertedUnits.error) throw insertedUnits.error;
      const unitIdByNumber = new Map((insertedUnits.data ?? []).map((u) => [u.unit_number, u.id]));

      const propsPayload = meta.map((m) => ({
        code: `${building.code}-${m.unitNumber}`,
        name: `شقة ${m.unitNumber} — ${m.floorLabel}`,
        purpose: building.purpose,
        property_type: "شقة",
        city: building.city,
        district: building.district,
        building_id: building.id,
        unit_id: unitIdByNumber.get(m.unitNumber) ?? null,
        owner_id: building.owner_id,
        floor: m.floorLabel,
        price_value: priceValue,
        status: "available",
        is_visible: visible,
      }));

      const insertedProps = await supabase.from("properties").insert(propsPayload).select("id");
      if (insertedProps.error) throw insertedProps.error;
      return (insertedProps.data ?? []).length;
    },
    onSuccess: (count) => {
      toast.success(`تم إنشاء ${count} شقة`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      open={Boolean(building)}
      onClose={onClose}
      title={`توليد شقق ${building?.name ?? ""}`}
      subtitle="حدد عدد الأدوار وعدد الشقق في كل دور، وسيتم إنشاؤها جاهزة للتعديل."
      footer={
        <>
          <PrimaryButton onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : null} توليد
          </PrimaryButton>
          <GhostButton onClick={onClose}>إلغاء</GhostButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="عدد الأدوار" required>
          <input type="number" className={inputClass} value={floors} onChange={(e) => setFloors(e.target.value)} />
        </Field>
        <Field label="عدد الشقق في الدور" required>
          <input type="number" className={inputClass} value={perFloor} onChange={(e) => setPerFloor(e.target.value)} />
        </Field>
        <Field label="أول دور" hint="مثلاً 1 للدور الأول">
          <input type="number" className={inputClass} value={startFloor} onChange={(e) => setStartFloor(e.target.value)} />
        </Field>
        <Field label="سعر مبدئي لكل شقة (ريال)">
          <input type="number" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Toggle label="عرض الشقق على الموقع فورًا" checked={visible} onChange={setVisible} />
      </div>
    </Modal>
  );
}
