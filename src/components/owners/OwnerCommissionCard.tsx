import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Percent, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { commissionBreakdown, parseCommissionRate } from "@/lib/owner-commission";

type Contract = { id: string; contract_number: string | null; annual_rent: number | null; status: string | null; tenant?: { full_name?: string | null } | null; unit?: { unit_number?: string | null } | null };
type Payment = { contract_id: string; amount_due: number; amount_paid: number; status: string };

const sar = (n: number) => `${n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ر.س`;

export function OwnerCommissionCard({
  ownerId,
  rate,
  contracts,
  payments,
}: {
  ownerId: string;
  rate: number | null;
  contracts: Contract[];
  payments: Payment[];
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(rate != null ? String(rate) : "");

  const save = useMutation({
    mutationFn: async () => {
      const next = parseCommissionRate(value);
      const { error } = await supabase.from("contacts").update({ commission_rate: next }).eq("id", ownerId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-dossier", ownerId] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("تم حفظ النسبة");
      setEditing(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحفظ"),
  });

  const rows = useMemo(() => {
    const active = contracts.filter((c) => c.status === "active");
    return active.map((c) => {
      const list = payments.filter((p) => p.contract_id === c.id && p.status !== "cancelled");
      const collected = list.reduce((s, p) => s + Number(p.amount_paid), 0);
      return { c, b: commissionBreakdown(Number(c.annual_rent ?? 0), collected, rate) };
    });
  }, [contracts, payments, rate]);

  const total = useMemo(() => {
    const rent = rows.reduce((s, r) => s + r.b.rent, 0);
    const collected = rows.reduce((s, r) => s + r.b.collected, 0);
    return commissionBreakdown(rent, collected, rate);
  }, [rows, rate]);

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-accent/40 p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            {rate != null ? <span className="text-xl font-extrabold">{rate}%</span> : <Percent className="size-7" />}
          </div>
          <div>
            <h2 className="text-base font-bold">نسبة المكتب من المالك</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              الحسبة على الإيجار السنوي للعقود السارية، ومقرّبة لأقرب نصف ريال.
            </p>
          </div>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              dir="ltr"
              inputMode="decimal"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="10"
              className="h-10 w-24 rounded-lg border border-input bg-background px-3 text-center text-sm font-bold"
            />
            <span className="text-sm font-bold">%</span>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground"
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              حفظ
            </button>
            <button type="button" onClick={() => setEditing(false)} className="h-10 px-2 text-[13px] text-muted-foreground">
              إلغاء
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setValue(rate != null ? String(rate) : "");
              setEditing(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-primary/40 bg-card px-4 text-[13px] font-semibold text-primary hover:bg-accent"
          >
            <Pencil className="size-4" />
            {rate != null ? "تعديل النسبة" : "حدّد النسبة"}
          </button>
        )}
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Box label="الدخل السنوي" value={sar(total.rent)} hint={`${rows.length} عقد ساري`} />
        <Box label="المحصّل" value={sar(total.collected)} hint={`المتبقي ${sar(total.remaining)}`} />
        <Box label="نصيب المكتب المتوقع" value={sar(total.officeExpected)} hint={`المحصّل منه ${sar(total.officeCollected)}`} strong />
        <Box label="صافي المالك المتوقع" value={sar(total.ownerExpected)} hint={`المحصّل منه ${sar(total.ownerCollected)}`} />
      </div>

      {rows.length ? (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-[12.5px]">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                {["العقد", "المستأجر / الوحدة", "الإيجار السنوي", "المحصّل", "المتبقي", "نصيب المكتب", "المكتب من المحصّل", "صافي المالك"].map((h) => (
                  <th key={h} className="px-3 py-2 text-start font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, b }) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold" dir="ltr">{c.contract_number ?? "—"}</td>
                  <td className="px-3 py-2">{c.tenant?.full_name ?? "—"}{c.unit?.unit_number ? ` • وحدة ${c.unit.unit_number}` : ""}</td>
                  <td className="px-3 py-2">{sar(b.rent)}</td>
                  <td className="px-3 py-2 text-success">{sar(b.collected)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{sar(b.remaining)}</td>
                  <td className="px-3 py-2 font-bold text-primary">{sar(b.officeExpected)}</td>
                  <td className="px-3 py-2">{sar(b.officeCollected)}</td>
                  <td className="px-3 py-2">{sar(b.ownerExpected)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border bg-muted/40 font-bold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>الإجمالي</td>
                <td className="px-3 py-2">{sar(total.rent)}</td>
                <td className="px-3 py-2">{sar(total.collected)}</td>
                <td className="px-3 py-2">{sar(total.remaining)}</td>
                <td className="px-3 py-2 text-primary">{sar(total.officeExpected)}</td>
                <td className="px-3 py-2">{sar(total.officeCollected)}</td>
                <td className="px-3 py-2">{sar(total.ownerExpected)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="border-t border-border p-5 text-center text-xs text-muted-foreground">لا توجد عقود سارية لهذا المالك بعد.</p>
      )}
    </section>
  );
}

function Box({ label, value, hint, strong }: { label: string; value: string; hint: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "border-primary/40 bg-accent" : "border-border bg-card"}`}>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className={`mt-1 block text-lg font-extrabold ${strong ? "text-primary" : ""}`}>{value}</span>
      <span className="mt-1 block text-[11.5px] text-muted-foreground">{hint}</span>
    </div>
  );
}
