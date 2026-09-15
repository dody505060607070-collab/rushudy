import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  Eye,
  Hash,
  Home,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { publicSettingsQuery } from "@/lib/site-data";
import { sendWhatsAppMessage } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/payment-reminder/$paymentId")({
  head: () => ({
    meta: [
      { title: "تذكير دفعة إيجارية | الرشودي للعقارات" },
      {
        name: "description",
        content: "إرسال تذكير واتساب بدفعة إيجارية مع معاينة الرسالة وتكرار الإرسال وسجل الرسائل.",
      },
      { property: "og:title", content: "تذكير دفعة إيجارية | الرشودي للعقارات" },
      { property: "og:description", content: "معاينة التذكير وإرساله ومتابعة سجل الرسائل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentReminderPage,
});

/** خيارات تكرار الإرسال كما في القالب المعتمد. */
const repeatOptions = [
  { key: "once", label: "مرة واحدة", hours: 0 },
  { key: "6h", label: "كل 6س", hours: 6 },
  { key: "8h", label: "كل 8س", hours: 8 },
  { key: "12h", label: "كل 12س", hours: 12 },
  { key: "24h", label: "كل 24س", hours: 24 },
  { key: "3d", label: "كل 3 أيام", hours: 72 },
];

const money = (n: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)} ر.س`;

const dateText = (v?: string | null) => (v ? v.slice(0, 10).replaceAll("-", "/") : "—");

const daysLeft = (due?: string | null) => {
  if (!due) return 0;
  const d = new Date(`${due.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
};

type PaymentData = {
  id: string;
  payment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  contract: {
    id: string;
    contract_number: string | null;
    owner_id: string | null;
    tenant: { id: string; full_name: string; phone: string | null; whatsapp: string | null } | null;
    owner: { id: string; full_name: string } | null;
    unit: { unit_number: string | null; unit_type: string | null } | null;
    property: { name: string | null } | null;
  } | null;
};

function PaymentReminderPage() {
  const { paymentId } = Route.useParams();
  const queryClient = useQueryClient();
  const [repeat, setRepeat] = useState("once");
  const [showTemplate, setShowTemplate] = useState(false);

  const settings = useQuery(publicSettingsQuery);
  const companyName = settings.data?.company_name || "الرشودي للعقارات";

  const payment = useQuery({
    queryKey: ["payment-reminder", paymentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_payments")
        .select(
          "id, payment_number, due_date, amount_due, amount_paid, status, contract:contract_id(id, contract_number, owner_id, tenant:tenant_id(id, full_name, phone, whatsapp), owner:owner_id(id, full_name), unit:unit_id(unit_number, unit_type), property:property_id(name))",
        )
        .eq("id", paymentId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PaymentData | null;
    },
  });

  const logs = useQuery({
    queryKey: ["payment-reminder-log", paymentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_log")
        .select("id, body, recipient_phone, result, created_at, sent_by_system")
        .eq("payment_id", paymentId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const p = payment.data;
  const contract = p?.contract ?? null;
  const tenant = contract?.tenant ?? null;
  const phone = tenant?.whatsapp || tenant?.phone || "";
  const remaining = Math.max(Number(p?.amount_due ?? 0) - Number(p?.amount_paid ?? 0), 0);
  const unitLabel =
    contract?.unit?.unit_number
      ? `${contract.unit.unit_type ?? "وحدة"} رقم ${contract.unit.unit_number}`
      : contract?.property?.name || "—";
  const days = daysLeft(p?.due_date);
  const late = days < 0;
  const dueText = late ? `متأخرة منذ ${Math.abs(days)} يوم` : `تستحق بعد ${days} أيام`;

  /** القالب الأساسي المعتمد لتذكير الدفعات الإيجارية. */
  const message = useMemo(() => {
    if (!p) return "";
    return [
      `مرحباً ${tenant?.full_name ?? ""}.`,
      "",
      `نود إحاطتكم علماً بأن الدفعة الإيجارية ${late ? `متأخرة منذ ${Math.abs(days)} يوم` : `تستحق بعد ${days} أيام`}.`,
      "",
      "تفاصيل الدفعة:",
      `رقم الدفعة: ${p.payment_number}`,
      `المبلغ المتبقي: ${money(remaining)}`,
      `تاريخ الاستحقاق: ${dateText(p.due_date)}`,
      `الوحدة: ${unitLabel}`,
      "",
      "نرجو التكرم بالسداد في الموعد المحدد.",
      "",
      "رجاءً بعد السداد إرسال أو تحويل إيصال السداد لإيقاف التنبيهات.",
      "",
      `إدارة ${companyName}`,
    ].join("\n");
  }, [p, tenant, late, days, remaining, unitLabel, companyName]);

  const send = useMutation({
    mutationFn: async () => {
      if (!p) throw new Error("الدفعة غير موجودة");
      if (!phone) throw new Error("لا يوجد رقم جوال محفوظ للمستأجر");
      const option = repeatOptions.find((o) => o.key === repeat) ?? { key: "once", label: "مرة واحدة", hours: 0 };

      // إرسال مباشر عبر واتساب من الرقم المربوط
      const result = await sendWhatsAppMessage({ data: { to: phone, body: message } });
      if (!result.ok) throw new Error(result.error);

      const { error: logError } = await supabase.from("message_log").insert({
        recipient_name: tenant?.full_name ?? null,
        recipient_phone: phone,
        contract_id: contract?.id ?? null,
        payment_id: p.id,
        body: message,
        channel: "whatsapp",
        result: result.sid ? `sent:${result.sid}` : "sent",
        sent_by_system: false,
      });
      if (logError) throw logError;

      if (option.hours > 0) {
        const next = new Date(Date.now() + option.hours * 3_600_000).toISOString();
        const { error } = await supabase.from("reminder_followups").insert({
          recipient_contact_id: tenant?.id ?? null,
          recipient_name: tenant?.full_name ?? null,
          recipient_phone: phone,
          contract_id: contract?.id ?? null,
          payment_id: p.id,
          message_body: message,
          repeat_interval: option.key,
          status: "active",
          next_send_at: next,
        });
        if (error) throw error;
      }
      try {
        const { reportReminderSent } = await import("@/lib/automation.functions");
        await reportReminderSent({
          data: {
            paymentId: p.id,
            contractId: contract?.id ?? null,
            recipientName: tenant?.full_name ?? null,
            recipientPhone: phone,
            amount: Number(p.amount_due ?? 0),
            dueDate: p.due_date ?? null,
            message,
          },
        });
      } catch {
        /* الأتمتة اختيارية */
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-reminder-log", paymentId] });
      queryClient.invalidateQueries({ queryKey: ["reminder_followups"] });
      toast.success("تم إرسال التذكير عبر واتساب مباشرة وتسجيله في سجل الرسائل");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (payment.isLoading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!p) {
    return (
      <div className="surface-card p-8 text-center text-[13px] text-muted-foreground">
        لم يتم العثور على هذه الدفعة.
      </div>
    );
  }

  return (
    <>
      <PageHero
        title="الملاك"
        subtitle="إدارة بيانات الملاك وعقاراتهم وعقودهم الإيجارية"
        icon={Home}
        stats={[
          { value: String(p.payment_number), label: "رقم الدفعة" },
          { value: money(remaining), label: "المبلغ المتبقي" },
          { value: dateText(p.due_date), label: "تاريخ الاستحقاق" },
        ]}
      />

      <nav className="flex flex-wrap items-center justify-end gap-2 text-[12.5px] text-muted-foreground">
        <span className="font-semibold text-foreground">
          تذكيرات الدفعة رقم {p.payment_number}
        </span>
        <ChevronLeft className="size-3.5" />
        {contract?.owner ? (
          <Link to="/owners/$ownerId" params={{ ownerId: contract.owner.id }} className="hover:text-primary">
            {contract.owner.full_name}
          </Link>
        ) : null}
        <ChevronLeft className="size-3.5" />
        <Link to="/owners" className="hover:text-primary">
          الملاك
        </Link>
      </nav>

      {contract?.owner ? (
        <div className="flex justify-end">
          <Link
            to="/owners/$ownerId"
            params={{ ownerId: contract.owner.id }}
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground hover:text-primary"
          >
            ملف المالك
            <ArrowLeft className="size-4" />
          </Link>
        </div>
      ) : null}

      <section className="surface-card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={late ? "danger" : "success"}>{dueText}</Chip>
          <Chip>دفعة رقم {p.payment_number}</Chip>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-[12.5px] font-semibold text-destructive">
            <Wallet className="size-3.5" />
            {money(remaining)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12.5px] font-semibold" dir="ltr">
            <CalendarDays className="size-3.5" />
            {dateText(p.due_date)}
          </span>
          {phone ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12.5px] font-semibold" dir="ltr">
              <Phone className="size-3.5" />
              {phone}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-end">
          <div>
            <p className="text-[11px] text-muted-foreground">تذكير دفعة إيجارية</p>
            <h2 className="text-[15px] font-bold text-foreground">{tenant?.full_name ?? "—"}</h2>
            <p className="text-[12px] text-muted-foreground">{unitLabel}</p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary">
            <Home className="size-5" />
          </span>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-border px-5 py-4 text-end">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">WhatsApp</p>
          <h2 className="text-[15px] font-bold text-foreground">إرسال تذكير</h2>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowTemplate((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:bg-muted"
            >
              <Eye className="size-4" />
              عرض القالب
            </button>
            <Chip tone={late ? "danger" : "success"}>{dueText}</Chip>
          </div>

          {showTemplate ? (
            <pre className="mx-auto max-w-2xl whitespace-pre-wrap rounded-xl border border-dashed border-border bg-muted/30 p-3 text-[12.5px] leading-6 text-muted-foreground">
              {`مرحباً {اسم المستأجر}.

نود إحاطتكم علماً بأن الدفعة الإيجارية {حالة الاستحقاق}.

تفاصيل الدفعة:
رقم الدفعة: {رقم}
المبلغ المتبقي: {المبلغ}
تاريخ الاستحقاق: {التاريخ}
الوحدة: {الوحدة}

نرجو التكرم بالسداد في الموعد المحدد.

رجاءً بعد السداد إرسال أو تحويل إيصال السداد لإيقاف التنبيهات.

إدارة {اسم الشركة}`}
            </pre>
          ) : null}

          <div className="mx-auto max-w-2xl rounded-2xl border border-border p-4">
            <p className="mb-3 text-center text-[12px] text-muted-foreground">ما سيصل للمستأجر</p>
            <div className="whitespace-pre-wrap rounded-xl bg-[#ece5dd] p-4 text-[13px] leading-7 text-[#111b21]">
              {message}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[12px]">
              <span className="rounded-lg border border-border px-2.5 py-1 font-semibold">
                {money(remaining)}
              </span>
              <span className="rounded-lg border border-border px-2.5 py-1 font-semibold" dir="ltr">
                {dateText(p.due_date)}
              </span>
              <span className="rounded-lg border border-border px-2.5 py-1 font-semibold">
                {unitLabel}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <p className="text-[12.5px] font-semibold text-foreground">تكرار الإرسال</p>
            <div className="inline-flex flex-wrap justify-center gap-1 rounded-xl border border-border p-1">
              {repeatOptions.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setRepeat(o.key)}
                  className={
                    repeat === o.key
                      ? "rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-primary"
                      : "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:bg-muted"
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => send.mutate()}
              disabled={send.isPending || !phone}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-10 text-[13.5px] font-bold text-primary-foreground disabled:opacity-60"
            >
              {send.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              إرسال الآن
            </button>
          </div>
          {!phone ? (
            <p className="text-center text-[12px] text-destructive">
              لا يوجد رقم جوال محفوظ للمستأجر — أضف الرقم في بيانات جهة الاتصال أولًا.
            </p>
          ) : null}
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={() => logs.refetch()}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
            title="تحديث"
          >
            <RefreshCw className={`size-4 ${logs.isFetching ? "animate-spin" : ""}`} />
          </button>
          <div className="text-end">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">History</p>
            <h2 className="text-[15px] font-bold text-foreground">سجل الرسائل</h2>
          </div>
        </div>

        {(logs.data ?? []).length === 0 ? (
          <div className="grid place-items-center gap-2 py-14 text-center">
            <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
              <MessageSquare className="size-5" />
            </span>
            <p className="text-[13.5px] font-bold text-foreground">لا توجد رسائل لهذه الدفعة بعد</p>
            <p className="text-[12px] text-muted-foreground">
              سيظهر هنا وقت الإرسال وحالة كل رسالة.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {(logs.data ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-2">
                  <Chip tone={row.result === "sent" ? "success" : "warning"}>
                    {row.result === "sent" ? "تم الإرسال" : "في الانتظار"}
                  </Chip>
                  <span className="text-[12px] text-muted-foreground" dir="ltr">
                    {new Date(row.created_at).toLocaleString("en-GB")}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {row.sent_by_system ? "النظام" : "الفريق"}
                  </span>
                </div>
                <p className="max-w-xl whitespace-pre-wrap text-end text-[12.5px] leading-6 text-muted-foreground">
                  {row.body.slice(0, 200)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Hash className="size-3.5" />
        عقد رقم {contract?.contract_number ?? "—"}
      </div>
    </>
  );
}
