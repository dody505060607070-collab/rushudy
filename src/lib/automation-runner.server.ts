/**
 * محرّك الأتمتة الدورية — يُستدعى كل ساعة من /api/public/n8n.
 * كل تشغيل محدود، محمي بقفل قاعدة بيانات، ويكتب تقدمه بمفاتيح عدم تكرار.
 */

type RunResult = {
  ok: true;
  skipped?: boolean;
  ranAt: string;
  reminders: { due: number; sent: number; failed: number };
  tasks: { due: number; sent: number; failed: number; skippedNoPhone: number };
  overdue: { payments: number; notified: number };
};

const JOB_NAME = "hourly_automation";
const REMINDER_BATCH = 40;

function intervalHours(interval: string): number | null {
  switch (interval) {
    case "6h":
      return 6;
    case "8h":
      return 8;
    case "12h":
    case "12_hours":
      return 12;
    case "24h":
    case "daily":
      return 24;
    case "3d":
    case "three_days":
      return 72;
    case "weekly":
      return 24 * 7;
    case "biweekly":
      return 24 * 14;
    case "monthly":
      return 24 * 30;
    case "yearly":
      return 24 * 365;
    default:
      return null;
  }
}

/**
 * يحسب الموعد التالي بحيث يكون دائمًا في المستقبل.
 * هذا يمنع الإرسال المتكرر كل ساعة عندما يتأخر التشغيل عن موعد سابق.
 */
function nextSendDate(from: Date, interval: string, now: Date): string | null {
  const step = intervalHours(interval);
  if (step === null) return null;
  const d = new Date(from);
  let guard = 0;
  do {
    d.setHours(d.getHours() + step);
    guard += 1;
  } while (d.getTime() <= now.getTime() && guard < 1000);
  return d.toISOString();
}


