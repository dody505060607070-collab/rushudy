import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileText, Loader2, Pencil, PenLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { GhostButton, Modal, PrimaryButton } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { SignaturePad } from "@/components/kit/SignaturePad";
import { Toggle } from "@/components/kit/Toggle";
import { supabase } from "@/integrations/supabase/client";
import { deleteContractWithOwner } from "@/lib/delete-helpers";

export const Route = createFileRoute("/_authenticated/contracts/$contractId")({
  component: ContractViewPage,
});

const money = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("ar-SA")} ر.س`;

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  active: "ساري",
  expired: "منتهٍ",
  terminated: "ملغي",
  renewed: "مجدد",
  pending: "قيد الانتظار",
  partial: "مدفوع جزئيًا",
  paid: "مدفوع",
  overdue: "متأخر",
  cancelled: "ملغي",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13.5px] font-semibold text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-border bg-accent/40 px-5 py-3">
        <h2 className="text-[14px] font-bold text-foreground">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ContractViewPage() {
  const { contractId } = Route.useParams();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [alsoOwner, setAlsoOwner] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signature, setSignature] = useState("");
  const [signerName, setSignerName] = useState("");



  const contract = useQuery({
    queryKey: ["contract-view", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(
          "*, owner:contacts!contracts_owner_id_fkey(full_name, phone, national_id, email), tenant:contacts!contracts_tenant_id_fkey(full_name, phone, national_id, email), broker:contacts!contracts_broker_id_fkey(full_name, phone), property:properties(id, code, name, city, district, property_type), unit:units(id, unit_number, unit_type, floor, area, status)",
        )
        .eq("id", contractId)
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, any> | null;
    },
  });

  const payments = useQuery({
    queryKey: ["contract-view-payments", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_payments")
        .select("id, payment_number, due_date, amount_due, amount_paid, status")
        .eq("contract_id", contractId)
        .order("payment_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invoices = useQuery({
    queryKey: ["contract-view-invoices", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, total, status")
        .eq("contract_id", contractId)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const signatures = useQuery({ queryKey: ["contract-signatures", contractId], queryFn: async () => {
    const { data, error } = await supabase.from("contract_signatures").select("id,signer_name,signer_role,image_data,signed_at").eq("contract_id", contractId).order("signed_at", { ascending: false });
    if (error) throw error; return data ?? [];
  }});

  const saveSignature = useMutation({ mutationFn: async () => {
    if (!signerName.trim()) throw new Error("اكتب اسم الموقّع"); if (!signature) throw new Error("أضف التوقيع");
    const { data: auth } = await supabase.auth.getUser(); const { error } = await supabase.from("contract_signatures").insert({ contract_id: contractId, signer_name: signerName.trim(), signer_role: "staff", image_data: signature, created_by: auth.user?.id ?? null }); if (error) throw error;
  }, onSuccess: () => { void signatures.refetch(); setSignatureOpen(false); setSignature(""); setSignerName(""); toast.success("تم حفظ التوقيع الإلكتروني"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر حفظ التوقيع") });

  const extraction = useQuery({
    queryKey: ["contract-view-extraction", contractId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contract_imports")
        .select("extraction, warnings, file_name, created_at")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false })
        .limit(1);
      return (data?.[0] ?? null) as Record<string, any> | null;
    },
  });


  const c: any = contract.data;
  const ex: Record<string, any> = (extraction.data?.["extraction"] as Record<string, any>) ?? {};
  const extractedUnits: any[] = Array.isArray(ex["units"]) ? ex["units"] : [];
  const importWarnings: string[] = Array.isArray(extraction.data?.["warnings"])
    ? (extraction.data?.["warnings"] as string[])
    : [];

  const extraFields: { label: string; value: any }[] = [
    { label: "رقم العقد في إيجار", value: ex["contract_number"] },
    { label: "تاريخ التوثيق", value: ex["signed_date"] },
    { label: "مكان التوثيق", value: ex["city"] },
    { label: "الحي", value: ex["district"] },
    { label: "نوع العقار", value: ex["property_type"] },
    { label: "استخدام العقار", value: ex["property_usage"] },
    { label: "أرقام الوحدات", value: ex["unit_number"] },
    { label: "المالك", value: ex["owner_name"] },
    { label: "هوية المالك", value: ex["owner_national_id"] },
    { label: "جوال المالك", value: ex["owner_phone"] },
    { label: "بريد المالك", value: ex["owner_email"] },
    { label: "المستأجر", value: ex["tenant_name"] },
    { label: "هوية المستأجر", value: ex["tenant_national_id"] },
    { label: "السجل التجاري", value: ex["tenant_cr_number"] },
    { label: "ممثل المنشأة", value: ex["tenant_rep_name"] },
    { label: "هوية الممثل", value: ex["tenant_rep_national_id"] },
    { label: "جوال الممثل", value: ex["tenant_rep_phone"] },
    { label: "جوال المستأجر", value: ex["tenant_phone"] },
    { label: "بريد المستأجر", value: ex["tenant_email"] },
    { label: "منشأة الوساطة", value: ex["broker_entity_name"] },
    { label: "الوسيط", value: ex["broker_name"] },
    { label: "جوال الوسيط", value: ex["broker_phone"] },
    { label: "الإيجار السنوي", value: ex["annual_rent"] },
    { label: "القيمة الإجمالية", value: ex["total_value"] },
    { label: "ضريبة القيمة المضافة", value: ex["vat"] },
    { label: "التأمين", value: ex["deposit"] },
    { label: "دورة السداد", value: ex["payment_cycle"] },
    { label: "عدد الدفعات", value: ex["payments_count"] },
  ].filter((f) => f.value != null && String(f.value).trim() !== "");


  const remove = useMutation({
    mutationFn: async (alsoOwner: boolean) =>
      deleteContractWithOwner(contractId, (c?.owner_id as string | null) ?? null, alsoOwner),
    onSuccess: () => {
      toast.success("تم حذف العقد");
      navigate({ to: "/contracts" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHero
        title={c?.contract_number ? `العقد ${c.contract_number}` : "تفاصيل العقد"}
        subtitle="عرض كامل لبيانات العقد وأطرافه والعقار والأقساط والفواتير — للاطلاع فقط."
        icon={FileText}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/contracts"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary"
        >
          <ArrowRight className="size-4" />
          رجوع لإدارة العقود
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/contracts"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold hover:bg-muted"
          >
            <Pencil className="size-4" />
            تعديل العقد
          </Link>
          <button type="button" onClick={() => setSignatureOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold hover:bg-muted"><PenLine className="size-4" />توقيع العقد</button>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => setConfirmOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-destructive px-4 text-[13px] font-semibold text-destructive-foreground disabled:opacity-60"
          >
            {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            حذف العقد
          </button>

          <Modal
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title={`حذف العقد ${c?.contract_number ?? ""}`}
            subtitle="لا يمكن التراجع عن هذا الإجراء."
            footer={
              <>
                <PrimaryButton onClick={() => remove.mutate(alsoOwner)} disabled={remove.isPending}>
                  {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  تأكيد الحذف
                </PrimaryButton>
                <GhostButton onClick={() => setConfirmOpen(false)}>إلغاء</GhostButton>
              </>
            }
          >
            <div className="space-y-3 text-[13px]">
              <label className="flex items-center gap-2 font-semibold">
                <Toggle
                  label="حذف المالك أيضًا"
                  checked={alsoOwner}
                  onChange={(v) => setAlsoOwner(v)}
                />
                حذف المالك المرتبط بالعقد أيضًا {c?.owner?.full_name ? `(${c.owner.full_name})` : ""}
              </label>
              <p className="text-[12px] text-muted-foreground">
                عند التفعيل سيتم حذف المالك وكل عقوده الأخرى، مع فصل عقاراته ووحداته.
              </p>
            </div>
          </Modal>
          <Modal open={signatureOpen} onClose={() => setSignatureOpen(false)} title="التوقيع الإلكتروني" subtitle="يُحفظ اسم الموقّع والتاريخ مع العقد." footer={<><PrimaryButton onClick={() => saveSignature.mutate()} disabled={saveSignature.isPending}>حفظ التوقيع</PrimaryButton><GhostButton onClick={() => setSignatureOpen(false)}>إلغاء</GhostButton></>}><div className="space-y-4"><label className="grid gap-1 text-[12.5px] font-semibold">اسم الموقّع<input className="h-10 rounded-lg border border-input bg-background px-3" value={signerName} onChange={(e) => setSignerName(e.target.value)} /></label><SignaturePad onChange={setSignature} /></div></Modal>
        </div>
      </div>

      {contract.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : !c ? (
        <p className="surface-card p-6 text-center text-[13px] text-muted-foreground">
          العقد غير موجود.
        </p>
      ) : (
        <div className="space-y-5">
          <Section title="بيانات العقد">
            <div className="grid gap-3 sm:grid-cols-3">
              <Row label="رقم العقد" value={c.contract_number} />
              <Row
                label="الحالة"
                value={
                  <Chip tone={c.status === "active" ? "success" : c.status === "draft" ? "warning" : "danger"}>
                    {statusLabels[c.status] ?? c.status}
                  </Chip>
                }
              />
              <Row label="نوع العقد" value={c.contract_type === "sale" ? "بيع" : "إيجار"} />
              <Row label="تاريخ البداية" value={c.start_date} />
              <Row label="تاريخ النهاية" value={c.end_date} />
              <Row label="دورة السداد" value={c.payment_cycle} />
              <Row label="الإيجار السنوي" value={money(c.annual_rent)} />
              <Row label="القيمة الإجمالية" value={money(c.total_value)} />
              <Row label="التأمين" value={money(c.deposit)} />
              <Row label="عدد الدفعات" value={c.payments_count} />
              <Row label="المصدر" value={c.source === "import" ? "استيراد PDF" : "إدخال يدوي"} />
              <Row label="تاريخ الإنشاء" value={c.created_at?.slice(0, 10)} />
            </div>
            {c.notes ? (
              <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-[13px] text-foreground">{c.notes}</p>
            ) : null}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="المالك">
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="الاسم" value={c.owner?.full_name} />
                <Row label="رقم الهوية" value={c.owner?.national_id} />
                <Row label="الجوال" value={c.owner?.phone} />
                <Row label="البريد" value={c.owner?.email} />
              </div>
            </Section>
            <Section title="المستأجر / المشتري">
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="الاسم" value={c.tenant?.full_name} />
                <Row label="رقم الهوية" value={c.tenant?.national_id} />
                <Row label="الجوال" value={c.tenant?.phone} />
                <Row label="البريد" value={c.tenant?.email} />
              </div>
            </Section>
          </div>

          <Section title="العقارات والوحدات">
            {c.property ? (
              <Link
                to="/properties"
                className="mb-3 block rounded-xl border border-border p-3 transition hover:bg-accent/40"
              >
                <p className="text-[13.5px] font-bold text-foreground">{c.property.name}</p>
                <p className="text-[12px] text-muted-foreground">
                  {[c.property.code, c.property.property_type, c.property.city, c.property.district]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </Link>
            ) : (
              <p className="mb-3 rounded-xl bg-secondary/60 p-3 text-[12.5px] text-muted-foreground">
                لا يوجد عقار مسجّل مرتبط بهذا العقد — أضف العقار يدويًا أو أعد استيراد الملف.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(extractedUnits.length
                ? extractedUnits
                : c.unit
                  ? [c.unit]
                  : []
              ).map((u: any, i: number) => (
                <div key={u.id ?? `${u.unit_number}-${i}`} className="rounded-xl border border-border p-3">
                  <p className="text-[13px] font-bold text-foreground">
                    وحدة رقم {u.unit_number || "—"}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {[u.unit_type, u.floor ? `الدور ${u.floor}` : null, u.area ? `${u.area} م²` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              ))}
              {!extractedUnits.length && !c.unit ? (
                <p className="p-2 text-[12.5px] text-muted-foreground">
                  لم تُذكر وحدات مستقلة في هذا العقد.
                </p>
              ) : null}
            </div>
          </Section>


          <Section title={`جدول الأقساط (${payments.data?.length ?? 0})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead className="bg-secondary/60 text-[12px] text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">#</th>
                    <th className="p-2 text-start">تاريخ الاستحقاق</th>
                    <th className="p-2 text-start">المستحق</th>
                    <th className="p-2 text-start">المدفوع</th>
                    <th className="p-2 text-start">المتبقي</th>
                    <th className="p-2 text-start">الحالة</th>
                    <th className="p-2 text-start">السداد</th>
                  </tr>
                </thead>
                <tbody>
                  {(payments.data ?? []).map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-2 font-semibold">{p.payment_number}</td>
                      <td className="p-2">{p.due_date}</td>
                      <td className="p-2">{money(p.amount_due)}</td>
                      <td className="p-2">{money(p.amount_paid)}</td>
                      <td className="p-2">
                        {money(Math.max(0, Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0)))}
                      </td>
                      <td className="p-2">
                        <Chip
                          tone={
                            p.status === "paid"
                              ? "success"
                              : p.status === "overdue"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {statusLabels[p.status] ?? p.status}
                        </Chip>
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => setPayingPayment(p)}
                          className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-[12px] font-semibold text-primary"
                        >
                          {p.status === "paid" ? "تعديل السداد" : "تسجيل سداد"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!payments.data?.length ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-muted-foreground">
                        لا توجد أقساط مسجلة على هذا العقد.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={`الفواتير (${invoices.data?.length ?? 0})`}>
            <div className="space-y-2">
              {(invoices.data ?? []).map((inv) => (
                <Link
                  key={inv.id}
                  to="/invoices/$invoiceId"
                  params={{ invoiceId: inv.id }}
                  className="flex items-center justify-between rounded-xl border border-border p-3 text-[13px] transition hover:bg-accent/40"
                >
                  <span className="font-semibold text-foreground">{inv.invoice_number}</span>
                  <span className="text-muted-foreground">{inv.issue_date}</span>
                  <span className="font-semibold">{money(inv.total)}</span>
                  <Chip tone={inv.status === "paid" ? "success" : "warning"}>
                    {statusLabels[inv.status] ?? inv.status}
                  </Chip>
                </Link>
              ))}
              {!invoices.data?.length ? (
                <p className="p-3 text-center text-[13px] text-muted-foreground">
                  لا توجد فواتير مرتبطة بهذا العقد.
                </p>
              ) : null}
            </div>
          </Section>

          <Section title={`التوقيعات الإلكترونية (${signatures.data?.length ?? 0})`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(signatures.data ?? []).map((row) => <article key={row.id} className="rounded-xl border border-border p-3"><img src={row.image_data} alt={`توقيع ${row.signer_name}`} className="h-24 w-full rounded-lg bg-card object-contain" /><p className="mt-2 text-[13px] font-bold">{row.signer_name}</p><p className="text-[11.5px] text-muted-foreground">{new Date(row.signed_at).toLocaleString("ar-SA")}</p></article>)}{!signatures.data?.length ? <p className="text-[12.5px] text-muted-foreground">لم يُضف أي توقيع بعد.</p> : null}</div>
          </Section>

          {extraFields.length || importWarnings.length ? (
            <Section title="كل بيانات العقد كما وردت في الملف">
              {extraction.data?.["file_name"] ? (
                <p className="mb-3 text-[12px] text-muted-foreground">
                  المصدر: {String(extraction.data["file_name"])}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-3">
                {extraFields.map((f) => (
                  <Row key={f.label} label={f.label} value={String(f.value)} />
                ))}
              </div>
              {importWarnings.length ? (
                <ul className="mt-4 space-y-1 rounded-xl bg-amber-50 p-3 text-[12.5px] text-amber-900">
                  {importWarnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              ) : null}
            </Section>
          ) : null}

        </div>
      )}
    </>
  );
}
