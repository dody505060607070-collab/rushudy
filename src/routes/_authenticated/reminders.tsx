import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CheckCircle2, Loader2, MessageSquare, Send, StopCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate, useTableRows } from "@/components/kit/LiveTable";
import { Field, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { StatusLegend } from "@/components/kit/StatusLegend";
import { supabase } from "@/integrations/supabase/client";
import { followupStatusLabels } from "@/lib/labels";
import { rowTone, toneRowClass } from "@/lib/status-tone";
import { sendWhatsAppMessage } from "@/lib/whatsapp.functions";

type FollowupRow = {
  id: string;
  recipient_name: string | null;
  recipient_phone: string;
  message_body: string;
  repeat_interval: string | null;
  sent_count: number | null;
  last_sent_at: string | null;
  next_send_at: string | null;
  status: string;
  payment_id: string | null;
  contract: { contract_number: string | null } | null;
};

type LogRow = {
  id: string;
  recipient_name: string | null;
  recipient_phone: string;
  body: string;
  channel: string;
  result: string;
  failure_reason: string | null;
  sent_by_system: boolean | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "إدارة التذكيرات | الرشودي للعقارات" },
      {
        name: "description",
        content: "إرسال ومتابعة تذكيرات الدفعات الإيجارية من شاشة واحدة مع سجل التواصل الكامل.",
      },
      { property: "og:title", content: "إدارة التذكيرات | الرشودي للعقارات" },
      { property: "og:description", content: "تذكيرات السداد والمتابعات المجدولة وحالة الإرسال." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RemindersPage,
});