/** رابط خرائط Google لموقع المهمة (إحداثيات أو بحث بالوصف). */
export function taskMapUrl(input: {
  locationLat?: number | string | null;
  locationLng?: number | string | null;
  locationText?: string | null;
}): string | null {
  const lat = input.locationLat;
  const lng = input.locationLng;
  if (lat !== null && lat !== undefined && lat !== "" && lng !== null && lng !== undefined && lng !== "") {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const text = input.locationText?.trim();
  if (text) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
  return null;
}

export function taskMessage(input: {
  employeeName: string;
  title: string;
  details: string | null;
  priority: string;
  dueDate: string | null;
  dueTime: string | null;
  locationText?: string | null;
  locationLat?: number | string | null;
  locationLng?: number | string | null;
}): string {
  const priority = input.priority === "urgent" ? "عاجلة" : input.priority === "high" ? "عالية" : "عادية";
  const due = [input.dueDate, input.dueTime].filter(Boolean).join(" ");
  const mapUrl = taskMapUrl(input);
  return [
    `مرحبًا ${input.employeeName}،`,
    `تذكير بمهمة ${priority}: ${input.title}`,
    input.details ? `التفاصيل: ${input.details}` : null,
    due ? `موعد التسليم: ${due}` : null,
    input.locationText ? `الموقع: ${input.locationText}` : null,
    mapUrl ? `الموقع على الخريطة: ${mapUrl}` : null,
    "يرجى تحديث حالة المهمة من لوحة الرشودي للعقارات عند الانتهاء.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * يتحقق إن كان ما زال هناك مستحق فعلي قبل إرسال التذكير.
 * - تذكير مرتبط بدفعة: يتوقف إذا سُدّدت الدفعة.
 * - تذكير مرتبط بعقد فقط: يتوقف إذا سُدّدت كل دفعات العقد أو انتهى/أُلغي العقد.
 * - تذكير عام بلا عقد ولا دفعة: يستمر كما هو.
 */
async function hasOutstandingPayment(
  db: { from: (t: string) => any },
  ref: { paymentId?: string | null; contractId?: string | null },
): Promise<boolean> {
  const isUnpaid = (row: { status?: string | null; amount_due?: number | null; amount_paid?: number | null }) =>
    row.status !== "paid" &&
    row.status !== "cancelled" &&
    Number(row.amount_paid ?? 0) < Number(row.amount_due ?? 0);

  if (ref.paymentId) {
    const { data } = await db
      .from("contract_payments")
      .select("status, amount_due, amount_paid")
      .eq("id", ref.paymentId)
      .maybeSingle();
    if (!data) return false;
    return isUnpaid(data);
  }

  if (ref.contractId) {
    const { data: contract } = await db
      .from("contracts")
      .select("status")
      .eq("id", ref.contractId)
      .maybeSingle();
    if (!contract) return false;
    if (["cancelled", "terminated", "ended", "expired", "closed"].includes(String(contract.status))) return false;

    const { data: payments } = await db
      .from("contract_payments")
      .select("status, amount_due, amount_paid")
      .eq("contract_id", ref.contractId)
      .limit(200);
    if (!payments || payments.length === 0) return true;
    return payments.some(isUnpaid);
  }

  return true;
}

export async function runHourlyAutomation(): Promise<RunResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { whatsappSend } = await import("@/lib/whatsapp.functions");
  const now = new Date();
  const nowIso = now.toISOString();

  // مفتاح رئيسي: لا يُرسل أي شيء تلقائيًا على واتساب إلا إذا فعّله المستخدم صراحةً.
  const { data: settingsRow } = await supabaseAdmin
    .from("app_settings")
    .select("whatsapp_auto_send_enabled")
    .maybeSingle();
  if (!settingsRow?.whatsapp_auto_send_enabled) {
    return {
      ok: true,
      skipped: true,
      ranAt: nowIso,
      reminders: { due: 0, sent: 0, failed: 0 },
      tasks: { due: 0, sent: 0, failed: 0, skippedNoPhone: 0 },
      overdue: { payments: 0, notified: 0 },
    };
  }

  const { data: acquired, error: leaseError } = await supabaseAdmin.rpc("acquire_automation_lease", {
    _job_name: JOB_NAME,
    _lease_seconds: 3300,
  });
  if (leaseError) throw leaseError;
  if (!acquired) {
    return {
      ok: true,
      skipped: true,
      ranAt: nowIso,
      reminders: { due: 0, sent: 0, failed: 0 },
      tasks: { due: 0, sent: 0, failed: 0, skippedNoPhone: 0 },
      overdue: { payments: 0, notified: 0 },
    };
  }

  let runError: string | null = null;
  try {
    const { error: expiryError } = await supabaseAdmin.rpc("expire_reservations");
    if (expiryError) throw expiryError;

    const { data: due, error: dueError } = await supabaseAdmin
      .from("reminder_followups")
      .select(
        "id, contract_id, payment_id, unit_id, recipient_name, recipient_phone, message_body, repeat_interval, sent_count, next_send_at",
      )
      .in("status", ["pending", "active"])
      .lte("next_send_at", nowIso)
      .order("next_send_at", { ascending: true })
      .limit(REMINDER_BATCH);
    if (dueError) throw dueError;

    let sent = 0;
    let failed = 0;
    let skippedPaid = 0;
    for (const reminder of due ?? []) {
      // لا تُرسل تذكير سداد لمن سدّد بالفعل أو لعقد منتهٍ/ملغي
      const stillOwes = await hasOutstandingPayment(supabaseAdmin, {
        paymentId: reminder.payment_id,
        contractId: reminder.contract_id,
      });
      if (!stillOwes) {
        skippedPaid += 1;
        await supabaseAdmin
          .from("reminder_followups")
          .update({ status: "done", next_send_at: null })
          .eq("id", reminder.id);
        continue;
      }
      const scheduledAt = reminder.next_send_at ?? nowIso;
      const idempotencyKey = `followup:${reminder.id}:${scheduledAt}`;
      const { data: existing } = await supabaseAdmin
        .from("message_log")
        .select("id, result")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing?.result === "sent") continue;

      const result = await whatsappSend({ to: reminder.recipient_phone, body: reminder.message_body });
      if (result.ok) sent += 1;
      else failed += 1;

      await supabaseAdmin.from("message_log").upsert(
        {
          followup_id: reminder.id,
          contract_id: reminder.contract_id,
          payment_id: reminder.payment_id,
          unit_id: reminder.unit_id,
          recipient_name: reminder.recipient_name,
          recipient_phone: reminder.recipient_phone,
          body: reminder.message_body,
          channel: "whatsapp",
          result: result.ok ? "sent" : "failed",
          failure_reason: result.ok ? null : result.error,
          provider_message_id: result.ok ? result.sid : null,
          sent_by_system: true,
          idempotency_key: idempotencyKey,
        },
        { onConflict: "idempotency_key" },
      );

      // النجاح: الموعد التالي حسب التكرار الذي اختاره المستخدم فقط.
      // الفشل: إعادة المحاولة بعد 6 ساعات كحد أدنى — وليس كل ساعة.
      const interval = reminder.repeat_interval ?? "once";
      const next = result.ok
        ? nextSendDate(new Date(scheduledAt), interval, now)
        : new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from("reminder_followups")
        .update({
          sent_count: (reminder.sent_count ?? 0) + (result.ok ? 1 : 0),
          last_sent_at: result.ok ? nowIso : null,
          next_send_at: next,
          status: result.ok ? (next ? "active" : "done") : "active",
        })
        .eq("id", reminder.id);
    }

    // المهام: تتكرر الرسالة فقط للمهام التي كُلّف بها موظف فعليًا (يوجد لها سجل تذكير)
    // وحسب أولويتها، وتتوقف فورًا عند إغلاق المهمة.
    const { CLOSED_TASK_STATUSES, taskIntervalHours } = await import("@/lib/tasks.server");
    const { data: dueTasks, error: taskError } = await supabaseAdmin
      .from("task_reminder_state")
      .select(
        "id, task_id, user_id, sent_count, next_send_at, task:task_id(title, details, priority, status, due_date, due_time), profile:user_id(full_name, phone, whatsapp, whatsapp_notify, is_active)",
      )
      .lte("next_send_at", nowIso)
      .order("next_send_at", { ascending: true })
      .limit(40);
    if (taskError) throw taskError;

    let taskSent = 0;
    let taskFailed = 0;
    let skippedNoPhone = 0;
    const taskDue = (dueTasks ?? []).length;

    for (const state of dueTasks ?? []) {
      const task = Array.isArray(state.task) ? state.task[0] : state.task;
      const profile = Array.isArray(state.profile) ? state.profile[0] : state.profile;
      if (!task || CLOSED_TASK_STATUSES.includes(String(task.status))) {
        await supabaseAdmin.from("task_reminder_state").delete().eq("id", state.id);
        continue;
      }
      const phone = profile?.whatsapp ?? profile?.phone ?? "";
      if (!profile?.is_active || !profile.whatsapp_notify || !phone) {
        skippedNoPhone += 1;
        await supabaseAdmin.from("task_reminder_state").delete().eq("id", state.id);
        continue;
      }
      const body = taskMessage({
        employeeName: profile.full_name || "زميلنا",
        title: task.title,
        details: task.details,
        priority: task.priority,
        dueDate: task.due_date,
        dueTime: task.due_time,
      });
      const scheduledAt = state.next_send_at ?? nowIso;
      const idempotencyKey = `task-cycle:${state.id}:${scheduledAt}`;
      const sendResult = await whatsappSend({ to: phone, body });
      if (sendResult.ok) taskSent += 1;
      else taskFailed += 1;

      await supabaseAdmin.from("message_log").upsert(
        {
          task_id: state.task_id,
          recipient_name: profile.full_name,
          recipient_phone: phone,
          body,
          channel: "whatsapp",
          result: sendResult.ok ? "sent" : "failed",
          failure_reason: sendResult.ok ? null : sendResult.error,
          provider_message_id: sendResult.ok ? sendResult.sid : null,
          sent_by_system: true,
          idempotency_key: idempotencyKey,
        },
        { onConflict: "idempotency_key" },
      );

      const stepHours = sendResult.ok ? taskIntervalHours(task.priority) : 6;
      await supabaseAdmin
        .from("task_reminder_state")
        .update({
          sent_count: (state.sent_count ?? 0) + (sendResult.ok ? 1 : 0),
          last_sent_at: sendResult.ok ? nowIso : state.next_send_at,
          last_error: sendResult.ok ? null : sendResult.error,
          next_send_at: new Date(now.getTime() + stepHours * 3600_000).toISOString(),
        })
        .eq("id", state.id);
    }

    const today = nowIso.slice(0, 10);
    const { data: overdue, error: overdueError } = await supabaseAdmin
      .from("contract_payments")
      .select("id")
      .lt("due_date", today)
      .neq("status", "paid")
      .limit(200);
    if (overdueError) throw overdueError;

    let notified = 0;
    const overdueCount = (overdue ?? []).length;
    if (overdueCount > 0 && now.getUTCHours() === 5) {
      const dailyKey = `overdue:${today}`;
      const { data: alreadyNotified } = await supabaseAdmin
        .from("automation_events")
        .select("id")
        .eq("event", dailyKey)
        .maybeSingle();
      if (!alreadyNotified) {
        const { data: staff } = await supabaseAdmin.from("user_roles").select("user_id");
        const ids = Array.from(new Set((staff ?? []).map((row) => row.user_id)));
        if (ids.length > 0) {
          await supabaseAdmin.from("notifications").insert(
            ids.map((user_id) => ({
              user_id,
              title: "دفعات متأخرة",
              body: `يوجد ${overdueCount} دفعة متأخرة تحتاج متابعة`,
              link: "/payments",
            })),
          );
          notified = ids.length;
        }
        await supabaseAdmin.from("automation_events").insert({
          event: dailyKey,
          direction: "in",
          payload: { overdue: overdueCount, notified } as never,
          status: "sent",
        });
      }
    }

    await supabaseAdmin.from("automation_events").insert({
      event: "automation.hourly_run",
      direction: "in",
      payload: {
        reminders: { due: (due ?? []).length, sent, failed },
        tasks: { due: taskDue, sent: taskSent, failed: taskFailed, skippedNoPhone },
        overdue: overdueCount,
      } as never,
      status: failed + taskFailed > 0 ? "partial" : "sent",
    });

    return {
      ok: true,
      ranAt: nowIso,
      reminders: { due: (due ?? []).length, sent, failed },
      tasks: { due: taskDue, sent: taskSent, failed: taskFailed, skippedNoPhone },
      overdue: { payments: overdueCount, notified },
    };
  } catch (error) {
    runError = error instanceof Error ? error.message : "تعذر تشغيل الأتمتة";
    throw error;
  } finally {
    await supabaseAdmin.rpc(
      "finish_automation_lease",
      runError ? { _job_name: JOB_NAME, _error: runError } : { _job_name: JOB_NAME },
    );
  }
}