import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatCurrency, formatDate } from "@/components/kit/LiveTable";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/kit/Modal";
import { supabase } from "@/integrations/supabase/client";

export type RecorderPayment = {
  id: string;
  payment_number?: number | null;
  due_date?: string | null;
  amount_due: number;
  amount_paid: number;
};

const methods = [
  { key: "cash", label: "نقدي" },
  { key: "bank_transfer", label: "تحويل بنكي" },
  { key: "card", label: "شبكة / بطاقة" },
  { key: "check", label: "شيك" },
  { key: "other", label: "أخرى" },
];

/**
 * نافذة تسجيل السداد: تدعم السداد الجزئي، وتعرض المسدّد والمتبقي،
 * وتتيح التراجع عن أي عملية سداد مسجّلة بالخطأ.
 */
export function PaymentRecorder({
  payment,
  open,
  onClose,
  onChanged,
}: {
  payment: RecorderPayment | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const due = Number(payment?.amount_due ?? 0);
  const paid = Number(payment?.amount_paid ?? 0);
  const remaining = Math.max(0, due - paid);

  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(remaining > 0 ? String(remaining) : "");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setMethod("cash");
    setReference("");
    setNotes("");
  }, [open, payment?.id, remaining]);

  const transactions = useQuery({
    queryKey: ["payment-transactions", payment?.id],
    enabled: open && Boolean(payment?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select("id, amount, paid_at, method, reference, notes, created_at")
        .eq("payment_id", payment!.id)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["payment-transactions", payment?.id] });
    onChanged?.();
  };

  const record = useMutation({
    mutationFn: async () => {
      if (!payment) throw new Error("لا توجد دفعة محددة");
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("أدخل مبلغًا صحيحًا أكبر من صفر");
      if (value > remaining + 0.01) throw new Error(`أقصى مبلغ متبقٍ ${formatCurrency(remaining)}`);
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("payment_transactions").insert({
        payment_id: payment.id,
        amount: value,
        paid_at: paidAt,
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        recorded_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل السداد");
      refresh();
      setAmount("");
      setReference("");
      setNotes("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر تسجيل السداد"),
  });

  const undo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم التراجع عن عملية السداد");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر التراجع"),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`تسجيل سداد${payment?.payment_number ? ` — دفعة رقم ${payment.payment_number}` : ""}`}
      subtitle={
        payment
          ? `المستحق ${formatCurrency(due)} · المسدّد ${formatCurrency(paid)} · المتبقي ${formatCurrency(remaining)}`
          : ""
      }
      footer={
        <>
          <PrimaryButton
            onClick={() => record.mutate()}
            disabled={record.isPending || remaining <= 0}
          >
            {record.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wallet className="size-4" />
            )}
            حفظ الدفعة
          </PrimaryButton>
          <GhostButton onClick={onClose}>إغلاق</GhostButton>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Box label="إجمالي المستحق" value={formatCurrency(due)} />
          <Box label="المسدّد حتى الآن" value={formatCurrency(paid)} tone="success" />
          <Box label="المتبقي" value={formatCurrency(remaining)} tone="primary" />
        </div>

        {remaining <= 0 ? (
          <p className="rounded-xl bg-success/10 p-3 text-[12.5px] font-semibold text-success">
            هذه الدفعة مسددة بالكامل. يمكنك التراجع عن أي عملية سداد من السجل بالأسفل.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="المبلغ المسدّد الآن"
              hint={`يمكن تسجيل سداد جزئي — المتبقي ${formatCurrency(remaining)}`}
            >
              <input
                className={inputClass}
                dir="ltr"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Field label="تاريخ السداد">
              <input
                type="date"
                className={inputClass}
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </Field>
            <Field label="طريقة الدفع">
              <select
                className={inputClass}
                value={method}
                onChange={(event) => setMethod(event.target.value)}
              >
                {methods.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="المرجع / رقم العملية">
              <input
                className={inputClass}
                dir="ltr"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
            <Field label="ملاحظات" className="sm:col-span-2">
              <textarea
                className={textareaClass}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              {[0.25, 0.5, 1].map((part) => (
                <button
                  key={part}
                  type="button"
                  onClick={() => setAmount(String(Math.round(remaining * part * 100) / 100))}
                  className="h-8 rounded-lg border border-border px-3 text-[12px] font-semibold text-muted-foreground hover:text-primary"
                >
                  {part === 1 ? "كامل المتبقي" : `${part * 100}% من المتبقي`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-[13px] font-bold text-foreground">سجل عمليات السداد</h3>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-[12.5px]">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">المبلغ</th>
                  <th className="p-2 text-start">التاريخ</th>
                  <th className="p-2 text-start">الطريقة</th>
                  <th className="p-2 text-start">ملاحظات</th>
                  <th className="p-2 text-start">تراجع</th>
                </tr>
              </thead>
              <tbody>
                {(transactions.data ?? []).map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="p-2 font-semibold text-success">
                      {formatCurrency(Number(t.amount))}
                    </td>
                    <td className="p-2" dir="ltr">
                      {formatDate(t.paid_at)}
                    </td>
                    <td className="p-2">
                      {methods.find((m) => m.key === t.method)?.label ?? t.method ?? "—"}
                    </td>
                    <td className="p-2 text-muted-foreground">{t.notes ?? t.reference ?? "—"}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        disabled={undo.isPending}
                        onClick={() => {
                          if (window.confirm("هل أنت متأكد من الحذف؟")) undo.mutate(t.id);
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-semibold text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        <RotateCcw className="size-3.5" />
                        تراجع
                      </button>
                    </td>
                  </tr>
                ))}
                {!(transactions.data ?? []).length ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      لم تُسجّل أي عملية سداد على هذه الدفعة.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Box({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "primary";
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/50 p-3">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-[15px] font-bold ${
          tone === "success"
            ? "text-success"
            : tone === "primary"
              ? "text-primary"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