function RemindersPage() {
  const queryClient = useQueryClient();

  const followups = useTableRows<FollowupRow>({
    table: "reminder_followups",
    select:
      "id, recipient_name, recipient_phone, message_body, repeat_interval, sent_count, last_sent_at, next_send_at, status, payment_id, contract:contract_id(contract_number)",
    orderBy: { column: "next_send_at", ascending: true },
    queryKey: ["reminder_followups"],
  });

  const log = useTableRows<LogRow>({
    table: "message_log",
    select:
      "id, recipient_name, recipient_phone, body, channel, result, failure_reason, sent_by_system, created_at",
    orderBy: { column: "created_at" },
    queryKey: ["message_log"],
  });

  const stop = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reminder_followups")
        .update({ status: "stopped" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder_followups"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم إيقاف التذكير");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الإيقاف"),
  });

  const markPaid = useMutation({
    mutationFn: async (row: FollowupRow) => {
      if (row.payment_id) {
        const { data: payment, error: payErr } = await supabase
          .from("contract_payments")
          .select("amount_due")
          .eq("id", row.payment_id)
          .maybeSingle();
        if (payErr) throw payErr;
        const { error: updErr } = await supabase
          .from("contract_payments")
          .update({ status: "paid", amount_paid: payment?.amount_due ?? 0 })
          .eq("id", row.payment_id);
        if (updErr) throw updErr;
      }
      const { error } = await supabase
        .from("reminder_followups")
        .update({ status: "done", next_send_at: null })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder_followups"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      queryClient.invalidateQueries({ queryKey: ["contract_payments"] });
      toast.success("تم تسجيل الدفع وإيقاف التذكير");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const sendNow = useMutation({
    mutationFn: async (row: FollowupRow) => {
      const result = await sendWhatsAppMessage({
        data: { to: row.recipient_phone, body: row.message_body },
      });
      if (!result.ok) throw new Error(result.error);
      const { error } = await supabase.from("message_log").insert({
        recipient_name: row.recipient_name,
        recipient_phone: row.recipient_phone,
        body: row.message_body,
        channel: "whatsapp",
        result: result.sid ? `sent:${result.sid}` : "sent",
        sent_by_system: false,
        followup_id: row.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message_log"] });
      toast.success("تم إرسال الرسالة مباشرة عبر واتساب");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الإرسال"),
  });

  const rows = followups.data ?? [];
  const stats = useMemo(
    () => ({
      scheduled: rows.filter((r) => r.status === "pending").length,
      active: rows.filter((r) => r.status !== "stopped" && r.status !== "done").length,
      messages: (log.data ?? []).length,
    }),
    [rows, log.data],
  );

  return (
    <>
      <PageHero
        title="إدارة التذكيرات"
        subtitle="إرسال ومتابعة تذكيرات الدفعات الإيجارية من شاشة واحدة."
        icon={BellRing}
        stats={[
          { value: String(stats.scheduled), label: "تذكير مجدول" },
          { value: String(stats.active), label: "متابعة نشطة" },
          { value: String(stats.messages), label: "رسالة في السجل" },
        ]}
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-primary" />
          <h2 className="text-[14px] font-bold text-foreground">المتابعات النشطة</h2>
        </div>
        <StatusLegend />
        <DataTable<FollowupRow>
          rows={rows}
          rowClassName={(r) => toneRowClass[rowTone(r.status, r.next_send_at)]}
          draggableRows
          dragLabel="تذكير"
          searchPlaceholder="بحث بالمستلم أو رقم العقد"
          emptyState={
            <EmptyState
              text="لا توجد تذكيرات مجدولة"
              hint="استخدم نموذج «إرسال تذكير» بالأعلى لإنشاء متابعة جديدة."
            />
          }
          columns={[
            {
              header: "المستلم",
              sortable: true,
              cell: (r) => r.recipient_name ?? "—",
              className: "font-semibold",
            },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.recipient_phone}</span> },
            { header: "العقد", cell: (r) => r.contract?.contract_number ?? "—" },
            {
              header: "التكرار",
              cell: (r) =>
                repeatOptions.find((o) => o.key === r.repeat_interval)?.label ??
                r.repeat_interval ??
                "مرة واحدة",
            },
            { header: "عدد الإرسالات", cell: (r) => r.sent_count ?? 0 },
            { header: "آخر إرسال", cell: (r) => formatDate(r.last_sent_at) },
            {
              header: "الإرسال القادم",
              sortable: true,
              value: (r) => r.next_send_at ?? "",
              cell: (r) => formatDate(r.next_send_at),
            },
            {
              header: "الحالة",
              cell: (r) => (
                <Chip tone={rowTone(r.status, r.next_send_at)}>
                  {followupStatusLabels[r.status] ?? r.status}
                </Chip>
              ),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <span className="inline-flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => sendNow.mutate(r)}
                    disabled={sendNow.isPending}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                  >
                    <Send className="size-4" />
                    إرسال الآن
                  </button>
                  {r.status !== "done" && r.status !== "stopped" ? (
                    <button
                      type="button"
                      onClick={() => markPaid.mutate(r)}
                      disabled={markPaid.isPending}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-success"
                    >
                      <CheckCircle2 className="size-4" />
                      تم الدفع
                    </button>
                  ) : null}
                  {r.status !== "stopped" ? (
                    <button
                      type="button"
                      onClick={() => stop.mutate(r.id)}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-destructive"
                    >
                      <StopCircle className="size-4" />
                      إيقاف
                    </button>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <h2 className="text-[14px] font-bold text-foreground">سجل التواصل</h2>
        </div>
        <StatusLegend />
        <DataTable<LogRow>
          rows={log.data ?? []}
          rowClassName={(r) => toneRowClass[rowTone(r.result)]}
          searchPlaceholder="بحث في سجل الرسائل"
          emptyState={
            <EmptyState
              text="لا توجد رسائل بعد"
              hint="كل تذكير يُرسل يُسجَّل هنا مع نتيجة الإرسال."
            />
          }
          columns={[
            { header: "المستلم", cell: (r) => r.recipient_name ?? "—", className: "font-semibold" },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.recipient_phone}</span> },
            { header: "الرسالة", cell: (r) => r.body.slice(0, 60) },
            {
              header: "النتيجة",
              cell: (r) => (
                <Chip tone={rowTone(r.result)}>
                  {r.result === "sent"
                    ? "تم الإرسال"
                    : r.result === "failed"
                      ? "تعذّر الإرسال"
                      : "في الانتظار"}
                </Chip>
              ),
            },
            { header: "بواسطة", cell: (r) => (r.sent_by_system ? "النظام" : "الفريق") },
            {
              header: "وقت الإرسال",
              sortable: true,
              value: (r) => r.created_at,
              cell: (r) => formatDate(r.created_at),
            },
          ]}
        />
      </section>
    </>
  );
}
