import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeDollarSign, BellRing, CheckCircle2, Clock, Copy, Home, Link2, MessageCircle, Pencil, Phone, Plus, Search, Send, Trash2, Unlink, Users, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { describeDbError } from "@/lib/db-errors";
import { getOwnerFollowupStatus, saveOwnerFollowupConfig, sendOwnerFollowupNow } from "@/lib/owner-followup.functions";

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

function useCountdown(target: string | null) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, passed: true };
  const minutes = Math.floor(diff / 60_000) % 60;
  const hours = Math.floor(diff / 3_600_000) % 24;
  const days = Math.floor(diff / 86_400_000);
  return { days, hours, minutes, passed: false };
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ar-SA", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true });
}

function SaleOwnersPage() {
  const qc = useQueryClient();
  const fetchFollowup = useServerFn(getOwnerFollowupStatus);
  const saveFollowup = useServerFn(saveOwnerFollowupConfig);
  const sendFollowupNow = useServerFn(sendOwnerFollowupNow);
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

  const followup = useQuery({
    queryKey: ["owner-followup-status"],
    queryFn: () => fetchFollowup(),
  });
  const [templateDraft, setTemplateDraft] = useState<string | null>(null);
  const template = templateDraft ?? followup.data?.template ?? "";
  const countdown = useCountdown(followup.data?.enabled ? followup.data?.nextRun ?? null : null);

  const toggleEnabled = useMutation({
    mutationFn: (enabled: boolean) => saveFollowup({ data: { enabled } }),
    onSuccess: () => {
      toast.success("تم تحديث حالة التفعيل");
      qc.invalidateQueries({ queryKey: ["owner-followup-status"] });
    },
    onError: (e) => toast.error(describeDbError(e)),
  });

  const saveTemplate = useMutation({
    mutationFn: (tpl: string) => saveFollowup({ data: { template: tpl } }),
    onSuccess: () => {
      toast.success("تم حفظ القالب");
      setTemplateDraft(null);
      qc.invalidateQueries({ queryKey: ["owner-followup-status"] });
    },
    onError: (e) => toast.error(describeDbError(e)),
  });

  const sendAll = useMutation({
    mutationFn: () => sendFollowupNow({ data: {} }),
    onSuccess: (res) => {
      const sent = res?.sent ?? 0;
      const failed = res?.failed ?? 0;
      toast.success(`تم الإرسال: ${sent} ناجحة${failed ? ` • ${failed} فاشلة` : ""}`);
      qc.invalidateQueries({ queryKey: ["owner-followup-status"] });
    },
    onError: (e) => toast.error(describeDbError(e)),
  });

  const sendOne = useMutation({
    mutationFn: (contactId: string) => sendFollowupNow({ data: { contactId } }),
    onSuccess: () => {
      toast.success("تم إرسال الرسالة");
      qc.invalidateQueries({ queryKey: ["owner-followup-status"] });
    },
    onError: (e) => toast.error(describeDbError(e)),
  });

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
      <PageHero
        title="ملاك البيع"
        subtitle="إدارة ملاك البيع والعقارات المرتبطة بهم."
        icon={BadgeDollarSign}
        stats={[
          { value: String(owners.data?.length ?? 0), label: "ملاك البيع", icon: Users },
          { value: String(totalProps), label: "العقارات المرتبطة", icon: Home },
          { value: String(noOwner), label: "عقارات بدون مالك", icon: Unlink },
          { value: availableValue.toLocaleString("ar-SA"), unit: "ر.س", label: `قيمة البيع المتاحة • مباع ${soldCount}`, icon: BadgeDollarSign },
        ]}
      />

      <div className="surface-card flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-wrap gap-2">
          {([
            ["all", "الكل"],
            ["with", "لديهم عقارات"],
            ["without", "بدون عقارات"],
            ["available", "متاح"],
            ["sold", "مباع"],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-xl px-4 py-2 text-[13px] font-bold transition-colors ${filter === k ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-card text-foreground hover:bg-muted"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inputClass} ps-9`} placeholder="البحث باسم مالك البيع أو الجوال أو الهوية أو كود العقار…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${inputClass} w-auto`} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="newest">الأحدث</option>
          <option value="name">بالاسم</option>
          <option value="props">الأكثر عقارات</option>
        </select>
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
            const initials = o.full_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join(" ");
            const hasAvail = ps.some((p) => p.status === "available");
            const allSold = ps.length > 0 && ps.every((p) => p.status === "sold");
            const value = ps.reduce((n, p) => n + (p.price_value ?? 0), 0);
            return (
              <div key={o.id} className="surface-card space-y-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 text-[16px] font-bold text-primary">{initials}</span>
                    <div>
                      <div className="text-[15px] font-bold text-foreground">{o.full_name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                        <span dir="ltr">{o.phone ?? "—"}</span>
                        {o.phone ? (
                          <>
                            <a href={`tel:${o.phone}`} title="اتصال" className="hover:text-primary"><Phone className="h-4 w-4" /></a>
                            <a href={waLink(o.whatsapp ?? o.phone) ?? "#"} target="_blank" rel="noreferrer" title="فتح واتساب" className="hover:text-success"><MessageCircle className="h-4 w-4" /></a>
                            <button type="button" title="نسخ الرقم" className="hover:text-primary" onClick={() => { navigator.clipboard.writeText(o.phone ?? ""); toast.success("تم نسخ الرقم"); }}><Copy className="h-4 w-4" /></button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {ps.length ? (
                      <span className="rounded-lg bg-[color:var(--warning)]/15 px-2.5 py-1 text-[11.5px] font-bold text-[color:var(--warning)]">لديه عقارات</span>
                    ) : (
                      <span className="rounded-lg bg-muted px-2.5 py-1 text-[11.5px] font-bold text-muted-foreground">بدون عقارات</span>
                    )}
                    {hasAvail ? <span className="rounded-lg bg-success/15 px-2.5 py-1 text-[11.5px] font-bold text-success">● متاح للبيع</span> : null}
                    {allSold ? <span className="rounded-lg bg-[color:var(--warning)]/15 px-2.5 py-1 text-[11.5px] font-bold text-[color:var(--warning)]">● مباع بالكامل</span> : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-y border-border py-3">
                  <div>
                    <div className="text-[12px] text-muted-foreground">العقارات المرتبطة</div>
                    <div className="text-[20px] font-extrabold text-primary">{ps.length}</div>
                  </div>
                  <div>
                    <div className="text-[12px] text-muted-foreground">القيمة المطلوبة</div>
                    <div className="text-[20px] font-extrabold text-primary">{value ? `${value.toLocaleString("ar-SA")} ر.س` : "--"}</div>
                  </div>
                </div>

                {(o.national_id || o.email || o.address || o.notes) && (
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {o.national_id && <div>الهوية: {o.national_id}</div>}
                    {o.email && <div dir="ltr" className="text-end">{o.email}</div>}
                    {o.address && <div>العنوان: {o.address}</div>}
                    {o.notes && <div>ملاحظات: {o.notes}</div>}
                  </div>
                )}

                <div className="space-y-1.5">
                  {ps.length === 0 && (
                    <div className="grid place-items-center gap-1 rounded-xl bg-muted/50 py-6 text-center text-[12px] text-muted-foreground">
                      <Home className="size-7" />
                      لا توجد عقارات مرتبطة حاليًا
                    </div>
                  )}
                  {ps.map((p) => (
                    <div key={p.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${q && p.code && norm(p.code).includes(q) ? "bg-accent ring-1 ring-primary/40" : "bg-muted/50"}`}>
                      <Link to="/properties" className="min-w-0 truncate hover:underline">
                        {p.code ? `${p.code} — ` : ""}{p.name ?? "عقار"}
                        {p.city ? ` • ${p.city}` : ""}
                        {p.price_value ? ` • ${p.price_value.toLocaleString("ar-SA")} ر.س` : ""}
                      </Link>
                      <span className={`shrink-0 rounded-md px-1.5 text-[11px] font-bold ${p.status === "sold" ? "bg-success/15 text-success" : "bg-accent-2-soft text-accent-2"}`}>{STATUS[p.status ?? ""] ?? p.status ?? "—"}</span>
                      <button className="text-muted-foreground hover:text-destructive" title="فك الربط" onClick={() => setPropOwner.mutate({ propId: p.id, ownerId: null })}>
                        <Unlink className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => openEdit(o)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-bold text-primary-foreground hover:opacity-90">
                    <Pencil className="size-4" /> عرض / تعديل الملف
                  </button>
                  <button type="button" onClick={() => { setLinkFor(o); setLinkSearch(""); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-[13px] font-bold text-foreground hover:bg-muted">
                    <Link2 className="size-4" /> ربط عقار بيع
                  </button>
                  <button type="button" title="حذف" onClick={() => window.confirm(`حذف ${o.full_name} من ملاك البيع؟`) && remove.mutate(o)} className="grid size-10 place-items-center rounded-xl border border-border hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">عرض {list.length} نتيجة</p>

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
