import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { credentialDigits } from "./client-credentials";

/** مفتاح المقارنة: آخر 9 أرقام (يتجاهل 0 و 966 و +). */
function phoneKey(raw: string | null | undefined) {
  const d = credentialDigits(raw);
  return d.length >= 9 ? d.slice(-9) : "";
}

async function sha(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** يحدد صاحب الرقم في النظام: موظف ← شركة خدمات ← مالك/مستأجر. */
async function findUserByPhone(db: Db, key: string): Promise<string | null> {
  const like = `%${key}`;

  const staff = await db.from("profiles").select("id, phone, is_active").ilike("phone", like).limit(5);
  const s = (staff.data ?? []).find((p) => p.is_active !== false && phoneKey(p.phone) === key);
  if (s) return s.id;

  const partners = await db.from("service_partners").select("id, whatsapp_number").ilike("whatsapp_number", like).limit(5);
  for (const p of partners.data ?? []) {
    if (phoneKey(p.whatsapp_number) !== key) continue;
    const acc = await db.from("service_partner_accounts").select("user_id").eq("partner_id", p.id).maybeSingle();
    if (acc.data?.user_id) return acc.data.user_id;
  }

  const contacts = await db
    .from("contacts")
    .select("id, phone, whatsapp, phone_alt")
    .or(`phone.ilike.${like},whatsapp.ilike.${like},phone_alt.ilike.${like}`)
    .limit(10);
  for (const c of contacts.data ?? []) {
    if (![c.phone, c.whatsapp, c.phone_alt].some((v) => phoneKey(v) === key)) continue;
    let acc = await db.from("client_accounts").select("user_id").eq("contact_id", c.id).maybeSingle();
    if (!acc.data) {
      const { ensureClientAccountForContact } = await import("./client-account.server");
      await ensureClientAccountForContact(c.id);
      acc = await db.from("client_accounts").select("user_id").eq("contact_id", c.id).maybeSingle();
    }
    if (acc.data?.user_id) return acc.data.user_id;
  }
  return null;
}

const phoneInput = z.object({
  country: z.string().regex(/^\d{1,4}$/),
  phone: z.string().min(6).max(20),
});

export const requestPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((d) => phoneInput.parse(d))
  .handler(async ({ data }) => {
    const key = phoneKey(data.phone);
    if (!key) return { ok: false as const, error: "رقم الجوال غير صحيح." };
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const recent = await db
      .from("login_otps")
      .select("created_at")
      .eq("phone_key", key)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .limit(1);
    if (recent.data?.length) return { ok: false as const, error: "انتظر دقيقة قبل طلب رمز جديد." };

    const userId = await findUserByPhone(db, key);
    if (!userId) return { ok: false as const, error: "هذا الرقم غير مسجّل لدينا. تواصل مع مكتب الرشودي لإضافته." };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ins = await db.from("login_otps").insert({
      phone_key: key,
      user_id: userId,
      code_hash: await sha(`${key}:${code}`),
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (ins.error) return { ok: false as const, error: "تعذّر إنشاء الرمز، حاول مرة أخرى." };

    const local = credentialDigits(data.phone).replace(/^0+/, "");
    const to = local.startsWith(data.country) ? local : `${data.country}${local}`;
    const { whatsappSend } = await import("./whatsapp.functions");
    const sent = await whatsappSend({
      to: `+${to}`,
      body: `رمز الدخول إلى الرشودي للعقارات: ${code}\nصالح لمدة 5 دقائق. لا تشاركه مع أي شخص.`,
    });
    if (!sent.ok) return { ok: false as const, error: "تعذّر إرسال الرمز على واتساب. تأكد أن الرقم عليه واتساب أو تواصل مع المكتب." };
    return { ok: true as const };
  });

export const verifyPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((d) => phoneInput.extend({ code: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data }) => {
    const key = phoneKey(data.phone);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const row = await db
      .from("login_otps")
      .select("id, user_id, code_hash, attempts, expires_at, consumed")
      .eq("phone_key", key)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const otp = row.data;
    if (!otp || otp.consumed || new Date(otp.expires_at) < new Date())
      return { ok: false as const, error: "انتهت صلاحية الرمز. اطلب رمزًا جديدًا." };
    if (otp.attempts >= 5) return { ok: false as const, error: "محاولات كثيرة. اطلب رمزًا جديدًا." };
    if ((await sha(`${key}:${data.code}`)) !== otp.code_hash) {
      await db.from("login_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
      return { ok: false as const, error: "الرمز غير صحيح." };
    }
    await db.from("login_otps").update({ consumed: true }).eq("id", otp.id);

    const user = await db.auth.admin.getUserById(otp.user_id);
    const email = user.data.user?.email;
    if (!email) return { ok: false as const, error: "الحساب غير مكتمل. تواصل مع المكتب." };
    const link = await db.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link.data.properties?.hashed_token;
    if (link.error || !tokenHash) return { ok: false as const, error: "تعذّر فتح الجلسة، حاول مرة أخرى." };

    const [partner, client] = await Promise.all([
      db.from("service_partner_accounts").select("id").eq("user_id", otp.user_id).maybeSingle(),
      db.from("client_accounts").select("id").eq("user_id", otp.user_id).maybeSingle(),
    ]);
    const staff = await db.rpc("is_staff", { _user_id: otp.user_id });
    const destination = staff.data ? "/dashboard" : partner.data ? "/partner" : client.data ? "/portal" : "/dashboard";
    return { ok: true as const, tokenHash, destination };
  });
