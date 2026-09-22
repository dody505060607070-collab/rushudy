import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Banknote, Eye, Loader2, Pencil, Plus, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { StatusLegend } from "@/components/kit/StatusLegend";
import { supabase } from "@/integrations/supabase/client";
import { describeDbError } from "@/lib/db-errors";
import { invoiceStatusLabels } from "@/lib/labels";
import { rowTone, toneRowClass } from "@/lib/status-tone";

type Row = {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  vat_amount: number;
  total: number;
  status: string;
  contact: { full_name: string } | null;
  contract: { contract_number: string } | null;
  paid: number;
  remaining: number;
};

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({ meta: [
    { title: "الفواتير | الرشودي للعقارات" },
    { name: "description", content: "إدارة الفواتير وحالات السداد والمدفوعات والمبالغ المتبقية." },
    { property: "og:title", content: "الفواتير | الرشودي للعقارات" },
    { property: "og:description", content: "الفواتير الصادرة وحالات سدادها والمتبقي منها." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [payFor, setPayFor] = useState<Row | null>(null);
  const [payment, setPayment] = useState({ amount: "", paid_at: new Date().toISOString().slice(0, 10), method: "bank_transfer", reference: "" });
  const list = useQuery({
    queryKey: ["invoices", "full-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("id, invoice_number, issue_date, due_date, subtotal, vat_amount, total, status, contact:contact_id(full_name), contract:contract_id(contract_number)").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const base = (data ?? []) as Omit<Row, "paid" | "remaining">[];
      const ids = base.map((row) => row.id);
      const paidMap = new Map<string, number>();
      if (ids.length) {
        const payments = await supabase.from("invoice_payments").select("invoice_id, amount").in("invoice_id", ids);
        if (payments.error) throw payments.error;
        for (const row of payments.data ?? []) {
          paidMap.set(row.invoice_id, (paidMap.get(row.invoice_id) ?? 0) + Number(row.amount ?? 0));
        }
      }
      return base.map((row) => {
        const paid = paidMap.get(row.id) ?? 0;
        return { ...row, paid, remaining: Math.max(0, Number(row.total ?? 0) - paid) } as Row;
      });
    },
  });
  const rows = list.data ?? [];
  const stats = useMemo(() => ({
    sent: rows.filter((row) => ["unpaid", "partial", "overdue"].includes(row.status)).length,
    paid: rows.filter((row) => row.status === "paid").length,
    outstanding: rows.filter((row) => !["paid", "cancelled"].includes(row.status)).reduce((sum, row) => sum + row.remaining, 0),
  }), [rows]);

  const openPayment = (row: Row) => {
    setPayment({ amount: String(row.remaining), paid_at: new Date().toISOString().slice(0, 10), method: "bank_transfer", reference: "" });
    setPayFor(row);
  };

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!payFor) throw new Error("لم يتم اختيار فاتورة");
      const amount = Number(payment.amount);
      if (!amount || amount <= 0) throw new Error("أدخل مبلغًا صحيحًا");
      const insert = await supabase.from("invoice_payments").insert({ invoice_id: payFor.id, amount, paid_at: payment.paid_at, method: payment.method, reference: payment.reference.trim() || null });
      if (insert.error) throw new Error(describeDbError(insert.error));
      const newPaid = payFor.paid + amount;
      const status = newPaid >= Number(payFor.total) ? "paid" : "partial";
      const update = await supabase.from("invoices").update({ status }).eq("id", payFor.id);
      if (update.error) throw new Error(describeDbError(update.error));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail"] });
      setPayFor(null);
      toast.success("تم تسجيل الدفعة وتحديث المتبقي");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر تسجيل الدفعة"),
  });

  return <>
    <PageHero title="الفواتير" subtitle="إدارة الفواتير وحالات إصدارها وسدادها" icon={ReceiptText} stats={[
      { value: String(stats.sent), label: "فاتورة مرسلة" },
      { value: String(stats.paid), label: "فاتورة مدفوعة" },
      { value: formatCurrency(stats.outstanding), label: "المتبقي المستحق" },
    ]} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link to="/invoice-form" search={{ id: "", ownerId: "" }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground"><Plus className="size-4" />إنشاء فاتورة</Link>
      <nav className="text-[12.5px] text-muted-foreground">الفواتير &nbsp; / &nbsp; القائمة</nav>
    </div>
    {list.isLoading ? <div className="surface-card grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div> :
      <div className="space-y-3"><StatusLegend /><DataTable<Row> rows={rows} rowClassName={(r) => toneRowClass[rowTone(r.status, r.due_date)]} onRowClick={(r) => navigate({ to: "/invoices/$invoiceId", params: { invoiceId: r.id } })} showColumnsButton selectable dragLabel="فاتورة" exportFileName="قائمة الفواتير" searchPlaceholder="بحث برقم الفاتورة أو المالك" emptyState={<EmptyState text="لا توجد فواتير" hint="أنشئ فاتورة جديدة لتظهر هنا مع حالة السداد." />} columns={[
        { header: "رقم الفاتورة", sortable: true, value: (r) => r.invoice_number, cell: (r) => <Link to="/invoices/$invoiceId" params={{ invoiceId: r.id }} dir="ltr" className="font-bold text-primary hover:underline">{r.invoice_number}</Link> },
        { header: "المالك", value: (r) => r.contact?.full_name, cell: (r) => r.contact?.full_name ?? "—" },
        { header: "التاريخ", sortable: true, value: (r) => r.issue_date, cell: (r) => formatDate(r.issue_date) },
        { header: "الاستحقاق", sortable: true, value: (r) => r.due_date, cell: (r) => formatDate(r.due_date) },
        { header: "الحالة", value: (r) => invoiceStatusLabels[r.status] ?? r.status, cell: (r) => <Chip tone={rowTone(r.status, r.due_date)}>{invoiceStatusLabels[r.status] ?? r.status}</Chip> },
        { header: "قبل الضريبة", sortable: true, value: (r) => r.subtotal, cell: (r) => formatCurrency(r.subtotal) },
        { header: "الضريبة", sortable: true, value: (r) => r.vat_amount, cell: (r) => formatCurrency(r.vat_amount) },
        { header: "الإجمالي", sortable: true, value: (r) => r.total, cell: (r) => <strong>{formatCurrency(r.total)}</strong> },
        { header: "المدفوع", sortable: true, value: (r) => r.paid, cell: (r) => <span className="font-semibold text-emerald-600">{formatCurrency(r.paid)}</span> },
        { header: "المتبقي", sortable: true, value: (r) => r.remaining, cell: (r) => r.remaining > 0 ? <span className="font-bold text-destructive">{formatCurrency(r.remaining)}</span> : <span className="font-semibold text-muted-foreground">مسدّدة</span> },
        { header: "إجراءات", cell: (r) => <div className="flex items-center gap-1">{r.remaining > 0 ? <button type="button" onClick={(event) => { event.stopPropagation(); openPayment(r); }} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary" aria-label="تسجيل دفعة" title="تسجيل المدفوع والمتبقي"><Banknote className="size-4" /></button> : null}<Link to="/invoices/$invoiceId" params={{ invoiceId: r.id }} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary" aria-label="عرض الفاتورة" title="عرض وتسجيل دفعة"><Eye className="size-4" /></Link><Link to="/invoice-form" search={{ id: r.id, ownerId: "" }} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary" aria-label="تعديل الفاتورة" title="تعديل"><Pencil className="size-4" /></Link></div> },
      ]} /></div>}
    <Modal open={Boolean(payFor)} onClose={() => setPayFor(null)} title={payFor ? `تسجيل دفعة — فاتورة ${payFor.invoice_number}` : "تسجيل دفعة"} subtitle={payFor ? `الإجمالي ${formatCurrency(payFor.total)} · المدفوع ${formatCurrency(payFor.paid)} · المتبقي ${formatCurrency(payFor.remaining)}` : ""} footer={<><PrimaryButton onClick={() => recordPayment.mutate()} disabled={recordPayment.isPending}>{recordPayment.isPending ? <Loader2 className="size-4 animate-spin" /> : null}حفظ الدفعة</PrimaryButton><GhostButton onClick={() => setPayFor(null)}>إلغاء</GhostButton></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="المبلغ المدفوع الآن"><input className={inputClass} dir="ltr" inputMode="decimal" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></Field>
        <Field label="تاريخ السداد"><input type="date" className={inputClass} value={payment.paid_at} onChange={(event) => setPayment({ ...payment, paid_at: event.target.value })} /></Field>
        <Field label="طريقة الدفع"><select className={inputClass} value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}><option value="bank_transfer">تحويل بنكي</option><option value="cash">نقدي</option><option value="card">بطاقة</option><option value="check">شيك</option></select></Field>
        <Field label="المرجع"><input className={inputClass} dir="ltr" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} /></Field>
      </div>
      <p className="mt-3 text-[12.5px] text-muted-foreground">سيتبقى بعد هذه الدفعة: {payFor ? formatCurrency(Math.max(0, payFor.remaining - (Number(payment.amount) || 0))) : "—"}</p>
    </Modal>
  </>;
}
