/**
 * رسالة متابعة الملاك: كل أسبوعين، يوم الجمعة الساعة 4 العصر (توقيت الرياض).
 * تعمل مع التشغيل الدوري كل ساعة. القفل لمدة 13 يومًا يضمن الإرسال مرة كل 14 يومًا فقط.
 */
export const OWNER_BIWEEKLY_MESSAGE = `السلام عليكم ورحمة الله وبركاته

عزيزنا المالك، تحية طيبة وبعد،

يسعدنا في مكتب الرشودي للعقارات التواصل معكم لمعرفة آخر مستجدات العقار المعروض لدينا، وحرصًا منا على استمرار التسويق بشكل دقيق ومناسب للعقار، نأمل التكرم بتزويدنا بالتحديثات التالية:

🔹 هل العقار لا يزال قائمًا ومعروضًا للبيع؟

🔹 كم بلغ آخر سوم وصل للعقار؟

🔹 وما هو الحد المطلوب للبيع حاليًا؟

وذلك حتى نتمكن من تحديث بيانات العرض لدينا، ومتابعة العملاء المهتمين وفق آخر المستجدات.

شاكرين لكم ثقتكم وتعاونكم، ونسعد دائمًا بخدمتكم وتسويق عقاركم بالشكل الذي يليق به.

مكتب الرشودي للعقارات`;

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
    supabaseAdmin.from("properties").select("owner_id").not("owner_id", "is", null),
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
  const seen = new Set<string>();
  let sent = 0;
  let failed = 0;
  for (const o of owners ?? []) {
    const phone = (o.whatsapp || o.phone || "").trim();
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    try {
      const r = await whatsappSend({ to: phone, body: OWNER_BIWEEKLY_MESSAGE });
      if (r.ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }
  return { ran: true, sent, failed };
}
