import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeDollarSign, Link2, Pencil, Plus, Trash2, Unlink } from "lucide-react";
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
  roles: string[] | null;
};
type Prop = { id: string; code: string | null; name: string | null; status: string | null; price_value: number | null; owner_id: string | null; purpose: string | null };

const ROLE = "sale_owner";
const empty = { full_name: "", phone: "", whatsapp: "", national_id: "", notes: "" };

function SaleOwnersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [linkFor, setLinkFor] = useState<Owner | null>(null);
  const [linkSearch, setLinkSearch] = useState("");

  const owners = useQuery({
    queryKey: ["sale-owners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, phone, whatsapp, national_id, notes, roles")
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
        .select("id, code, name, status, price_value, owner_id, purpose")
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

  const list = (owners.data ?? []).filter((o) => {
    const s = search.trim();
    return !s || o.full_name.includes(s) || (o.phone ?? "").includes(s);
  });

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
    setForm({ full_name: o.full_name, phone: o.phone ?? "", whatsapp: o.whatsapp ?? "", national_id: o.national_id ?? "", notes: o.notes ?? "" });
    setOpen(true);
  };

  const unassigned = (props.data ?? []).filter((p) => {
    const s = linkSearch.trim().toLowerCase();
    return p.owner_id !== linkFor?.id && (!s || (p.code ?? "").toLowerCase().includes(s) || (p.name ?? "").includes(s));
  });

  const totalProps = Object.values(byOwner).reduce((n, a) => n + a.length, 0);
  const noOwner = (props.data ?? []).filter((p) => !p.owner_id).length;

  return (
    <div className="space-y-6">
      <PageHero title="ملاك البيع" subtitle="كل ملاك عقارات البيع في صفحة مستقلة — أضف المالك واربط عقاراته المعروضة للبيع." icon={BadgeDollarSign} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="عدد ملاك البيع" value={owners.data?.length ?? 0} />
        <Stat label="عقارات بيع مربوطة بمالك" value={totalProps} />
        <Stat label="عقارات بيع بدون مالك" value={noOwner} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className={`${inputClass} max-w-xs`} placeholder="بحث بالاسم أو الجوال" value={search} onChange={(e) => setSearch(e.target.value)} />
        <PrimaryButton onClick={openNew}>
          <Plus className="h-4 w-4" /> إضافة مالك بيع
        </PrimaryButton>
      </div>

      {owners.isLoading ? (
        <p className="text-muted-foreground">جارٍ التحميل…</p>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          لا يوجد ملاك بيع بعد. اضغط «إضافة مالك بيع» لإضافة أول مالك.
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
                    <div className="text-sm text-muted-foreground" dir="ltr">{o.phone ?? "—"}</div>
                    {o.notes && <div className="text-xs text-muted-foreground mt-1">{o.notes}</div>}
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
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-sm">
                      <Link to="/properties" className="hover:underline">
                        {p.code ? `${p.code} — ` : ""}{p.name ?? "عقار"}
                        {p.price_value ? ` • ${p.price_value.toLocaleString("ar-SA")} ر.س` : ""}
                        {p.status ? ` • ${p.status}` : ""}
                      </Link>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}
