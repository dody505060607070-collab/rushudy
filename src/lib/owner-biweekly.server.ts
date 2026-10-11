/**
 * رسالة متابعة الملاك: كل أسبوعين، يوم الجمعة الساعة 4 العصر (توقيت الرياض).
 * تعمل مع التشغيل الدوري كل ساعة. القفل لمدة 13 يومًا يضمن الإرسال مرة كل 14 يومًا فقط.
 */
export const OWNER_BIWEEKLY_MESSAGE_SALE = `السلام عليكم ورحمة الله وبركاته

عزيزنا المالك، تحية طيبة وبعد،

يسعدنا في مكتب الرشودي للعقارات التواصل معكم لمعرفة آخر مستجدات العقار المعروض لدينا، وحرصًا منا على استمرار التسويق بشكل دقيق ومناسب للعقار، نأمل التكرم بتزويدنا بالتحديثات التالية:

🔹 هل العقار لا يزال قائمًا ومعروضًا للبيع؟

🔹 كم بلغ آخر سوم وصل للعقار؟

🔹 وما هو الحد المطلوب للبيع حاليًا؟

وذلك حتى نتمكن من تحديث بيانات العرض لدينا، ومتابعة العملاء المهتمين وفق آخر المستجدات.

شاكرين لكم ثقتكم وتعاونكم، ونسعد دائمًا بخدمتكم وتسويق عقاركم بالشكل الذي يليق به.

مكتب الرشودي للعقارات`;

export const OWNER_BIWEEKLY_MESSAGE_RENT = OWNER_BIWEEKLY_MESSAGE_SALE
  .replace("🔹 هل العقار لا يزال قائمًا ومعروضًا للبيع؟", "🔹 هل العقار لا يزال متاحًا ومعروضًا للإيجار؟")
  .replace("🔹 كم بلغ آخر سوم وصل للعقار؟", "🔹 كم بلغ آخر عرض إيجار وصل للعقار؟")
  .replace("🔹 وما هو الحد المطلوب للبيع حاليًا؟", "🔹 وما هو مبلغ الإيجار المطلوب حاليًا؟");
export const OWNER_BIWEEKLY_MESSAGE_BOTH = OWNER_BIWEEKLY_MESSAGE_SALE
  .replace("🔹 هل العقار لا يزال قائمًا ومعروضًا للبيع؟", "🔹 هل العقار لا يزال قائمًا ومعروضًا (للبيع أو للإيجار)؟")
  .replace("🔹 كم بلغ آخر سوم وصل للعقار؟", "🔹 كم بلغ آخر سوم أو عرض إيجار وصل للعقار؟")
  .replace("🔹 وما هو الحد المطلوب للبيع حاليًا؟", "🔹 وما هو الحد المطلوب للبيع أو مبلغ الإيجار المطلوب حاليًا؟");
/** Kept for older imports. */
export const OWNER_BIWEEKLY_MESSAGE = OWNER_BIWEEKLY_MESSAGE_SALE;

const JOB = "owner_biweekly_followup";

/** Resolve config: enabled flag + editable template (falls back to default). */
export async function loadOwnerFollowupConfig() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("owner_followup_config").select("enabled, template").eq("id", true).maybeSingle();
  return { enabled: data?.enabled ?? true, template: (data?.template || "").trim() || OWNER_BIWEEKLY_MESSAGE_SALE };
}

/** Sends the follow-up to sale owners (optionally one owner) and logs every attempt. */
export async function sendOwnerFollowup(opts: { contactId?: string | undefined; sentBy?: string | null } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { whatsappSend } = await import("@/lib/whatsapp.functions");
  const cfg = await loadOwnerFollowupConfig();
  let q = supabaseAdmin
    .from("contacts")
    .select("id, full_name, phone, whatsapp")
    .contains("roles", ["sale_owner"])
    .eq("is_active", true);
  if (opts.contactId) q = q.eq("id", opts.contactId);
  const { data: owners } = await q;
  const seen = new Set<string>();
  let sent = 0;
  let failed = 0;
  for (const o of owners ?? []) {
    const phone = (o.whatsapp || o.phone || "").trim();
    if (!phone || seen.has(phone)) {
      if (!phone) {
        failed++;
        await supabaseAdmin.from("message_log").insert({
          kind: "owner_biweekly", contact_id: o.id, recipient_name: o.full_name, recipient_phone: "",
          body: cfg.template, channel: "whatsapp", result: "failed", failure_reason: "لا يوجد رقم جوال",
          sent_by: opts.sentBy ?? null, sent_by_system: !opts.sentBy,
        });
      }
      continue;
    }
    seen.add(phone);
    let ok = false;
    let reason: string | null = null;
    let sid: string | null = null;
    try {
      const r = await whatsappSend({ to: phone, body: cfg.template });
      ok = r.ok;
      if (r.ok) sid = r.sid ?? null;
      else reason = r.error;
    } catch (e) {
      reason = e instanceof Error ? e.message : "خطأ غير معروف";
    }
    if (ok) sent++;
    else failed++;
    await supabaseAdmin.from("message_log").insert({
      kind: "owner_biweekly", contact_id: o.id, recipient_name: o.full_name, recipient_phone: phone,
      body: cfg.template, channel: "whatsapp", result: ok ? "sent" : "failed", failure_reason: reason,
      provider_message_id: sid, sent_by: opts.sentBy ?? null, sent_by_system: !opts.sentBy,
    });
  }
  return { sent, failed };
}

export async function runOwnerBiweekly(now = new Date()) {
  const riyadh = new Date(now.getTime() + 3 * 3600_000);
  if (riyadh.getUTCDay() !== 5 || riyadh.getUTCHours() !== 16) return { ran: false, reason: "not friday 4pm" };
  const cfg = await loadOwnerFollowupConfig();
  if (!cfg.enabled) return { ran: false, reason: "disabled" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: acquired, error } = await supabaseAdmin.rpc("acquire_automation_lease", {
    _job_name: JOB,
    _lease_seconds: 13 * 86400,
  });
  if (error) throw error;
  if (!acquired) return { ran: false, reason: "sent within last 14 days" };

  const { sent, failed } = await sendOwnerFollowup();
  // If WhatsApp was down and nothing went out, release the 13-day lock so the
  // message is retried next Friday at 4pm instead of being skipped for 2 weeks.
  if (sent === 0 && failed > 0) {
    await supabaseAdmin.rpc("finish_automation_lease", { _job_name: JOB, _error: `all ${failed} sends failed` });
  }
  return { ran: true, sent, failed };
}

export const OWNER_FOLLOWUP_JOB = JOB;
