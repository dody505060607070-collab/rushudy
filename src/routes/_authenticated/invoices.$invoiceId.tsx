import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Banknote, CheckCircle2, Download, Loader2, Pencil, Printer, ReceiptText, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { exportWorkbook } from "@/lib/export";
import { invoiceStatusLabels } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  head: () => ({ meta: [
    { title: "تفاصيل الفاتورة | الرشودي للعقارات" },
    { name: "description", content: "عرض الفاتورة وبنودها والمدفوعات المسجلة." },
    { property: "og:title", content: "تفاصيل الفاتورة | الرشودي للعقارات" },
    { property: "og:description", content: "تفاصيل الفاتورة وسجل السداد." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [payment, setPayment] = useState({ amount: "", paid_at: new Date().toISOString().slice(0, 10), method: "bank_transfer", reference: "" });
  const detail = useQuery({ queryKey: ["invoice-detail", invoiceId], queryFn: async () => {
    const [invoice, items, payments] = await Promise.all([
      supabase.from("invoices").select("*, contact:contact_id(id, full_name, phone, email, national_id, address), contract:contract_id(contract_number)").eq("id", invoiceId).single(),
      supabase.from("invoice_items").select("id, description, quantity, unit_price, total, sort_order").eq("invoice_id", invoiceId).order("sort_order"),
      supabase.from("invoice_payments").select("id, amount, paid_at, method, reference, created_at").eq("invoice_id", invoiceId).order("paid_at", { ascending: false }),
    ]);
    if (invoice.error) throw invoice.error;
    if (items.error) throw items.error;
    if (payments.error) throw payments.error;
    return { invoice: invoice.data, items: items.data ?? [], payments: payments.data ?? [] };
  }});
  const data = detail.data;
  const paid = data?.payments.reduce((sum, row) => sum + Number(row.amount), 0) ?? 0;
  const remaining = Math.max(0, Number(data?.invoice.total ?? 0) - paid);
  const recordPayment = useMutation({ mutationFn: async () => {
    const amount = Number(payment.amount);
    if (!amount || amount <= 0) throw new Error("أدخل مبلغًا صحيحًا");
    if (!data) throw new Error("لم تكتمل بيانات الفاتورة");
    const insert = await supabase.from("invoice_payments").insert({ invoice_id: invoiceId, amount, paid_at: payment.paid_at, method: payment.method, reference: payment.reference.trim() || null });
    if (insert.error) throw insert.error;
    const newPaid = paid + amount;
    const status = newPaid >= Number(data.invoice.total) ? "paid" : "partial";
    const update = await supabase.from("invoices").update({ status }).eq("id", invoiceId);
    if (update.error) throw update.error;
  }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }); queryClient.invalidateQueries({ queryKey: ["invoices"] }); setPaymentOpen(false); toast.success("تم تسجيل الدفعة"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر تسجيل الدفعة") });
  const markPaid = useMutation({ mutationFn: async () => {
    if (!data) throw new Error("لم تكتمل بيانات الفاتورة");
    if (remaining <= 0) return;
    const insert = await supabase.from("invoice_payments").insert({ invoice_id: invoiceId, amount: remaining, paid_at: new Date().toISOString().slice(0, 10), method: "manual", reference: "تسجيل الفاتورة كمدفوعة" });
    if (insert.error) throw insert.error;
    const update = await supabase.from("invoices").update({ status: "paid" }).eq("id", invoiceId);
    if (update.error) throw update.error;
  }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }); queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success("تم تسجيل الفاتورة كمدفوعة"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر تحديث الفاتورة") });
  const deleteInvoice = useMutation({ mutationFn: async () => {
    const paymentsDelete = await supabase.from("invoice_payments").delete().eq("invoice_id", invoiceId);
    if (paymentsDelete.error) throw paymentsDelete.error;
    const itemsDelete = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
    if (itemsDelete.error) throw itemsDelete.error;
    const invoiceDelete = await supabase.from("invoices").delete().eq("id", invoiceId);
    if (invoiceDelete.error) throw invoiceDelete.error;
  }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success("تم حذف الفاتورة"); window.location.assign("/invoices"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر حذف الفاتورة") });
  if (detail.isLoading) return <div className="surface-card grid place-items-center py-24"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (!data) return <div className="surface-card p-10 text-center text-destructive">تعذّر تحميل الفاتورة</div>;
  const exportInvoice = () => exportWorkbook(`فاتورة - ${data.invoice.invoice_number}`, [
    { name: "الفاتورة", rows: [{ "رقم الفاتورة": data.invoice.invoice_number, المالك: data.invoice.contact?.full_name, العقد: data.invoice.contract?.contract_number, الإصدار: data.invoice.issue_date, الاستحقاق: data.invoice.due_date, الحالة: invoiceStatusLabels[data.invoice.status] ?? data.invoice.status, "قبل الضريبة": data.invoice.subtotal, الضريبة: data.invoice.vat_amount, الإجمالي: data.invoice.total, المدفوع: paid, المتبقي: remaining, ملاحظات: data.invoice.notes }] },
    { name: "البنود", rows: data.items.map((row) => ({ الوصف: row.description, الكمية: row.quantity, "سعر الوحدة": row.unit_price, الإجمالي: row.total })) },
    { name: "المدفوعات", rows: data.payments.map((row) => ({ المبلغ: row.amount, التاريخ: row.paid_at, الطريقة: row.method, المرجع: row.reference })) },
  ]);
  return <>
    <PageHero title={`فاتورة ${data.invoice.invoice_number}`} subtitle="تفاصيل البنود والضريبة وسجل المدفوعات" icon={ReceiptText} stats={[{ value: formatCurrency(data.invoice.total), label: "الإجمالي" }, { value: formatCurrency(paid), label: "المدفوع" }, { value: formatCurrency(remaining), label: "المتبقي" }]} />
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/invoices" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold"><ArrowRight className="size-4" />رجوع للفواتير</Link><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => window.print()}><Printer />طباعة</Button><Button type="button" variant="outline" onClick={() => void exportInvoice()}><Download />Excel</Button><Button asChild variant="outline"><Link to="/invoice-form" search={{ id: invoiceId, ownerId: "" }}><Pencil />تعديل</Link></Button>{remaining > 0 ? <><Button type="button" onClick={() => { setPayment((current) => ({ ...current, amount: String(remaining) })); setPaymentOpen(true); }}><Banknote />تسجيل دفعة</Button><Button type="button" variant="secondary" onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>{markPaid.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}تسجيل كمدفوعة</Button></> : null}<Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 />حذف</Button></div></div>
    <section className="surface-card overflow-hidden"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><p className="text-[11.5px] text-muted-foreground">فاتورة إلى</p><h2 className="mt-1 text-[17px] font-bold">{data.invoice.contact?.full_name ?? "بدون مالك"}</h2><p className="mt-1 text-[12px] text-muted-foreground">{data.invoice.contact?.phone ?? "—"} · {data.invoice.contact?.email ?? "—"}</p></div><Chip tone={data.invoice.status === "paid" ? "success" : data.invoice.status === "overdue" ? "danger" : "warning"}>{invoiceStatusLabels[data.invoice.status] ?? data.invoice.status}</Chip></header><div className="grid gap-px bg-border sm:grid-cols-4"><Datum label="تاريخ الإصدار" value={formatDate(data.invoice.issue_date)} /><Datum label="تاريخ الاستحقاق" value={formatDate(data.invoice.due_date)} /><Datum label="العقد" value={data.invoice.contract?.contract_number ?? "—"} /><Datum label="رقم الهوية / السجل" value={data.invoice.contact?.national_id ?? "—"} /></div></section>
    <section className="surface-card overflow-hidden"><h2 className="border-b border-border px-5 py-4 text-[14px] font-bold">بنود الفاتورة</h2><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-right text-[13px]"><thead><tr className="border-b border-border bg-muted/50"><th className="p-3">الوصف</th><th className="p-3">الكمية</th><th className="p-3">سعر الوحدة</th><th className="p-3">الإجمالي</th></tr></thead><tbody>{data.items.map((item) => <tr key={item.id} className="border-b border-border"><td className="p-3 font-semibold">{item.description}</td><td className="p-3">{item.quantity}</td><td className="p-3">{formatCurrency(item.unit_price)}</td><td className="p-3 font-bold">{formatCurrency(item.total)}</td></tr>)}</tbody></table></div><div className="ms-auto grid max-w-sm gap-2 p-5 text-[13px]"><Sum label="قبل الضريبة" value={data.invoice.subtotal} /><Sum label="الضريبة" value={data.invoice.vat_amount} /><Sum label="الإجمالي" value={data.invoice.total} strong /></div></section>
    <section className="surface-card overflow-hidden"><header className="border-b border-border px-5 py-4"><h2 className="text-[14px] font-bold">سجل المدفوعات</h2></header><div className="space-y-2 p-4">{data.payments.map((row) => <div key={row.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4"><strong>{formatCurrency(row.amount)}</strong><span>{formatDate(row.paid_at)}</span><span>{row.method ?? "—"}</span><span dir="ltr">{row.reference ?? "—"}</span></div>)}{!data.payments.length ? <p className="py-7 text-center text-[12.5px] text-muted-foreground">لم تُسجل دفعات بعد</p> : null}</div></section>
    <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="تسجيل دفعة" subtitle={`المتبقي ${formatCurrency(remaining)}`} footer={<><PrimaryButton onClick={() => recordPayment.mutate()} disabled={recordPayment.isPending}>{recordPayment.isPending ? <Loader2 className="size-4 animate-spin" /> : null}حفظ الدفعة</PrimaryButton><GhostButton onClick={() => setPaymentOpen(false)}>إلغاء</GhostButton></>}><div className="grid gap-4 sm:grid-cols-2"><Field label="المبلغ"><input className={inputClass} dir="ltr" inputMode="decimal" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></Field><Field label="تاريخ السداد"><input type="date" className={inputClass} value={payment.paid_at} onChange={(event) => setPayment({ ...payment, paid_at: event.target.value })} /></Field><Field label="طريقة الدفع"><select className={inputClass} value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}><option value="bank_transfer">تحويل بنكي</option><option value="cash">نقدي</option><option value="card">بطاقة</option><option value="check">شيك</option></select></Field><Field label="المرجع"><input className={inputClass} dir="ltr" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} /></Field></div></Modal>
    <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="حذف الفاتورة" subtitle={`سيتم حذف الفاتورة ${data.invoice.invoice_number} نهائيًا`} footer={<><Button variant="destructive" onClick={() => deleteInvoice.mutate()} disabled={deleteInvoice.isPending}>{deleteInvoice.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}حذف نهائي</Button><GhostButton onClick={() => setDeleteOpen(false)} disabled={deleteInvoice.isPending}>إلغاء</GhostButton></>}><p className="text-sm leading-7 text-muted-foreground">سيتم حذف بنود الفاتورة وكل الدفعات المسجلة عليها. لا يمكن التراجع عن هذا الإجراء.</p></Modal>
  </>;
}
function Datum({ label, value }: { label: string; value: string }) { return <div className="bg-card p-4"><p className="text-[11.5px] text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p></div>; }
function Sum({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <div className={strong ? "flex justify-between border-t border-border pt-3 text-[15px] font-bold text-primary" : "flex justify-between"}><span>{label}</span><span>{formatCurrency(value)}</span></div>; }