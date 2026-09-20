import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Loader2,
  Pencil,
  PenLine,
  ReceiptText,
  ShieldCheck,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { GhostButton, Modal, PrimaryButton } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { SignaturePad } from "@/components/kit/SignaturePad";
import { Toggle } from "@/components/kit/Toggle";
import { PaymentRecorder, type RecorderPayment } from "@/components/payments/PaymentRecorder";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteContractWithOwner } from "@/lib/delete-helpers";
import { localPhone } from "@/lib/client-credentials";
import { ensureTenantContractAccount } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/contracts/$contractId")({
  head: () => ({
    meta: [
      { title: "تفاصيل العقد | الرشودي للعقارات" },
      {
        name: "description",
        content: "تفاصيل العقد وأطرافه والعقار والدفعات والفواتير والتوقيعات.",
      },
      { property: "og:title", content: "تفاصيل العقد | الرشودي للعقارات" },
      { property: "og:description", content: "عرض إداري شامل للعقد وحالته المالية والتنفيذية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: typeof FileText;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3.5">
      <p className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        {Icon ? <Icon className="size-3.5 text-primary" /> : null}
        {label}
      </p>
      <p className="mt-1 text-[13.5px] font-semibold text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-4">
        {Icon ? (
          <span className="grid size-9 place-items-center rounded-lg bg-accent text-primary">
            <Icon className="size-4" />
          </span>
        ) : null}
        <div>
          <h2 className="text-[14px] font-black text-foreground">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ContractMetric({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  hint: string;
  tone?: "primary" | "success" | "danger" | "gold";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "danger"
        ? "bg-destructive/15 text-destructive"
        : tone === "gold"
          ? "bg-gold/15 text-gold"
          : "bg-accent text-primary";
  return (
    <article className="surface-card p-4">
      <span className={`grid size-9 place-items-center rounded-lg ${toneClass}`}>
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-[11.5px] text-muted-foreground">{label}</p>
      <b className="mt-1 block text-lg text-foreground">{value}</b>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </article>
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
  const [payingPayment, setPayingPayment] = useState<RecorderPayment | null>(null);

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

  const signatures = useQuery({
    queryKey: ["contract-signatures", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_signatures")
        .select("id,signer_name,signer_role,image_data,signed_at")
        .eq("contract_id", contractId)
        .order("signed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveSignature = useMutation({
    mutationFn: async () => {
      if (!signerName.trim()) throw new Error("اكتب اسم الموقّع");
      if (!signature) throw new Error("أضف التوقيع");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("contract_signatures").insert({
        contract_id: contractId,
        signer_name: signerName.trim(),
        signer_role: "staff",
        image_data: signature,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void signatures.refetch();
      setSignatureOpen(false);
      setSignature("");
      setSignerName("");
      toast.success("تم حفظ التوقيع الإلكتروني");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر حفظ التوقيع"),
  });

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

  const paymentRows = payments.data ?? [];
  const totalDue = paymentRows.reduce((sum, payment) => sum + Number(payment.amount_due ?? 0), 0);
  const totalPaid = paymentRows.reduce((sum, payment) => sum + Number(payment.amount_paid ?? 0), 0);
  const totalRemaining = Math.max(totalDue - totalPaid, 0);
  const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;
  const overdueCount = paymentRows.filter((payment) => payment.status === "overdue").length;

  const tenantAccess = useMutation({
    mutationFn: () => ensureTenantContractAccount({ data: { contractId } }),
    onSuccess: (result) =>
      result.ok
        ? toast.success(
            `تم التفعيل — المستخدم: ${result.username} · كلمة المرور: ${result.password}`,
            {
              duration: 15000,
            },
          )
        : toast.error(result.reason ?? "تعذّر التفعيل"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر التفعيل"),
  });

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
        subtitle="مركز متابعة العقد وأطرافه والعقار والتحصيل والفواتير والتوقيعات"
        icon={FileText}
        stats={
          c
            ? [
                { value: statusLabels[c.status] ?? c.status, label: "حالة العقد" },
                { value: money(c.total_value), label: "قيمة العقد" },
                { value: `${collectionRate}%`, label: "نسبة التحصيل" },
                { value: String(paymentRows.length), label: "عدد الدفعات" },
              ]
            : []
        }
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
          <Button asChild variant="outline">
            <Link to="/contracts" search={{ edit: contractId }}>
              <Pencil />
              تعديل بيانات العقد والأطراف
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setSignatureOpen(true)}>
            <PenLine />
            توقيع العقد
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {remove.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            حذف العقد
          </Button>

          <Modal
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title={`حذف العقد ${c?.contract_number ?? ""}`}
            subtitle="لا يمكن التراجع عن هذا الإجراء."
            footer={
              <>
                <PrimaryButton onClick={() => remove.mutate(alsoOwner)} disabled={remove.isPending}>
                  {remove.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
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
                حذف المالك المرتبط بالعقد أيضًا{" "}
                {c?.owner?.full_name ? `(${c.owner.full_name})` : ""}
              </label>
              <p className="text-[12px] text-muted-foreground">
                عند التفعيل سيتم حذف المالك وكل عقوده الأخرى، مع فصل عقاراته ووحداته.
              </p>
            </div>
          </Modal>
          <Modal
            open={signatureOpen}
            onClose={() => setSignatureOpen(false)}
            title="التوقيع الإلكتروني"
            subtitle="يُحفظ اسم الموقّع والتاريخ مع العقد."
            footer={
              <>
                <PrimaryButton
                  onClick={() => saveSignature.mutate()}
                  disabled={saveSignature.isPending}
                >
                  حفظ التوقيع
                </PrimaryButton>
                <GhostButton onClick={() => setSignatureOpen(false)}>إلغاء</GhostButton>
              </>
            }
          >
            <div className="space-y-4">
              <label className="grid gap-1 text-[12.5px] font-semibold">
                اسم الموقّع
                <input
                  className="h-10 rounded-lg border border-input bg-background px-3"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                />
              </label>
              <SignaturePad onChange={setSignature} />
            </div>
          </Modal>
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ContractMetric
              icon={CircleDollarSign}
              label="إجمالي المستحق"
              value={money(totalDue)}
              hint={`${paymentRows.length} دفعة مسجلة`}
              tone="gold"
            />
            <ContractMetric
              icon={CheckCircle2}
              label="إجمالي المحصل"
              value={money(totalPaid)}
              hint={`${collectionRate}% من قيمة الدفعات`}
              tone="success"
            />
            <ContractMetric
              icon={Banknote}
              label="الرصيد المتبقي"
              value={money(totalRemaining)}
              hint={totalRemaining ? "يحتاج متابعة التحصيل" : "تم تحصيل جميع الدفعات"}
              tone={totalRemaining ? "danger" : "success"}
            />
            <ContractMetric
              icon={CalendarDays}
              label="الدفعات المتأخرة"
              value={String(overdueCount)}
              hint={overdueCount ? "دفعات تحتاج إجراء" : "لا توجد دفعات متأخرة"}
              tone={overdueCount ? "danger" : "primary"}
            />
          </div>

          <Section
            title="بيانات العقد"
            subtitle="الهوية القانونية والمدة والقيمة المالية"
            icon={FileText}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Row icon={FileText} label="رقم العقد" value={c.contract_number} />
              <Row
                label="الحالة"
                value={
                  <Chip
                    tone={
                      c.status === "active"
                        ? "success"
                        : c.status === "draft"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {statusLabels[c.status] ?? c.status}
                  </Chip>
                }
              />
              <Row label="نوع العقد" value={c.contract_type === "sale" ? "بيع" : "إيجار"} />
              <Row icon={CalendarDays} label="تاريخ البداية" value={c.start_date} />
              <Row icon={CalendarDays} label="تاريخ النهاية" value={c.end_date} />
              <Row label="دورة السداد" value={c.payment_cycle} />
              <Row label="الإيجار السنوي" value={money(c.annual_rent)} />
              <Row icon={CircleDollarSign} label="القيمة الإجمالية" value={money(c.total_value)} />
              <Row label="التأمين" value={money(c.deposit)} />
              <Row label="عدد الدفعات" value={c.payments_count} />
              <Row label="المصدر" value={c.source === "import" ? "استيراد PDF" : "إدخال يدوي"} />
              <Row label="تاريخ الإنشاء" value={c.created_at?.slice(0, 10)} />
            </div>
            {c.notes ? (
              <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-[13px] text-foreground">
                {c.notes}
              </p>
            ) : null}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="المالك" subtitle="بيانات الطرف المالك" icon={UserRound}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Row
                  label="الاسم"
                  value={
                    c.owner_id ? (
                      <Link
                        to="/owner-form"
                        search={{ id: c.owner_id }}
                        className="text-primary hover:underline"
                      >
                        {c.owner?.full_name ?? "تعديل بيانات المالك"}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row label="رقم الهوية" value={c.owner?.national_id} />
                <Row label="الجوال" value={c.owner?.phone} />
                <Row label="البريد" value={c.owner?.email} />
              </div>
            </Section>
            <Section title="المستأجر / المشتري" subtitle="بيانات الطرف المستفيد" icon={UserRound}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Row
                  label="الاسم"
                  value={
                    c.tenant_id ? (
                      <Link
                        to="/clients"
                        search={{ edit: c.tenant_id }}
                        className="text-primary hover:underline"
                      >
                        {c.tenant?.full_name ?? "تعديل بيانات المستأجر"}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row label="رقم الهوية" value={c.tenant?.national_id} />
                <Row label="الجوال" value={c.tenant?.phone} />
                <Row label="البريد" value={c.tenant?.email} />
                <Row label="اسم المستخدم في بوابة المستأجر" value={c.contract_number} />
                <Row
                  label="كلمة المرور"
                  value={localPhone(c.tenant?.phone) || "جوال المستأجر بصيغة 05xxxxxxxx"}
                />
                <div className="pt-2">
                  <GhostButton
                    onClick={() => tenantAccess.mutate()}
                    disabled={tenantAccess.isPending}
                  >
                    تفعيل حساب المستأجر
                  </GhostButton>
                </div>
              </div>
            </Section>
          </div>

          <Section
            title="العقارات والوحدات"
            subtitle="الأصل العقاري المرتبط بهذا العقد"
            icon={Building2}
          >
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
              {(extractedUnits.length ? extractedUnits : c.unit ? [c.unit] : []).map(
                (u: any, i: number) => (
                  <div
                    key={u.id ?? `${u.unit_number}-${i}`}
                    className="rounded-xl border border-border p-3"
                  >
                    <p className="text-[13px] font-bold text-foreground">
                      وحدة رقم {u.unit_number || "—"}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {[
                        u.unit_type,
                        u.floor ? `الدور ${u.floor}` : null,
                        u.area ? `${u.area} م²` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                ),
              )}
              {!extractedUnits.length && !c.unit ? (
                <p className="p-2 text-[12.5px] text-muted-foreground">
                  لم تُذكر وحدات مستقلة في هذا العقد.
                </p>
              ) : null}
            </div>
          </Section>

          <Section
            title={`جدول الأقساط (${payments.data?.length ?? 0})`}
            subtitle={`محصل ${money(totalPaid)} من ${money(totalDue)} — المتبقي ${money(totalRemaining)}`}
            icon={WalletCards}
          >
            <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <progress
                value={collectionRate}
                max={100}
                className="h-2.5 w-full overflow-hidden rounded-full accent-success"
              />
              <strong className="text-sm text-success">{collectionRate}% محصل</strong>
            </div>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPayingPayment(p)}
                          className="text-primary"
                        >
                          {p.status === "paid" ? "تعديل السداد" : "تسجيل سداد"}
                        </Button>
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

          <Section
            title={`الفواتير (${invoices.data?.length ?? 0})`}
            subtitle="كل المستندات المالية الصادرة على العقد"
            icon={ReceiptText}
          >
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

          <Section
            title={`التوقيعات الإلكترونية (${signatures.data?.length ?? 0})`}
            subtitle="التوقيعات المثبتة وتاريخ كل توقيع"
            icon={ShieldCheck}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(signatures.data ?? []).map((row) => (
                <article key={row.id} className="rounded-xl border border-border p-3">
                  <img
                    src={row.image_data}
                    alt={`توقيع ${row.signer_name}`}
                    className="h-24 w-full rounded-lg bg-card object-contain"
                  />
                  <p className="mt-2 text-[13px] font-bold">{row.signer_name}</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {new Date(row.signed_at).toLocaleString("ar-SA")}
                  </p>
                </article>
              ))}
              {!signatures.data?.length ? (
                <p className="text-[12.5px] text-muted-foreground">لم يُضف أي توقيع بعد.</p>
              ) : null}
            </div>
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

      <PaymentRecorder
        open={Boolean(payingPayment)}
        payment={payingPayment}
        onClose={() => setPayingPayment(null)}
        onChanged={() => void payments.refetch()}
      />
    </>
  );
}
