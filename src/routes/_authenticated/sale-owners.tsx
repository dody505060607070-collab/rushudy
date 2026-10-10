import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeDollarSign, Copy, Link2, MessageCircle, Pencil, Phone, Plus, Trash2, Unlink } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { describeDbError } from "@/lib/db-errors";

export const Route = createFileRoute("/_authenticated/sale-owners")({
  head: () => ({
    meta: [
      { title: "ملاك البيع | الرشودي للعقارات" },
      { name: "description", content: "صفحة مستقلة لملاك عقارات البيع: إضافة وتعديل وحذف وربط العقارات المعروضة للبيع." },
      { property: "og:title", content: "ملاك البيع | الرشودي للعقارات" },
      { property: "og:description", content: "إدارة ملاك عقارات البيع وعقاراتهم في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SaleOwnersPage,
});

type Owner = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  national_id: string | null;
  notes: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  roles: string[] | null;
};
type Prop = { id: string; code: string | null; name: string | null; status: string | null; price_value: number | null; owner_id: string | null; purpose: string | null; city: string | null };

const STATUS: Record<string, string> = { available: "متاح", sold: "مباع", reserved: "محجوز", rented: "مؤجر", hidden: "مخفي" };
const norm = (v: string) => v.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\s+/g, "");

const ROLE = "sale_owner";
const empty = { full_name: "", phone: "", whatsapp: "", national_id: "", notes: "", email: "", address: "" };

function SaleOwnersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [linkFor, setLinkFor] = useState<Owner | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "with" | "without" | "available" | "sold">("all");
  const [sort, setSort] = useState<"newest" | "name" | "props">("newest");

  const owners = useQuery({
    queryKey: ["sale-owners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, phone, whatsapp, national_id, notes, roles, email, address, created_at")
        .contains("roles", [ROLE])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Owner[];
    },
  });

  const props = useQuery({
    queryKey: ["sale-owner-props"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, code, name, status, price_value, owner_id, purpose, city")
        .eq("purpose", "sale")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Prop[];
    },
  });

  const byOwner = useMemo(() => {
    const m: Record<string, Prop[]> = {};
    for (const p of props.data ?? []) if (p.owner_id) (m[p.owner_id] ??= []).push(p);
    return m;
  }, [props.data]);

  const list = useMemo(() => {
    const q = norm(search.trim());
    const rows = (owners.data ?? []).filter((o) => {
      const ps = byOwner[o.id] ?? [];
      if (filter === "with" && !ps.length) return false;
      if (filter === "without" && ps.length) return false;
      if (filter === "available" && !ps.some((p) => p.status === "available")) return false;
      if (filter === "sold" && !ps.some((p) => p.status === "sold")) return false;
      if (!q) return true;
      const hay = [o.full_name, o.phone, o.whatsapp, o.national_id, o.email, ...ps.flatMap((p) => [p.code, p.name, p.city])]
        .filter(Boolean)
        .map((v) => norm(String(v)));
      return hay.some((h) => h.includes(q));
    });
    return rows.sort((a, b) =>
      sort === "name" ? a.full_name.localeCompare(b.full_name, "ar")
      : sort === "props" ? (byOwner[b.id]?.length ?? 0) - (byOwner[a.id]?.length ?? 0)
      : b.created_at.localeCompare(a.created_at),
    );
  }, [owners.data, byOwner, search, filter, sort]);
  const q = norm(search.trim());

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sale-owners"] });
    qc.invalidateQueries({ queryKey: ["sale-owner-props"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("اسم المالك مطلوب");
      const base = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || form.phone.trim() || null,
        national_id: form.national_id.trim() || null,
        notes: form.notes.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("contacts").update(base).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert({ ...base, roles: [ROLE, "owner"], is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(describeDbError(e)),
  });

  const remove = useMutation({
    mutationFn: async (o: Owner) => {
      const roles = (o.roles ?? []).filter((r) => r !== ROLE);
      const otherUse = roles.some((r) => r !== "owner");
      if (!otherUse && !(byOwner[o.id]?.length)) {
        const { error } = await supabase.from("contacts").delete().eq("id", o.id);
        if (!error) return;
      }
      // إن كان مرتبطًا بشيء آخر نزيل صفة "مالك بيع" فقط
      const { error } = await supabase.from("contacts").update({ roles: roles.length ? roles : ["owner"] }).eq("id", o.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف من ملاك البيع");
      refresh();
    },
    onError: (e) => toast.error(describeDbError(e)),
  });

  const setPropOwner = useMutation({
    mutationFn: async ({ propId, ownerId }: { propId: string; ownerId: string | null }) => {
      const { data, error } = await supabase.from("properties").update({ owner_id: ownerId }).eq("id", propId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("لم يتم التحديث — تحقق من الصلاحيات");
    },
    onSuccess: () => {
      toast.success("تم التحديث");
      refresh();
    },
    onError: (e) => toast.error(describeDbError(e)),
  });

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (o: Owner) => {
    setEditing(o);
    setForm({ full_name: o.full_name, phone: o.phone ?? "", whatsapp: o.whatsapp ?? "", national_id: o.national_id ?? "", notes: o.notes ?? "", email: o.email ?? "", address: o.address ?? "" });
    setOpen(true);
  };

  const unassigned = (props.data ?? []).filter((p) => {
    const s = norm(linkSearch.trim());
    return p.owner_id !== linkFor?.id && (!s || norm(p.code ?? "").includes(s) || norm(p.name ?? "").includes(s));
  });

  const totalProps = Object.values(byOwner).reduce((n, a) => n + a.length, 0);
  const noOwner = (props.data ?? []).filter((p) => !p.owner_id).length;
  const linked = Object.values(byOwner).flat();
  const availableValue = linked.filter((p) => p.status === "available").reduce((n, p) => n + (p.price_value ?? 0), 0);
  const soldCount = linked.filter((p) => p.status === "sold").length;
  const waLink = (n: string | null) => (n ? `https://wa.me/${n.replace(/\D/g, "").replace(/^0/, "966")}` : null);

  return (
    <div className="space-y-6">
      <PageHero title="ملاك البيع" subtitle="كل ملاك عقارات البيع في صفحة مستقلة — أضف المالك واربط عقاراته المعروضة للبيع." icon={BadgeDollarSign} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="عدد ملاك البيع" value={owners.data?.length ?? 0} />
        <Stat label="عقارات بيع مربوطة بمالك" value={totalProps} />
        <Stat label="عقارات بيع بدون مالك" value={noOwner} />
        <Stat label="مباعة من عقاراتهم" value={soldCount} />
        <Stat label="قيمة المتاح للبيع" value={`${availableValue.toLocaleString("ar-SA")} ر.س`} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className={`${inputClass} max-w-sm`} placeholder="بحث بالاسم أو الجوال أو الهوية أو كود العقار" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={`${inputClass} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">كل الملاك</option>
          <option value="with">لديهم عقارات</option>
          <option value="without">بدون عقارات</option>
          <option value="available">لديهم عقار متاح</option>
          <option value="sold">لديهم عقار مباع</option>
        </select>
        <select className={`${inputClass} w-auto`} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="newest">الأحدث</option>
          <option value="name">بالاسم</option>
          <option value="props">الأكثر عقارات</option>
        </select>
        <span className="text-xs text-muted-foreground">{list.length} نتيجة</span>
        <PrimaryButton onClick={openNew}>
          <Plus className="h-4 w-4" /> إضافة مالك بيع
        </PrimaryButton>
      </div>

      {owners.isLoading ? (
        <p className="text-muted-foreground">جارٍ التحميل…</p>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {owners.data?.length ? "لا توجد نتائج مطابقة للبحث." : "لا يوجد ملاك بيع بعد. اضغط «إضافة مالك بيع» لإضافة أول مالك."}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((o) => {
            const ps = byOwner[o.id] ?? [];
            return (
              <div key={o.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground">{o.full_name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span dir="ltr">{o.phone ?? "—"}</span>
                      {o.phone ? (
                        <>
                          <a href={`tel:${o.phone}`} title="اتصال" className="hover:text-primary"><Phone className="h-4 w-4" /></a>
                          <a href={waLink(o.whatsapp ?? o.phone) ?? "#"} target="_blank" rel="noreferrer" title="فتح واتساب" className="hover:text-success"><MessageCircle className="h-4 w-4" /></a>
                          <button type="button" title="نسخ الرقم" className="hover:text-primary" onClick={() => { navigator.clipboard.writeText(o.phone ?? ""); toast.success("تم نسخ الرقم"); }}><Copy className="h-4 w-4" /></button>
                        </>
                      ) : null}
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {o.national_id && <div>الهوية: {o.national_id}</div>}
                      {o.email && <div dir="ltr" className="text-end">{o.email}</div>}
                      {o.address && <div>العنوان: {o.address}</div>}
                      {o.notes && <div>ملاحظات: {o.notes}</div>}
                      <div>أُضيف: {new Date(o.created_at).toLocaleDateString("ar-SA")}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <GhostButton onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></GhostButton>
                    <GhostButton
                      
                      onClick={() => window.confirm(`حذف ${o.full_name} من ملاك البيع؟`) && remove.mutate(o)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </GhostButton>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">عقارات البيع ({ps.length})</div>
                  {ps.length === 0 && <div className="text-xs text-muted-foreground">لا توجد عقارات مربوطة.</div>}
                  {ps.map((p) => (
                    <div key={p.id} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm ${q && p.code && norm(p.code).includes(q) ? "bg-accent ring-1 ring-primary/40" : "bg-muted/50"}`}>
                      <Link to="/properties" className="min-w-0 truncate hover:underline">
                        {p.code ? `${p.code} — ` : ""}{p.name ?? "عقار"}
                        {p.city ? ` • ${p.city}` : ""}
                        {p.price_value ? ` • ${p.price_value.toLocaleString("ar-SA")} ر.س` : ""}
                      </Link>
                      <span className={`shrink-0 rounded-md px-1.5 text-[11px] font-bold ${p.status === "sold" ? "bg-success/15 text-success" : "bg-accent-2-soft text-accent-2"}`}>{STATUS[p.status ?? ""] ?? p.status ?? "—"}</span>
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        title="فك الربط"
                        onClick={() => setPropOwner.mutate({ propId: p.id, ownerId: null })}
                      >
                        <Unlink className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <GhostButton onClick={() => { setLinkFor(o); setLinkSearch(""); }}>
                    <Link2 className="h-4 w-4" /> ربط عقار بيع
                  </GhostButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "تعديل مالك بيع" : "إضافة مالك بيع"}>
        <div className="space-y-3">
          <Field label="الاسم *"><input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="الجوال"><input className={inputClass} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="واتساب"><input className={inputClass} dir="ltr" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
          <Field label="البريد الإلكتروني"><input className={inputClass} dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="العنوان"><input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="رقم الهوية"><input className={inputClass} value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} /></Field>
          <Field label="ملاحظات"><textarea className={textareaClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>حفظ</PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal open={!!linkFor} onClose={() => setLinkFor(null)} title={`ربط عقار بيع بـ ${linkFor?.full_name ?? ""}`}>
        <div className="space-y-3">
          <input className={inputClass} placeholder="بحث بالكود أو الاسم" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {unassigned.slice(0, 100).map((p) => (
              <button
                key={p.id}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                onClick={() => { if (linkFor) setPropOwner.mutate({ propId: p.id, ownerId: linkFor.id }); setLinkFor(null); }}
              >
                <span>{p.code ? `${p.code} — ` : ""}{p.name ?? "عقار"}</span>
                <span className="text-xs text-muted-foreground">{p.owner_id ? "له مالك آخر" : "بدون مالك"}</span>
              </button>
            ))}
            {unassigned.length === 0 && <p className="text-sm text-muted-foreground">لا توجد عقارات بيع مطابقة.</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}
