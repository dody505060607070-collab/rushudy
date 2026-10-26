import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PenLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SignaturePad } from "@/components/kit/SignaturePad";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPortalContract } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/contracts/$contractId")({
  head: () => ({
    meta: [
      { title: "جدول الأقساط | بوابة عميل الرشودي للعقارات" },
      { name: "description", content: "تفاصيل العقد وجدول الأقساط والمدفوع والمتبقي." },
      { property: "og:title", content: "جدول الأقساط | بوابة عميل الرشودي للعقارات" },
      { property: "og:description", content: "تفاصيل العقد وجدول الأقساط والمدفوع والمتبقي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContractDetail,
});

const money = (v: number) => Number(v ?? 0).toLocaleString("en-US");

const statusChip: Record<string, { label: string; cls: string }> = {
  paid: { label: "مدفوعة", cls: "bg-emerald-50 text-emerald-700" },
  partial: { label: "مدفوع جزئياً", cls: "bg-blue-50 text-blue-700" },
  overdue: { label: "متأخر", cls: "bg-destructive/10 text-destructive" },
  pending: { label: "قادمة", cls: "bg-amber-50 text-amber-700" },
  cancelled: { label: "ملغاة", cls: "bg-muted text-muted-foreground" },
};

function ContractDetail() {
  const { contractId } = Route.useParams();
  const queryClient = useQueryClient();
  const [signature, setSignature] = useState("");
  const [signerName, setSignerName] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-contract", contractId],
    queryFn: () => getPortalContract({ data: { contractId } }),
  });

  const c = data.contract as unknown as {
    contract_number: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    payment_cycle: string | null;
    payments_count: number | null;
    annual_rent: number | null;
    total_value: number | null;
    property: { name: string; city: string | null; district: string | null } | null;
    unit: { unit_number: string | null; unit_type: string | null } | null;
  };
  const signatures = useQuery({ queryKey: ["portal-contract-signatures", contractId], enabled: Boolean(data), queryFn: async () => { const { data: rows, error: signatureError } = await supabase.from("contract_signatures").select("id,signer_name,image_data,signed_at").eq("contract_id", contractId).order("signed_at", { ascending: false }); if (signatureError) throw signatureError; return rows ?? []; } });
  const sign = useMutation({ mutationFn: async () => { if (!signerName.trim() || !signature) throw new Error("اكتب اسمك وأضف توقيعك"); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) throw new Error("يجب تسجيل الدخول"); const { error: signError } = await supabase.from("contract_signatures").insert({ contract_id: contractId, signer_name: signerName.trim(), signer_role: "tenant", image_data: signature, created_by: auth.user.id }); if (signError) throw signError; }, onSuccess: () => { setSignature(""); setSignerName(""); void queryClient.invalidateQueries({ queryKey: ["portal-contract-signatures", contractId] }); toast.success("تم توقيع العقد بنجاح"); }, onError: (signError) => toast.error(signError instanceof Error ? signError.message : "تعذّر التوقيع") });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;
  const totalDue = data.payments.reduce((s, p) => s + Number(p.amount_due), 0);
  const totalPaid = data.payments.reduce((s, p) => s + Number(p.amount_paid), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="text-xs text-muted-foreground">
          <Link to="/portal/contracts" className="hover:text-foreground">العقود</Link> › {c.contract_number}
        </nav>
        <Link to="/portal/contracts" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">
          رجوع للعقود
        </Link>
      </div>


      <section className="rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h1 className="text-lg font-bold text-primary">تفاصيل العقد</h1>
            <p className="text-xs text-muted-foreground">{c.contract_number}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {c.status === "active" ? "نشط" : c.status}
          </span>
        </header>
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">العقار</dt>
            <dd className="font-semibold">{c.property?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">الوحدة</dt>
            <dd className="font-semibold">{c.unit?.unit_number ? `${c.unit.unit_type ?? "وحدة"} — ${c.unit.unit_number}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">الإيجار السنوي</dt>
            <dd className="font-semibold">{money(Number(c.annual_rent ?? 0))} ر.س</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">تاريخ البداية</dt>
            <dd className="font-semibold">{c.start_date ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">تاريخ الانتهاء</dt>
            <dd className="font-semibold">{c.end_date ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">عدد الدفعات</dt>
            <dd className="font-semibold">{c.payments_count ?? data.payments.length}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-lg font-bold">{money(totalDue)} ر.س</p>
          <p className="text-xs text-muted-foreground">إجمالي قيمة العقد</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-lg font-bold text-emerald-600">{money(totalPaid)} ر.س</p>
          <p className="text-xs text-muted-foreground">المدفوع</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-lg font-bold text-destructive">{money(totalDue - totalPaid)} ر.س</p>
          <p className="text-xs text-muted-foreground">المتبقي</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 text-sm font-bold">
          <span>جدول الأقساط</span>
          <span className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> مدفوع</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-500" /> مدفوع جزئياً</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-destructive" /> متأخر</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> قادم</span>
          </span>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">تاريخ الاستحقاق</th>
                <th className="px-4 py-3">المبلغ (ر.س)</th>
                <th className="px-4 py-3">المدفوع (ر.س)</th>
                <th className="px-4 py-3">المتبقي (ر.س)</th>
                <th className="px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.payments.map((p) => {
                const chip = statusChip[p.status] ?? { label: "قادمة", cls: "bg-muted text-muted-foreground" };
                const rest = Number(p.amount_due) - Number(p.amount_paid);
                return (
                  <tr key={p.id} className={p.status === "paid" ? "bg-success/5" : rest > 0 && p.due_date < new Date().toISOString().slice(0, 10) ? "bg-destructive/5" : ""}>
                    <td className="px-4 py-3">{p.payment_number}</td>
                    <td className="px-4 py-3">{p.due_date}</td>
                    <td className="px-4 py-3">{money(Number(p.amount_due))}</td>
                    <td className="px-4 py-3 text-emerald-700">{money(Number(p.amount_paid))}</td>
                    <td className="px-4 py-3">{rest > 0 ? money(rest) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${chip.cls}`}>{chip.label}</span>
                    </td>
                  </tr>
                );
              })}
              {data.payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">لا توجد أقساط مسجّلة.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold"><PenLine className="size-4 text-primary" />التوقيع الإلكتروني</h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div className="space-y-3"><label className="grid gap-1 text-xs font-semibold">اسم الموقّع<input className="h-10 rounded-lg border border-input bg-background px-3" value={signerName} onChange={(event) => setSignerName(event.target.value)} /></label><SignaturePad onChange={setSignature} /><Button onClick={() => sign.mutate()} disabled={sign.isPending || !signature}>توقيع العقد</Button></div>
          <div className="space-y-2">{(signatures.data ?? []).map((row) => <article key={row.id} className="rounded-lg border border-border p-3"><img src={row.image_data} alt={`توقيع ${row.signer_name}`} className="h-20 w-full object-contain" /><p className="mt-1 text-xs font-bold">{row.signer_name}</p><p className="text-[11px] text-muted-foreground">{new Date(row.signed_at).toLocaleString("ar-SA")}</p></article>)}{!signatures.data?.length ? <p className="text-xs text-muted-foreground">لم يُوقّع هذا العقد بعد.</p> : null}</div>
        </div>
      </section>
    </div>
  );
}
