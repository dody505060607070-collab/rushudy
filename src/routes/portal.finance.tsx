import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Banknote, CalendarDays, Download, FileSpreadsheet, Landmark, Receipt } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Empty, Field, Pill, PortalCard, Stat, btnGhost, btnPrimary, inputClass, money, num } from "@/components/portal/ui";
import { exportWorkbook } from "@/lib/export";
import { getOwnerInsights, getOwnerWorkspace, requestOwnerPayout } from "@/lib/owner-portal.functions";
import { getOwnerStatement } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/finance")({
  head: () => ({
    meta: [
      { title: "ماليتي | بوابة المالك" },
      { name: "description", content: "كشف حساب المالك، الدفعات القادمة، المتأخرات، التقرير الضريبي، وطلب تحويل المستحقات." },
      { property: "og:title", content: "ماليتي | بوابة المالك" },
      { property: "og:description", content: "كشوف الحساب والدفعات والمتأخرات وطلبات التحويل للمالك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerFinancePage,
});

const firstOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const PAYOUT_STATUS: Record<string, { label: string; tone: "muted" | "good" | "warn" | "bad" }> = {
  new: { label: "قيد المراجعة", tone: "warn" },
  approved: { label: "معتمد", tone: "info" as never },
  transferred: { label: "تم التحويل", tone: "good" },
  rejected: { label: "مرفوض", tone: "bad" },
};

function OwnerFinancePage() {
  const qc = useQueryClient();
  const insights = useQuery({ queryKey: ["owner-insights"], queryFn: () => getOwnerInsights() });
  const workspace = useQuery({ queryKey: ["owner-workspace"], queryFn: () => getOwnerWorkspace() });

  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(today());
  const [amount, setAmount] = useState("");
  const [iban, setIban] = useState("");
  const [note, setNote] = useState("");

  const statement = useMutation({
    mutationFn: () => getOwnerStatement({ data: { from, to } }),
    onSuccess: (res) => {
      exportWorkbook(`كشف-حساب-${from}-${to}`, [
        {
          name: "الدفعات",
          rows: res.rows.map((r) => ({
            العقد: r.contractNumber,
            المستأجر: r.tenant,
            الوحدة: r.unit,
            "رقم الدفعة": r.paymentNumber,
            الاستحقاق: r.dueDate,
            المستحق: r.amountDue,
            المدفوع: r.amountPaid,
            المتبقي: r.remaining,
            الحالة: r.status,
          })),
        },
        {
          name: "المصروفات",
          rows: (res.expenses ?? []).map((e) => ({
            التاريخ: e.spent_on,
            البند: e.category,
            الوصف: e.description ?? "",
            المبلغ: e.amount,
          })),
        },
      ]);
      toast.success("تم تنزيل كشف الحساب");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payout = useMutation({
    mutationFn: () =>
      requestOwnerPayout({ data: { amount: Number(amount), ibanLast4: iban, note, method: "bank" } }),
    onSuccess: () => {
      toast.success("تم إرسال طلب التحويل للمكتب");
      setAmount("");
      setIban("");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["owner-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = insights.data;
  const upcoming = useMemo(() => {
    const rows = data?.payments ?? [];
    const t = today();
    return rows.filter((p) => p.status !== "paid" && p.due_date >= t).slice(0, 12);
  }, [data]);
  const overdue = useMemo(() => {
    const rows = data?.payments ?? [];
    const t = today();
    return rows.filter((p) => p.status !== "paid" && p.due_date < t);
  }, [data]);

  if (insights.isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (insights.error) return <p className="text-sm text-destructive">{(insights.error as Error).message}</p>;
  if (!data) return null;

  const contractName = (id: string) => {
    const c = data.contracts.find((x) => x.id === id);
    return c ? `${c.contract_number} — ${c.unit?.unit_number ?? c.property?.name ?? ""}` : "—";
  };

  const printStatement = () => window.print();

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="محصّل" value={money(data.summary.collected)} tone="good" />
        <Stat label="مستحق متبقٍ" value={money(data.summary.outstanding)} tone="warn" />
        <Stat label="متأخرات" value={money(data.summary.arrears)} tone="bad" />
        <Stat label="صافي الدخل" value={money(data.summary.netIncome)} />
      </div>

      <PortalCard
        title="كشف حساب شهري / سنوي"
        icon={FileSpreadsheet}
        subtitle="حدد الفترة ثم نزّل الكشف كملف Excel أو اطبعه كملف PDF"
        action={
          <button type="button" className={btnGhost} onClick={printStatement}>
            <Download className="h-4 w-4" /> طباعة / PDF
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="من تاريخ">
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="إلى تاريخ">
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <button type="button" className={btnPrimary} disabled={statement.isPending} onClick={() => statement.mutate()}>
              <FileSpreadsheet className="h-4 w-4" /> تنزيل الكشف
            </button>
          </div>
        </div>
      </PortalCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PortalCard title="الدفعات القادمة" icon={CalendarDays} subtitle="تقويم استحقاقات المستأجرين خلال الفترة القادمة">
          {upcoming.length === 0 ? (
            <Empty text="لا توجد دفعات قادمة." />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[12.5px]">
                  <span>
                    <span className="font-semibold text-foreground">دفعة {p.payment_number}</span>
                    <span className="block text-[11px] text-muted-foreground">{contractName(p.contract_id)}</span>
                  </span>
                  <span className="text-left">
                    <span className="font-bold text-foreground">{money(Number(p.amount_due) - Number(p.amount_paid))}</span>
                    <span className="block text-[11px] text-muted-foreground">{p.due_date}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>

        <PortalCard title="متأخرات المستأجرين" icon={AlertTriangle} subtitle="دفعات تجاوزت تاريخ استحقاقها">
          {overdue.length === 0 ? (
            <Empty text="لا توجد متأخرات — ممتاز!" />
          ) : (
            <ul className="space-y-2">
              {overdue.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px]">
                  <span>
                    <span className="font-semibold text-foreground">{contractName(p.contract_id)}</span>
                    <span className="block text-[11px] text-muted-foreground">استحقت في {p.due_date}</span>
                  </span>
                  <span className="font-bold text-destructive">{money(Number(p.amount_due) - Number(p.amount_paid))}</span>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PortalCard title={`التقرير الضريبي / الزكوي ${data.taxReport.year}`} icon={Receipt} subtitle="ملخص مبسّط لمساعدتك أو مساعدة محاسبك">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="إجمالي المحصّل" value={money(data.taxReport.collected)} />
            <Stat label="إجمالي المصروفات" value={money(data.taxReport.expenses)} />
            <Stat label="عمولة المكتب" value={money(data.taxReport.commission)} />
            <Stat label="الوعاء التقديري" value={money(data.taxReport.net)} tone="good" />
          </div>
          <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-[11.5px] text-muted-foreground">
            تقدير الزكاة (2.5%): <span className="font-bold text-foreground">{money(data.taxReport.zakatEstimate)}</span> — رقم استرشادي
            فقط ولا يُغني عن المحاسب المعتمد.
          </p>
        </PortalCard>

        <PortalCard title="طلب تحويل مستحقاتي" icon={Landmark} subtitle="يصل الطلب للمكتب فورًا ويمكنك متابعة حالته هنا">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="المبلغ المطلوب">
              <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="آخر 4 أرقام من الآيبان">
              <input className={inputClass} inputMode="numeric" value={iban} onChange={(e) => setIban(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="ملاحظة">
                <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
          </div>
          <button type="button" className={`${btnPrimary} mt-3`} disabled={payout.isPending} onClick={() => payout.mutate()}>
            <Banknote className="h-4 w-4" /> إرسال الطلب
          </button>

          <div className="mt-4 space-y-2">
            {(workspace.data?.payouts ?? []).length === 0 ? (
              <Empty text="لا توجد طلبات تحويل سابقة." />
            ) : (
              (workspace.data?.payouts ?? []).map((p) => {
                const info = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS["new"]!;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[12.5px]">
                    <span>
                      <span className="font-semibold text-foreground">{money(p.amount)}</span>
                      <span className="block text-[11px] text-muted-foreground">{String(p.created_at).slice(0, 10)}</span>
                    </span>
                    <Pill tone={info.tone}>{info.label}</Pill>
                  </div>
                );
              })
            )}
          </div>
        </PortalCard>
      </div>

      <PortalCard title="تنزيل كل المستندات المالية" icon={Download} subtitle="كل دفعاتك ومصروفاتك في ملف Excel واحد">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            exportWorkbook("سجلاتي-المالية", [
              {
                name: "الدفعات",
                rows: data.payments.map((p) => ({
                  العقد: contractName(p.contract_id),
                  "رقم الدفعة": p.payment_number,
                  الاستحقاق: p.due_date,
                  المستحق: Number(p.amount_due),
                  المدفوع: Number(p.amount_paid),
                  الحالة: p.status,
                })),
              },
              {
                name: "المصروفات",
                rows: data.expenses.map((e) => ({
                  التاريخ: e.spent_on,
                  البند: e.category,
                  الوصف: e.description ?? "",
                  المبلغ: Number(e.amount),
                })),
              },
            ]);
            toast.success("تم تنزيل الملف");
          }}
        >
          <Download className="h-4 w-4" /> تنزيل {num(data.payments.length + data.expenses.length)} سجلًا
        </button>
      </PortalCard>
    </div>
  );
}
