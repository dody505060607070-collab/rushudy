import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  FileUp,
  House,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { ReactNode } from "react";

import { Chip } from "@/components/kit/Chip";
import { formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { askAdminAi } from "@/lib/ai.functions";
import { exportWorkbook, type ExportRow } from "@/lib/export";
import { contractStatusLabels, invoiceStatusLabels } from "@/lib/labels";
import { ImportDialog } from "@/routes/_authenticated/contracts.index";
import { assignOwnerContract, moveOwnerAsset } from "@/lib/owner-operations.functions";
import { issueClientAccess } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/owners/$ownerId")({
  head: () => ({
    meta: [
      { title: "ملف المالك | الرشودي للعقارات" },
      { name: "description", content: "ملف المالك وعقاراته ووحداته وعقوده وفواتيره وجدول دفعاته." },
      { property: "og:title", content: "ملف المالك | الرشودي للعقارات" },
      { property: "og:description", content: "تفاصيل المالك المالية والعقارية وجدول الدفعات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerDetailPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (date: string) =>
  Math.round((new Date(date).getTime() - new Date(today()).getTime()) / 86400000);

type PaymentRow = {
  id: string;
  contract_id: string;
  payment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: string;
};

function OwnerDetailPage() {
  const { ownerId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [openUnits, setOpenUnits] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [dragAsset, setDragAsset] = useState<{ id: string; type: "unit" | "property" } | null>(null);
  const [dragContractId, setDragContractId] = useState<string | null>(null);
  const [ownerAccess, setOwnerAccess] = useState<{ username: string; password: string } | null>(null);

  const dossier = useQuery({
    queryKey: ["owner-dossier", ownerId],
    queryFn: async () => {
      const [owner, properties, units, buildings, contracts, invoices] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", ownerId).single(),
        supabase
          .from("properties")
          .select("id, code, name, purpose, property_type, city, district, price_value, status, is_visible, building_id")
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("units")
          .select("id, unit_number, unit_type, floor, area, rooms, status, is_rentable, building_id")
          .eq("owner_id", ownerId)
          .order("unit_number"),
        supabase.from("buildings").select("id, name, city, district, address").eq("owner_id", ownerId),
        supabase
          .from("contracts")
          .select(
            "id, contract_number, contract_type, start_date, end_date, annual_rent, total_value, deposit, status, payment_cycle, property_id, unit_id, property:property_id(name), unit:unit_id(unit_number), tenant:contacts!contracts_tenant_id_fkey(id, full_name, phone, whatsapp)",
          )
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("id, invoice_number, issue_date, due_date, subtotal, vat_amount, total, status")
          .eq("contact_id", ownerId)
          .order("created_at", { ascending: false }),
      ]);
      for (const res of [owner, properties, units, buildings, contracts, invoices]) {
        if (res.error) throw res.error;
      }
      const contractRows = (contracts.data ?? []) as any[];
      let payments: PaymentRow[] = [];
      let lastPaidAt: string | null = null;
      if (contractRows.length) {
        const ids = contractRows.map((c) => c.id);
        const paymentsRes = await supabase
          .from("contract_payments")
          .select("id, contract_id, payment_number, due_date, amount_due, amount_paid, status")
          .in("contract_id", ids)
          .order("due_date");
        if (paymentsRes.error) throw paymentsRes.error;
        payments = (paymentsRes.data ?? []) as PaymentRow[];
        if (payments.length) {
          const tx = await supabase
            .from("payment_transactions")
            .select("paid_at")
            .in("payment_id", payments.map((p) => p.id))
            .order("paid_at", { ascending: false })
            .limit(1);
          lastPaidAt = tx.data?.[0]?.paid_at ?? null;
        }
      }
      return {
        owner: owner.data as any,
        properties: (properties.data ?? []) as any[],
        units: (units.data ?? []) as any[],
        buildings: (buildings.data ?? []) as any[],
        contracts: contractRows,
        invoices: (invoices.data ?? []) as any[],
        payments,
        lastPaidAt,
      };
    },
  });

  const data = dossier.data;

  const stats = useMemo(() => {
    const payments = data?.payments ?? [];
    const remaining = (p: PaymentRow) => Math.max(Number(p.amount_due) - Number(p.amount_paid), 0);
    const overdue = payments.filter((p) => p.status !== "paid" && p.status !== "cancelled" && daysBetween(p.due_date) < 0);
    const upcoming = payments
      .filter((p) => p.status !== "paid" && p.status !== "cancelled" && daysBetween(p.due_date) >= 0)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const next30 = upcoming.filter((p) => daysBetween(p.due_date) <= 30);
    const totalDue = payments.reduce((s, p) => s + Number(p.amount_due), 0);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
    return {
      overdueAmount: overdue.reduce((s, p) => s + remaining(p), 0),
      overdueCount: overdue.length,
      next30Amount: next30.reduce((s, p) => s + remaining(p), 0),
      next30Count: next30.length,
      totalDue,
      totalPaid,
      rate: totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0,
      nextPayment: upcoming[0] ?? null,
      nearest: [...overdue.sort((a, b) => a.due_date.localeCompare(b.due_date)), ...upcoming].slice(0, 6),
    };
  }, [data]);

  const activeContracts = data?.contracts.filter((c) => c.status === "active") ?? [];

  const recordPayment = useMutation({
    mutationFn: async (payment: PaymentRow) => {
      const amount = Math.max(Number(payment.amount_due) - Number(payment.amount_paid), 0);
      if (amount <= 0) throw new Error("لا يوجد مبلغ متبقٍ على هذه الدفعة");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("payment_transactions").insert({
        payment_id: payment.id,
        amount,
        paid_at: today(),
        method: "manual",
        recorded_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل السداد");
      queryClient.invalidateQueries({ queryKey: ["owner-dossier", ownerId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر تسجيل السداد"),
  });

  const moveAsset = useMutation({
    mutationFn: (buildingId: string | null) => {
      if (!dragAsset) throw new Error("اختر الوحدة أو العقار أولًا");
      return moveOwnerAsset({ data: { ownerId, buildingId, itemId: dragAsset.id, itemType: dragAsset.type } });
    },
    onSuccess: () => {
      setDragAsset(null);
      queryClient.invalidateQueries({ queryKey: ["owner-dossier", ownerId] });
      toast.success("تم نقل العنصر إلى المبنى");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر النقل"),
  });

  const issueOwnerAccess = useMutation({
    mutationFn: () => issueClientAccess({ data: { contactId: ownerId } }),
    onSuccess: (result) => {
      setOwnerAccess({ username: result.username, password: result.password });
      toast.success("تم تجهيز حساب دخول المالك");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر تجهيز الحساب"),
  });

  const assignContract = useMutation({
    mutationFn: (unitId: string) => {
      if (!dragContractId) throw new Error("اختر العقد أولًا");
      return assignOwnerContract({ data: { ownerId, contractId: dragContractId, unitId } });
    },
    onSuccess: () => {
      setDragContractId(null);
      queryClient.invalidateQueries({ queryKey: ["owner-dossier", ownerId] });
      toast.success("تم ربط العقد بالوحدة");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر نقل العقد"),
  });

  const exportOwner = async (aiSummary?: string) => {
    if (!data) return;
    const ownerRows: ExportRow[] = [
      {
        "الاسم الكامل": data.owner.full_name,
        "الصفة": "مالك",
        "رقم الهوية / السجل": data.owner.national_id,
        "الجوال": data.owner.phone,
        "واتساب": data.owner.whatsapp,
        "البريد": data.owner.email,
        "العنوان": data.owner.address,
        "الحالة": data.owner.is_active ? "نشط" : "موقوف",
        "الملاحظات": data.owner.notes,
      },
    ];
    const sheets = [
      { name: "بيانات المالك", rows: ownerRows },
      {
        name: "العقارات",
        rows: data.properties.map((row) => ({
          الكود: row.code,
          العقار: row.name,
          الغرض: row.purpose === "sale" ? "بيع" : "إيجار",
          النوع: row.property_type,
          المدينة: row.city,
          الحي: row.district,
          السعر: row.price_value,
          الحالة: row.status,
        })),
      },
      {
        name: "الوحدات",
        rows: data.units.map((row) => ({
          "رقم الوحدة": row.unit_number,
          النوع: row.unit_type,
          الدور: row.floor,
          المساحة: row.area,
          الحالة: row.status,
        })),
      },
      {
        name: "العقود",
        rows: data.contracts.map((row) => ({
          "رقم العقد": row.contract_number,
          النوع: row.contract_type === "sale" ? "بيع" : "إيجار",
          العقار: row.property?.name,
          الوحدة: row.unit?.unit_number,
          المستأجر: row.tenant?.full_name,
          البداية: row.start_date,
          النهاية: row.end_date,
          "الإيجار السنوي": row.annual_rent,
          الحالة: contractStatusLabels[row.status] ?? row.status,
        })),
      },
      {
        name: "الدفعات",
        rows: data.payments.map((row) => ({
          "رقم الدفعة": row.payment_number,
          الاستحقاق: row.due_date,
          المبلغ: row.amount_due,
          المدفوع: row.amount_paid,
          المتبقي: Number(row.amount_due) - Number(row.amount_paid),
          الحالة: row.status,
        })),
      },
      {
        name: "الفواتير",
        rows: data.invoices.map((row) => ({
          "رقم الفاتورة": row.invoice_number,
          الإصدار: row.issue_date,
          الاستحقاق: row.due_date,
          الإجمالي: row.total,
          الحالة: invoiceStatusLabels[row.status] ?? row.status,
        })),
      },
    ];
    if (aiSummary) sheets.push({ name: "ملخص المساعد الذكي", rows: [{ الملخص: aiSummary }] });
    await exportWorkbook(`ملف المالك - ${data.owner.full_name}`, sheets);
  };

  const aiExport = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("لم تكتمل البيانات بعد");
      const context = JSON.stringify({
        owner: data.owner,
        properties: data.properties,
        units: data.units,
        contracts: data.contracts,
        payments: data.payments,
        invoices: data.invoices,
      });
      const response = await askAdminAi({
        data: {
          context,
          messages: [
            {
              role: "user",
              content:
                "أنشئ ملخصًا تنفيذيًا دقيقًا لملف هذا المالك: وضعه العقاري، العقود النشطة، المتأخرات والدفعات القادمة، وأهم إجراء مقترح. لا تخترع أي معلومة.",
            },
          ],
        },
      });
      await exportOwner(response.text);
    },
    onSuccess: () => toast.success("تم إعداد ملف المالك الذكي وتنزيله"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر إعداد الملف"),
  });

  if (dossier.isLoading)
    return (
      <div className="surface-card grid place-items-center py-24">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  if (!data) return <div className="surface-card p-10 text-center text-destructive">تعذّر تحميل ملف المالك</div>;

  const phone = data.owner.phone?.replace(/\D/g, "") ?? "";
  const whatsapp = (data.owner.whatsapp || data.owner.phone)?.replace(/\D/g, "") ?? "";

  const contractByUnit = new Map<string, any>();
  const contractByProperty = new Map<string, any>();
  for (const c of data.contracts) {
    if (c.status !== "active") continue;
    if (c.unit_id && !contractByUnit.has(c.unit_id)) contractByUnit.set(c.unit_id, c);
    if (c.property_id && !contractByProperty.has(c.property_id)) contractByProperty.set(c.property_id, c);
  }
  const paymentsByContract = new Map<string, PaymentRow[]>();
  for (const p of data.payments) {
    const list = paymentsByContract.get(p.contract_id) ?? [];
    list.push(p);
    paymentsByContract.set(p.contract_id, list);
  }

  const unitBoard = data.units.map((u) => {
    const contract = contractByUnit.get(u.id) ?? null;
    const pays: PaymentRow[] = contract ? (paymentsByContract.get(contract.id) ?? []) : [];
    const remaining = pays.reduce(
      (s, p) => s + Math.max(Number(p.amount_due) - Number(p.amount_paid), 0),
      0,
    );
    return { unit: u, contract, remaining };
  });
  const unitCounts = {
    total: data.units.length,
    occupied: data.units.filter((u) => u.status === "occupied").length,
    vacant: data.units.filter((u) => u.status === "available" || u.status === "vacant").length,
    outOfService: data.units.filter(
      (u) => u.status === "maintenance" || u.status === "out_of_service",
    ).length,
  };

  type GroupItem = { key: string; title: string; subtitle: string; contract: any | null; badge?: string; assetType: "unit" | "property" };
  const groups: { key: string; title: string; subtitle: string; items: GroupItem[] }[] = [];
  for (const building of data.buildings) {
    groups.push({
      key: building.id,
      title: building.name,
      subtitle: [building.district, building.city, building.address].filter(Boolean).join(" ، ") || "—",
      items: data.units
        .filter((u) => u.building_id === building.id)
        .map((u) => ({
          key: u.id,
          title: `وحدة رقم ${u.unit_number}`,
          subtitle: [u.unit_type, u.floor ? `الدور ${u.floor}` : null, u.area ? `${u.area} م²` : null]
            .filter(Boolean)
            .join(" · "),
          contract: contractByUnit.get(u.id) ?? null,
          badge: u.status,
          assetType: "unit" as const,
        })),
    });
  }
  const looseUnits = data.units.filter((u) => !u.building_id);
  const looseProps = data.properties;
  if (looseUnits.length || looseProps.length) {
    groups.push({
      key: "__standalone",
      title: "عقارات ووحدات مستقلة",
      subtitle: `${looseProps.length} عقار · ${looseUnits.length} وحدة`,
      items: [
        ...looseProps.map((p) => ({
          key: p.id,
          title: p.name,
          subtitle: [p.code, p.city, p.district].filter(Boolean).join(" · "),
          contract: contractByProperty.get(p.id) ?? null,
          badge: p.status,
          assetType: "property" as const,
        })),
        ...looseUnits.map((u) => ({
          key: u.id,
          title: `وحدة رقم ${u.unit_number}`,
          subtitle: [u.unit_type, u.floor ? `الدور ${u.floor}` : null].filter(Boolean).join(" · "),
          contract: contractByUnit.get(u.id) ?? null,
          badge: u.status,
          assetType: "unit" as const,
        })),
      ],
    });
  }

  const remainingOf = (p: PaymentRow) => Math.max(Number(p.amount_due) - Number(p.amount_paid), 0);
  const paymentTone = (p: PaymentRow) =>
    p.status === "paid" ? "success" : daysBetween(p.due_date) < 0 ? "danger" : "warning";
  const paymentLabel = (p: PaymentRow) =>
    p.status === "paid" ? "مدفوع" : daysBetween(p.due_date) < 0 ? "متأخر" : "قادمة";
  const reminderLink = (contract: any, payment?: PaymentRow) => {
    const to = (contract?.tenant?.whatsapp || contract?.tenant?.phone || "").replace(/\D/g, "");
    if (!to) return null;
    const text = payment
      ? `تذكير بسداد الدفعة رقم ${payment.payment_number} بمبلغ ${remainingOf(payment)} ريال بتاريخ استحقاق ${payment.due_date} — عقد ${contract.contract_number}.`
      : `تذكير بخصوص عقد ${contract?.contract_number ?? ""}.`;
    return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
  };

  return (
    <>
      <PageHero
        title="الملاك"
        subtitle="إدارة بيانات الملاك وعقاراتهم وعقودهم الإيجارية"
        icon={UserRound}
        stats={[
          { value: String(data.properties.length + data.units.length), label: "العقارات والوحدات" },
          { value: formatCurrency(stats.totalDue), label: "إجمالي الإيجارات" },
          { value: formatCurrency(stats.overdueAmount), label: "المتأخرات" },
          { value: `${stats.rate}%`, label: "نسبة التحصيل" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <Link
          to="/owners"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
        >
          الملاك
          <ArrowRight className="size-3.5" />
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => issueOwnerAccess.mutate()}
            disabled={issueOwnerAccess.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 font-semibold hover:bg-muted disabled:opacity-50"
          >
            <KeyRound className="size-4" />
            حساب دخول المالك
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 font-semibold hover:bg-muted"
          >
            <FileUp className="size-4" />
            استيراد عقد PDF
          </button>
          <Link
            to="/invoice-form"
            search={{ id: "", ownerId }}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 font-semibold text-primary-foreground"
          >
            <ReceiptText className="size-4" />
            إنشاء فاتورة
          </Link>
          <button
            type="button"
            onClick={() => void exportOwner()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 font-semibold hover:bg-muted"
          >
            <Download className="size-4" />
            Excel
          </button>
          <button
            type="button"
            disabled={aiExport.isPending}
            onClick={() => aiExport.mutate()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/30 bg-accent px-3 font-semibold text-primary disabled:opacity-50"
          >
            {aiExport.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
            ملف ذكي
          </button>
        </div>
      </div>

      {ownerAccess ? (
        <section className="surface-card border-e-4 border-e-success p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-bold">بيانات دخول بوابة المالك</h2><p className="mt-1 text-xs text-muted-foreground">انسخها وأرسلها للمالك بصورة آمنة. كلمة المرور لا تُعرض مرة أخرى.</p></div>
            <button type="button" onClick={() => setOwnerAccess(null)} className="text-xs font-semibold text-muted-foreground">إخفاء</button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-muted p-3"><span className="block text-xs text-muted-foreground">اسم المستخدم</span><b dir="ltr" className="mt-1 block">{ownerAccess.username}</b></div><div className="rounded-lg bg-muted p-3"><span className="block text-xs text-muted-foreground">كلمة المرور المؤقتة</span><b dir="ltr" className="mt-1 block">{ownerAccess.password}</b></div></div>
        </section>
      ) : null}

      <section className="surface-card overflow-hidden border-e-4 border-e-primary">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary text-base font-bold text-primary-foreground shadow-card">
              {data.owner.full_name.slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[16px] font-bold">{data.owner.full_name}</h1>
                <Chip tone="gold">مالك</Chip>
                <Chip tone={data.owner.is_active ? "success" : "neutral"}>
                  {data.owner.is_active ? "نشط" : "موقوف"}
                </Chip>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                رقم المالك: <span dir="ltr">{data.owner.id.slice(0, 8)}</span> · أضيف في {formatDate(data.owner.created_at)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {phone ? (
              <a
                href={`tel:+${phone}`}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[11.5px] font-semibold"
              >
                <Phone className="size-4" />
                اتصال
              </a>
            ) : null}
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-success/30 px-3 text-[11.5px] font-semibold text-success"
              >
                <MessageCircle className="size-4" />
                واتساب
              </a>
            ) : null}
            {data.owner.email ? (
              <a
                href={`mailto:${data.owner.email}`}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[11.5px] font-semibold"
              >
                <Mail className="size-4" />
                بريد
              </a>
            ) : null}
            <Link
              to="/owner-form"
              search={{ id: ownerId }}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-[11.5px] font-semibold text-primary-foreground"
            >
              <Pencil className="size-4" />
              تعديل
            </Link>
          </div>
        </div>

        <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi label="المتأخرات" value={formatCurrency(stats.overdueAmount)} hint={`${stats.overdueCount} دفعة متأخرة`} tone="danger" />
          <Kpi label="المستحق خلال 30 يوم" value={formatCurrency(stats.next30Amount)} hint={`${stats.next30Count} دفعة قادمة`} />
          <Kpi
            label="نسبة التحصيل"
            value={`${stats.rate}%`}
            hint={`${formatCurrency(stats.totalPaid)} من ${formatCurrency(stats.totalDue)}`}
            progress={stats.rate}
          />
          <Kpi
            label="العقارات والوحدات"
            value={`${data.properties.length + data.units.length}`}
            hint={`${data.buildings.length} عمارة · ${data.units.length} وحدة`}
          />
          <Kpi
            label="أقرب دفعة"
            value={stats.nextPayment ? formatDate(stats.nextPayment.due_date) : "—"}
            hint={stats.nextPayment ? `${formatCurrency(remainingOf(stats.nextPayment))} ريال` : "لا توجد دفعات قادمة"}
          />
          <Kpi label="آخر سداد" value={data.lastPaidAt ? formatDate(data.lastPaidAt) : "—"} hint="آخر عملية سداد مسجلة" />
        </div>
      </section>

      <RecordSection title="أقرب الدفعات" icon={CalendarClock} count={stats.nearest.length}>
        <div className="space-y-2">
          {stats.nearest.map((p) => {
            const contract = data.contracts.find((c) => c.id === p.contract_id);
            const late = daysBetween(p.due_date) < 0;
            return (
              <div
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5 ${late ? "border-destructive/40 bg-destructive/5" : "border-border"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatCurrency(remainingOf(p))}</span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {contract?.unit?.unit_number ? `وحدة ${contract.unit.unit_number}` : contract?.property?.name ?? "—"}
                    {contract?.tenant?.full_name ? ` — ${contract.tenant.full_name}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-muted-foreground" dir="ltr">
                    {formatDate(p.due_date)}
                  </span>
                  <Chip tone={paymentTone(p)}>
                    {late ? `متأخرة منذ ${Math.abs(daysBetween(p.due_date))} يوم` : `خلال ${daysBetween(p.due_date)} يوم`}
                  </Chip>
                  <Link
                    to="/payment-reminder/$paymentId"
                    params={{ paymentId: p.id }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-semibold text-muted-foreground hover:text-success"
                    title="إرسال تذكير"
                  >
                    <MessageCircle className="size-3.5" />
                    إرسال تذكير
                  </Link>
                </div>
              </div>
            );
          })}
          {!stats.nearest.length ? <Empty text="لا توجد دفعات مستحقة" /> : null}
        </div>
      </RecordSection>

      <RecordSection title="البيانات الأساسية" icon={UserRound} count={data.owner.is_active ? 1 : 0}>
        <div className="grid gap-px overflow-hidden rounded-md bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Info icon={UserRound} label="الاسم" value={data.owner.full_name} />
          <Info icon={KeyRound} label="رقم الهوية / السجل" value={data.owner.national_id} ltr />
          <Info icon={Phone} label="الجوال" value={data.owner.phone} ltr />
          <Info icon={MessageCircle} label="واتساب" value={data.owner.whatsapp || data.owner.phone} ltr />
          <Info icon={Mail} label="البريد الإلكتروني" value={data.owner.email} ltr />
          <Info icon={MapPin} label="العنوان" value={data.owner.address} />
          <Info icon={Building2} label="التصنيف" value="مالك" />
          <Info icon={CheckCircle2} label="الحالة" value={data.owner.is_active ? "نشط" : "موقوف"} />
        </div>
        {data.owner.notes ? (
          <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-[13px]">{data.owner.notes}</p>
        ) : null}
      </RecordSection>

      <RecordSection title="العقارات والوحدات" icon={House} count={groups.reduce((s, g) => s + g.items.length, 0)}>
        <p className="mb-3 text-[12px] text-muted-foreground">اسحب الوحدة أو العقار بين المباني، أو اسحب عقدًا نشطًا من قسم العقود وأسقطه على وحدة شاغرة.</p>
        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map((group) => {
            const collapsed = collapsedGroups[group.key];
            return (
              <article
                key={group.key}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveAsset.mutate(group.key === "__standalone" ? null : group.key)}
                className="overflow-hidden rounded-md border border-border border-e-primary transition-colors hover:border-primary/50"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 bg-secondary/40 px-4 py-3">
                  <div>
                    <h3 className="text-[14px] font-bold">{group.title}</h3>
                    <p className="mt-1 text-[12px] text-muted-foreground">{group.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone="primary">{group.items.length} وحدة</Chip>
                    <button
                      type="button"
                      onClick={() => setCollapsedGroups((s) => ({ ...s, [group.key]: !collapsed }))}
                      className="grid size-8 place-items-center rounded-md border border-border bg-card hover:bg-muted"
                      aria-label="طي / فتح"
                    >
                      <ChevronDown className={`size-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                    </button>
                  </div>
                </header>
                {collapsed ? null : (
                  <div className="space-y-3 p-3">
                    {group.items.map((item) => {
                      const contract = item.contract;
                      const list = contract ? (paymentsByContract.get(contract.id) ?? []) : [];
                      const shown = openUnits[item.key];
                      const paid = list.filter((p) => p.status === "paid").length;
                      const totalRemaining = list.reduce((s, p) => s + remainingOf(p), 0);
                      const link = reminderLink(contract);
                      return (
                        <div
                          key={item.key}
                          draggable
                          onDragStart={() => setDragAsset({ id: item.key, type: item.assetType })}
                          onDragEnd={() => setDragAsset(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            if (!dragContractId || item.assetType !== "unit") return;
                            event.preventDefault();
                            event.stopPropagation();
                            assignContract.mutate(item.key);
                          }}
                          className="cursor-grab rounded-md border border-border bg-card active:cursor-grabbing"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-[13.5px] font-bold">{item.title}</h4>
                                {contract ? (
                                  <Chip tone="success">مؤجرة</Chip>
                                ) : (
                                  <Chip tone="neutral">شاغرة</Chip>
                                )}
                              </div>
                              <p className="mt-1 text-[12px] text-muted-foreground">
                                {contract
                                  ? `${contract.tenant?.full_name ?? "مستأجر غير مسجل"}${contract.tenant?.phone ? ` · ${contract.tenant.phone}` : ""} · ينتهي ${formatDate(contract.end_date)}`
                                  : item.subtitle || "لا يوجد عقد نشط"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {contract ? (
                                <span className="rounded-md bg-secondary px-3 py-1 text-[12.5px] font-bold">
                                  {formatCurrency(contract.annual_rent ?? contract.total_value)}
                                </span>
                              ) : null}
                              {link ? (
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-8 items-center gap-2 rounded-md border border-success/30 px-3 text-[12px] font-semibold text-success"
                                >
                                  <MessageCircle className="size-3.5" />
                                  تذكير
                                </a>
                              ) : null}
                              {contract ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setOpenUnits((s) => ({ ...s, [item.key]: !shown }))}
                                    className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[12px] font-semibold hover:bg-muted"
                                  >
                                    <ReceiptText className="size-3.5" />
                                    {shown ? "إخفاء الدفعات" : "عرض الدفعات"}
                                  </button>
                                  <Link
                                    to="/contracts/$contractId"
                                    params={{ contractId: contract.id }}
                                    className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[12px] font-semibold hover:bg-muted"
                                  >
                                    <FileText className="size-3.5" />
                                    العقد
                                  </Link>
                                </>
                              ) : null}
                            </div>
                          </div>

                          {contract && shown ? (
                            <div className="border-t border-border p-3">
                              <div className="mb-3 grid gap-2 sm:grid-cols-4">
                                <MiniStat label="الدفعات" value={`${paid}/${list.length}`} />
                                <MiniStat
                                  label="مدفوع"
                                  value={formatCurrency(list.reduce((s, p) => s + Number(p.amount_paid), 0))}
                                  tone="success"
                                />
                                <MiniStat label="متبقي" value={formatCurrency(totalRemaining)} tone="danger" />
                                <MiniStat
                                  label="نسبة التحصيل"
                                  value={`${list.length ? Math.round((paid / list.length) * 100) : 0}%`}
                                />
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[620px] text-[12.5px]">
                                  <thead className="bg-secondary/60 text-[11.5px] text-muted-foreground">
                                    <tr>
                                      <th className="p-2 text-start">#</th>
                                      <th className="p-2 text-start">الاستحقاق</th>
                                      <th className="p-2 text-start">المبلغ</th>
                                      <th className="p-2 text-start">المدفوع</th>
                                      <th className="p-2 text-start">المتبقي</th>
                                      <th className="p-2 text-start">الحالة</th>
                                      <th className="p-2 text-start">إجراء</th>
                                      <th className="p-2 text-start">تذكير</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {list.map((p) => {
                                      const payLink = reminderLink(contract, p);
                                      return (
                                        <tr key={p.id} className="border-t border-border">
                                          <td className="p-2 font-semibold">{p.payment_number}</td>
                                          <td className="p-2" dir="ltr">
                                            {formatDate(p.due_date)}
                                          </td>
                                          <td className="p-2">{formatCurrency(p.amount_due)}</td>
                                          <td className="p-2 text-success">{formatCurrency(p.amount_paid)}</td>
                                          <td className="p-2">{formatCurrency(remainingOf(p))}</td>
                                          <td className="p-2">
                                            <Chip tone={paymentTone(p)}>{paymentLabel(p)}</Chip>
                                          </td>
                                          <td className="p-2">
                                            {p.status === "paid" ? (
                                              <span className="inline-flex items-center gap-1 text-success">
                                                <CheckCircle2 className="size-3.5" />
                                                مسددة
                                              </span>
                                            ) : (
                                              <button
                                                type="button"
                                                disabled={recordPayment.isPending}
                                                onClick={() => recordPayment.mutate(p)}
                                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
                                              >
                                                <CheckCircle2 className="size-3.5" />
                                                تسجيل سداد
                                              </button>
                                            )}
                                          </td>
                                          <td className="p-2">
                                            <Link
                                              to="/payment-reminder/$paymentId"
                                              params={{ paymentId: p.id }}
                                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-semibold text-muted-foreground hover:text-success"
                                              title="إرسال تذكير"
                                            >
                                              <MessageCircle className="size-3.5" />
                                              إرسال تذكير
                                            </Link>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {!list.length ? (
                                      <tr>
                                        <td colSpan={8} className="p-4 text-center text-muted-foreground">
                                          لا توجد دفعات مسجلة على هذا العقد.
                                        </td>
                                      </tr>
                                    ) : null}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {!group.items.length ? <Empty text="لا توجد وحدات في هذه العمارة" /> : null}
                  </div>
                )}
              </article>
            );
          })}
          {!groups.length ? <Empty text="لا توجد عقارات أو وحدات مرتبطة" /> : null}
        </div>
      </RecordSection>

      <RecordSection title="العقود" icon={FileText} count={data.contracts.length}>
        <div className="space-y-2">
          {data.contracts.map((contract) => (
            <Link
              key={contract.id}
              draggable={contract.status === "active"}
              onDragStart={() => setDragContractId(contract.id)}
              onDragEnd={() => setDragContractId(null)}
              to="/contracts/$contractId"
              params={{ contractId: contract.id }}
              className="grid items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted sm:grid-cols-5"
            >
              <strong>{contract.contract_number}</strong>
              <span>{contract.property?.name ?? (contract.unit?.unit_number ? `وحدة ${contract.unit.unit_number}` : "—")}</span>
              <span>
                {formatDate(contract.start_date)} — {formatDate(contract.end_date)}
              </span>
              <span className="font-semibold">{formatCurrency(contract.annual_rent ?? contract.total_value)}</span>
              <Chip tone={contract.status === "active" ? "success" : "neutral"}>
                {contractStatusLabels[contract.status] ?? contract.status}
              </Chip>
            </Link>
          ))}
          {!data.contracts.length ? <Empty text="لا توجد عقود مرتبطة" /> : null}
        </div>
      </RecordSection>

      <RecordSection title="الفواتير" icon={ReceiptText} count={data.invoices.length}>
        <div className="space-y-2">
          {data.invoices.map((invoice) => (
            <Link
              key={invoice.id}
              to="/invoices/$invoiceId"
              params={{ invoiceId: invoice.id }}
              className="grid items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted sm:grid-cols-5"
            >
              <strong dir="ltr">{invoice.invoice_number}</strong>
              <span>{formatDate(invoice.issue_date)}</span>
              <span>{formatDate(invoice.due_date)}</span>
              <span className="font-semibold">{formatCurrency(invoice.total)}</span>
              <Chip
                tone={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : "warning"}
              >
                {invoiceStatusLabels[invoice.status] ?? invoice.status}
              </Chip>
            </Link>
          ))}
          {!data.invoices.length ? <Empty text="لا توجد فواتير مرتبطة" /> : null}
        </div>
      </RecordSection>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onExtracted={() => {
          setImportOpen(false);
          void navigate({ to: "/contracts" });
        }}
      />
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
  progress,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger";
  progress?: number;
}) {
  return (
    <div className="min-h-24 bg-card p-4">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-[17px] font-bold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
      {progress != null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      ) : null}
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-md bg-secondary/60 p-2 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-[13px] font-bold ${tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  ltr,
}: {
  icon: typeof Phone;
  label: string;
  value: string | null;
  ltr?: boolean;
}) {
  return (
    <div className="min-h-24 bg-card p-4">
      <p className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </p>
      <p className="mt-2 break-words text-[13px] font-semibold" dir={ltr ? "ltr" : undefined}>
        {value || "غير مسجل"}
      </p>
    </div>
  );
}

function RecordSection({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof Building2;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden border-e-2 border-e-primary">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-[14px] font-bold">
          <Icon className="size-4 text-primary" />
          {title}
        </h2>
        <Chip tone="primary">{count}</Chip>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="col-span-full py-7 text-center text-[12.5px] text-muted-foreground">{text}</p>;
}
