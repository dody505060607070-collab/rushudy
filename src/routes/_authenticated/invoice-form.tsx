import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Paperclip, FileText, Loader2, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Field, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { invoiceStatusLabels } from "@/lib/labels";
import { mediaUrl, uploadMedia } from "@/lib/media";

const itemTypes: { value: string; label: string; vat: string }[] = [
  { value: "rent", label: "إيجار", vat: "15" },
  { value: "labor", label: "أجر عامل / يد عاملة", vat: "0" },
  { value: "materials", label: "مواد وقطع غيار", vat: "15" },
  { value: "maintenance", label: "صيانة", vat: "15" },
  { value: "service", label: "عمولة / خدمة", vat: "15" },
  { value: "government", label: "رسوم حكومية", vat: "0" },
  { value: "other", label: "أخرى", vat: "15" },
];

type Item = { description: string; quantity: string; unit_price: string; vat_rate: string; item_type: string };
const blankItem = (vat = "15"): Item => ({ description: "", quantity: "1", unit_price: "", vat_rate: vat, item_type: "other" });
const lineBase = (i: Item) => (Number(i.quantity) || 0) * (Number(i.unit_price) || 0);
const lineVat = (i: Item) => lineBase(i) * (Number(i.vat_rate) || 0) / 100;

export const Route = createFileRoute("/_authenticated/invoice-form")({
  validateSearch: (search: Record<string, unknown>) => ({ id: typeof search["id"] === "string" ? search["id"] as string : "", ownerId: typeof search["ownerId"] === "string" ? search["ownerId"] as string : "" }),
  head: () => ({ meta: [
    { title: "إنشاء فاتورة | الرشودي للعقارات" },
    { name: "description", content: "إنشاء فاتورة وإضافة البنود والضريبة والملاحظات." },
    { property: "og:title", content: "إنشاء فاتورة | الرشودي للعقارات" },
    { property: "og:description", content: "نموذج الفاتورة الكامل." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InvoiceFormPage,
});

function InvoiceFormPage() {
  const { id, ownerId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ invoice_number: "", contact_id: ownerId, contract_id: "", issue_date: today, due_date: "", status: "unpaid", vat_rate: "15", notes: "" });
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [files, setFiles] = useState<File[]>([]);
  const set = (patch: Partial<typeof form>) => setForm((previous) => ({ ...previous, ...patch }));
  const options = useQuery({ queryKey: ["invoice-form-options"], queryFn: async () => {
    const [contacts, contracts, settings] = await Promise.all([
      supabase.from("contacts").select("id, full_name, phone").order("full_name").limit(5000),
      supabase.from("contracts").select("id, contract_number, owner_id").order("created_at", { ascending: false }).limit(500),
      supabase.from("app_settings").select("vat_rate, company_name, address").eq("id", true).maybeSingle(),
    ]);
    if (contacts.error) throw contacts.error;
    if (contracts.error) throw contracts.error;
    return { contacts: contacts.data ?? [], contracts: contracts.data ?? [], settings: settings.data };
  }});
  const existing = useQuery({ queryKey: ["invoice-edit", id], enabled: Boolean(id), queryFn: async () => {
    const [invoice, invoiceItems] = await Promise.all([supabase.from("invoices").select("*").eq("id", id).single(), supabase.from("invoice_items").select("description, quantity, unit_price, vat_rate, item_type").eq("invoice_id", id).order("sort_order")]);
    if (invoice.error) throw invoice.error;
    if (invoiceItems.error) throw invoiceItems.error;
    return { invoice: invoice.data, items: invoiceItems.data ?? [] };
  }});
  useEffect(() => { if (!id && options.data?.settings) set({ vat_rate: String(options.data.settings.vat_rate ?? 15) }); }, [id, options.data?.settings]);
  useEffect(() => { const data = existing.data; if (!data) return; setForm({ invoice_number: data.invoice.invoice_number, contact_id: data.invoice.contact_id ?? "", contract_id: data.invoice.contract_id ?? "", issue_date: data.invoice.issue_date, due_date: data.invoice.due_date ?? "", status: data.invoice.status, vat_rate: data.invoice.subtotal ? String((Number(data.invoice.vat_amount) / Number(data.invoice.subtotal)) * 100) : "0", notes: data.invoice.notes ?? "" }); setItems(data.items.length ? data.items.map((item) => ({ description: item.description, quantity: String(item.quantity), unit_price: String(item.unit_price), vat_rate: String(item.vat_rate ?? 0), item_type: item.item_type ?? "other" })) : [blankItem()]); }, [existing.data]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + lineBase(item), 0), [items]);
  const vat = useMemo(() => items.reduce((sum, item) => sum + lineVat(item), 0), [items]);
  const total = subtotal + vat;
  const save = useMutation({ mutationFn: async (addAnother: boolean) => {
    if (!form.contact_id) throw new Error("اختر المالك أو العميل");
    const validItems = items.filter((item) => item.description.trim() && Number(item.quantity) > 0);
    if (!validItems.length) throw new Error("أضف بند فاتورة واحدًا على الأقل");
    const payload = { invoice_number: form.invoice_number.trim() || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`, contact_id: form.contact_id, contract_id: form.contract_id || null, issue_date: form.issue_date, due_date: form.due_date || null, status: form.status, subtotal, vat_amount: vat, total, notes: form.notes.trim() || null };
    let invoiceId = id;
    if (id) { const update = await supabase.from("invoices").update(payload).eq("id", id); if (update.error) throw update.error; const remove = await supabase.from("invoice_items").delete().eq("invoice_id", id); if (remove.error) throw remove.error; }
    else { const insert = await supabase.from("invoices").insert(payload).select("id").single(); if (insert.error) throw insert.error; invoiceId = insert.data.id; }
    const inserted = await supabase.from("invoice_items").insert(validItems.map((item, index) => ({ invoice_id: invoiceId, description: item.description.trim(), quantity: Number(item.quantity), unit_price: Number(item.unit_price), total: lineBase(item), vat_rate: Number(item.vat_rate) || 0, vat_amount: lineVat(item), item_type: item.item_type, sort_order: index })));
    if (inserted.error) throw inserted.error;
    if (files.length && invoiceId) {
      const cur = await supabase.from("invoices").select("attachments").eq("id", invoiceId).maybeSingle();
      const list = (Array.isArray(cur.data?.attachments) ? cur.data!.attachments : []) as { path: string; name: string }[];
      for (const f of files) {
        const path = `invoices/${invoiceId}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
        await uploadMedia("internal-files", path, f);
        list.push({ path, name: f.name });
      }
      const att = await supabase.from("invoices").update({ attachments: list, attachment_path: list[0]?.path ?? null, attachment_name: list[0]?.name ?? null }).eq("id", invoiceId);
      if (att.error) throw att.error;
    }
    // ترحيل تلقائي: الفاتورة المدفوعة يُسجّل لها المتبقي كدفعة تلقائيًا
    if (form.status === "paid" && invoiceId) {
      const paidRes = await supabase.from("invoice_payments").select("amount").eq("invoice_id", invoiceId);
      const paidSum = (paidRes.data ?? []).reduce((s2, p2) => s2 + Number(p2.amount), 0);
      const rest = Math.round((total - paidSum) * 100) / 100;
      if (rest > 0) {
        const { data: auth } = await supabase.auth.getUser();
        const pay = await supabase.from("invoice_payments").insert({ invoice_id: invoiceId, amount: rest, paid_at: form.issue_date, method: "ترحيل تلقائي", reference: payload.invoice_number, recorded_by: auth.user?.id ?? null });
        if (pay.error) throw pay.error;
      }
    }
    setFiles([]);
    return { invoiceId, addAnother };
  }, onSuccess: ({ invoiceId, addAnother }) => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success(id ? "تم تحديث الفاتورة" : "تم إنشاء الفاتورة"); if (addAnother) { setForm({ invoice_number: "", contact_id: ownerId, contract_id: "", issue_date: today, due_date: "", status: "unpaid", vat_rate: form.vat_rate, notes: "" }); setItems([blankItem()]); } else void navigate({ to: "/invoices/$invoiceId", params: { invoiceId } }); }, onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر الحفظ") });

  return <>
    <PageHero title={id ? "تعديل الفاتورة" : "الفواتير"} subtitle="إدارة الفواتير وحالات إصدارها وسدادها" icon={ReceiptText} />
    <div className="flex items-center justify-between"><Link to="/invoices" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold"><ArrowRight className="size-4" />رجوع للفواتير</Link><span className="text-[12px] text-muted-foreground">الفواتير / {id ? "تعديل" : "إضافة"}</span></div>
    <Section title="بيانات الفاتورة" icon={ReceiptText}><div className="grid gap-4 sm:grid-cols-2">
      <Field label="المالك / العميل"><ContactSearch contacts={options.data?.contacts ?? []} value={form.contact_id} onChange={(contact_id) => set({ contact_id })} /></Field>
      <Field label="الحالة"><select className={inputClass} value={form.status} onChange={(event) => set({ status: event.target.value })}>{Object.entries(invoiceStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="رقم الفاتورة" hint="يُنشأ تلقائيًا إذا تُرك فارغًا"><input className={inputClass} dir="ltr" value={form.invoice_number} onChange={(event) => set({ invoice_number: event.target.value })} /></Field>
      <Field label="العقد المرتبط"><select className={inputClass} value={form.contract_id} onChange={(event) => set({ contract_id: event.target.value })}><option value="">بدون عقد</option>{(options.data?.contracts ?? []).filter((contract) => !form.contact_id || contract.owner_id === form.contact_id).map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_number}</option>)}</select></Field>
      <Field label="تاريخ الفاتورة"><input type="date" className={inputClass} value={form.issue_date} onChange={(event) => set({ issue_date: event.target.value })} /></Field>
      <Field label="تاريخ الاستحقاق"><input type="date" className={inputClass} value={form.due_date} onChange={(event) => set({ due_date: event.target.value })} /></Field>
    </div></Section>
    <Section title="بنود الفاتورة" icon={FileText}><div className="space-y-3">{items.map((item, index) => <div key={index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[150px_1fr_80px_120px_100px_44px]"><Field label="نوع البند"><select className={inputClass} value={item.item_type} onChange={(event) => { const t = itemTypes.find((x) => x.value === event.target.value); setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, item_type: event.target.value, vat_rate: t?.vat ?? row.vat_rate } : row)); }}>{itemTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field><Field label="الوصف"><input className={inputClass} value={item.description} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} /></Field><Field label="العدد"><input className={inputClass} dir="ltr" inputMode="decimal" value={item.quantity} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} /></Field><Field label="سعر الوحدة"><input className={inputClass} dir="ltr" inputMode="decimal" value={item.unit_price} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unit_price: event.target.value } : row))} /></Field><Field label="الضريبة %"><select className={inputClass} value={item.vat_rate} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, vat_rate: event.target.value } : row))}><option value="0">بدون (0%)</option><option value="5">5%</option><option value="15">15%</option>{!["0","5","15"].includes(item.vat_rate) ? <option value={item.vat_rate}>{item.vat_rate}%</option> : null}</select></Field><button type="button" onClick={() => setItems((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index))} className="mt-6 grid size-10 place-items-center rounded-lg text-destructive hover:bg-destructive/10" aria-label="حذف البند" title={`ضريبة البند: ${lineVat(item).toFixed(2)} ر.س`}><Trash2 className="size-4" /></button></div>)}<button type="button" onClick={() => setItems((current) => [...current, blankItem(form.vat_rate)])} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[12.5px] font-semibold"><Plus className="size-4" />إضافة بند</button></div></Section>
    <Section title="الضريبة والإجماليات" icon={ReceiptText}><div className="grid gap-4 sm:grid-cols-4"><Field label="الضريبة الافتراضية للبنود الجديدة %" hint="كل بند له ضريبته الخاصة"><input className={inputClass} dir="ltr" inputMode="decimal" value={form.vat_rate} onChange={(event) => set({ vat_rate: event.target.value })} /></Field><Total label="قبل الضريبة" value={subtotal} /><Total label="الضريبة" value={vat} /><Total label="الإجمالي" value={total} strong /></div></Section>
    <Section title="إرفاق الفواتير" icon={Paperclip}><div className="space-y-2"><input type="file" multiple accept="image/*,application/pdf" className={inputClass} onChange={(event) => { const picked = Array.from(event.target.files ?? []); setFiles((cur) => [...cur, ...picked]); event.target.value = ""; }} />{files.length ? <ul className="space-y-1 text-[12.5px]">{files.map((f, i) => <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1"><span className="truncate">{f.name}</span><button type="button" className="text-destructive" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>إزالة</button></li>)}</ul> : null}{((existing.data?.invoice as { attachments?: { path: string; name: string }[] } | undefined)?.attachments ?? []).map((a2) => <button key={a2.path} type="button" className="block text-[12.5px] font-semibold text-primary hover:underline" onClick={async () => window.open(await mediaUrl("internal-files", a2.path), "_blank", "noopener")}>عرض: {a2.name}</button>)}<p className="text-[11.5px] text-muted-foreground">تقدر تختار أكثر من صورة أو PDF مرة واحدة. عند اختيار الحالة "مدفوعة" يُسجَّل المتبقي كدفعة تلقائيًا.</p></div></Section>
    <Section title="ملاحظات وشروط" icon={FileText}><Field label="ملاحظات الفاتورة"><textarea className={textareaClass} value={form.notes} onChange={(event) => set({ notes: event.target.value })} placeholder="تفاصيل السداد أو أي شروط تظهر في سجل الفاتورة." /></Field></Section>
    <div className="flex flex-wrap justify-center gap-3 pb-4"><button type="button" onClick={() => save.mutate(false)} disabled={save.isPending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-[13px] font-bold text-primary-foreground disabled:opacity-50">{save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{id ? "حفظ التعديلات" : "إضافة"}</button>{!id ? <button type="button" onClick={() => save.mutate(true)} disabled={save.isPending} className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-5 text-[13px] font-semibold">إضافة وبدء فاتورة جديدة</button> : null}<Link to="/invoices" className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-5 text-[13px] font-semibold">إلغاء</Link></div>
  </>;
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof ReceiptText; children: ReactNode }) { return <section className="surface-card overflow-hidden"><header className="flex items-center gap-2 border-b border-border px-5 py-4"><Icon className="size-4 text-primary" /><h2 className="text-[14px] font-bold">{title}</h2></header><div className="p-5">{children}</div></section>; }
function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <div className="rounded-lg border border-border p-3"><p className="text-[11.5px] text-muted-foreground">{label}</p><p className={strong ? "mt-2 text-lg font-bold text-primary" : "mt-2 font-semibold"}>{new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)} ر.س</p></div>; }
const normalizeAr = (v: string) =>
  v.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[\u064B-\u0652]/g, "").replace(/\s+/g, " ").trim();

function ContactSearch({ contacts, value, onChange }: { contacts: { id: string; full_name: string | null; phone?: string | null }[]; value: string; onChange: (id: string) => void }) {
  const selected = contacts.find((c) => c.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const q = normalizeAr(query);
  const matches = (q ? contacts.filter((c) => normalizeAr(c.full_name ?? "").includes(q) || (c.phone ?? "").includes(q)) : contacts).slice(0, 50);
  return (
    <div className="relative">
      <input
        className={inputClass}
        placeholder="اكتب اسم المالك أو العميل للبحث"
        value={open ? query : selected?.full_name ?? ""}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {open ? (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {matches.length ? matches.map((c) => (
            <li key={c.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(c.id); setOpen(false); }} className={`flex w-full items-center justify-between px-3 py-2 text-start text-[13px] hover:bg-muted ${c.id === value ? "font-bold text-primary" : ""}`}>
                <span>{c.full_name ?? "—"}</span>
                {c.phone ? <span dir="ltr" className="text-[11px] text-muted-foreground">{c.phone}</span> : null}
              </button>
            </li>
          )) : <li className="px-3 py-2 text-[12.5px] text-muted-foreground">لا توجد أسماء مطابقة</li>}
        </ul>
      ) : null}
    </div>
  );
}
