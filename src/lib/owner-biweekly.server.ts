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

export async function runOwnerBiweekly(now = new Date()) {
  const riyadh = new Date(now.getTime() + 3 * 3600_000);
  if (riyadh.getUTCDay() !== 5 || riyadh.getUTCHours() !== 16) return { ran: false, reason: "not friday 4pm" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: acquired, error } = await supabaseAdmin.rpc("acquire_automation_lease", {
    _job_name: JOB,
    _lease_seconds: 13 * 86400,
  });
  if (error) throw error;
  if (!acquired) return { ran: false, reason: "sent within last 14 days" };

  const { whatsappSend } = await import("@/lib/whatsapp.functions");
  const [c, u, p, r] = await Promise.all([
    supabaseAdmin.from("contracts").select("owner_id").not("owner_id", "is", null),
    supabaseAdmin.from("units").select("owner_id").not("owner_id", "is", null),
    supabaseAdmin.from("properties").select("owner_id, purpose").not("owner_id", "is", null),
    supabaseAdmin.from("contacts").select("id").contains("roles", ["owner"]),
  ]);
  const ids = new Set<string>([
    ...(c.data ?? []).map((x) => x.owner_id as string),
    ...(u.data ?? []).map((x) => x.owner_id as string),
    ...(p.data ?? []).map((x) => x.owner_id as string),
    ...(r.data ?? []).map((x) => x.id),
  ]);
  const { data: owners } = ids.size
    ? await supabaseAdmin.from("contacts").select("id, full_name, phone, whatsapp").in("id", [...ids]).eq("is_active", true)
    : { data: [] as { id: string; full_name: string; phone: string | null; whatsapp: string | null }[] };
  // The message wording follows what the owner actually lists with us: rent, sale, or both.
  const purposes = new Map<string, Set<string>>();
  for (const row of (p.data ?? []) as { owner_id: string; purpose: string | null }[]) {
    if (!row.purpose) continue;
    const set = purposes.get(row.owner_id) ?? new Set<string>();
    set.add(row.purpose === "sale" ? "sale" : "rent");
    purposes.set(row.owner_id, set);
  }
  const messageFor = (ownerId: string) => {
    const set = purposes.get(ownerId);
    if (!set || set.size === 0) return OWNER_BIWEEKLY_MESSAGE_BOTH;
    if (set.size > 1) return OWNER_BIWEEKLY_MESSAGE_BOTH;
    return set.has("rent") ? OWNER_BIWEEKLY_MESSAGE_RENT : OWNER_BIWEEKLY_MESSAGE_SALE;
  };
  const seen = new Set<string>();
  let sent = 0;
  let failed = 0;
  for (const o of owners ?? []) {
    const phone = (o.whatsapp || o.phone || "").trim();
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    try {
      const r = await whatsappSend({ to: phone, body: messageFor(o.id) });
      if (r.ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }
  // If WhatsApp was down and nothing went out, release the 13-day lock so the
  // message is retried next Friday at 4pm instead of being skipped for 2 weeks.
  if (sent === 0 && failed > 0) {
    await supabaseAdmin.rpc("finish_automation_lease", { _job_name: JOB, _error: `all ${failed} sends failed` });
  }
  return { ran: true, sent, failed };
}
