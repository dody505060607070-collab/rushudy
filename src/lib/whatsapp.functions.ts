import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * إرسال واتساب عبر Evolution API فقط (الرقم المرتبط برمز QR).
 * السرّيات: WHATSAPP_API_URL + WHATSAPP_API_KEY + WHATSAPP_INSTANCE
 */

/** يحوّل رقمًا سعوديًا محليًا (05xxxxxxxx) إلى صيغة +966xxxxxxxx. */
export function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00966")) return `+${digits.slice(2)}`;
  if (digits.startsWith("966")) return `+${digits}`;
  if (digits.startsWith("05")) return `+966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `+966${digits}`;
  return digits.startsWith("00") ? `+${digits.slice(2)}` : `+${digits}`;
}

type TwilioResult =
  | { ok: true; sid: string }
  | { ok: false; error: string; needsTemplate?: boolean };

/** إعداد Evolution API (الجسر المجاني على الـVPS). */
function evoConfig() {
  const url = process.env["WHATSAPP_API_URL"];
  const key = process.env["WHATSAPP_API_KEY"];
  const instance = process.env["WHATSAPP_INSTANCE"] ?? "mithra2";
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key, instance };
}

async function evoFetch(path: string, init?: RequestInit) {
  const cfg = evoConfig();
  if (!cfg) throw new Error("إعدادات واتساب غير مكتملة");
  return fetch(`${cfg.url}${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** ينشئ الـ instance الخاصة بهذا الموقع تلقائيًا لو مش موجودة. */
export async function cloudEnsureInstance(): Promise<void> {
  const cfg = evoConfig();
  if (!cfg) return;
  try {
    const res = await evoFetch(`/instance/connectionState/${cfg.instance}`);
    if (res.ok) return;
    await evoFetch(`/instance/create`, {
      method: "POST",
      body: JSON.stringify({
        instanceName: cfg.instance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    });
  } catch {
    /* تجاهل — هيتم الإبلاغ عند المحاولة التالية */
  }
}

/** إرسال عبر Evolution API من الرقم المرتبط بالـQR. */
async function bridgeSend(to: string, body: string): Promise<TwilioResult | null> {
  const cfg = evoConfig();
  if (!cfg) return null;
  try {
    const res = await evoFetch(`/message/sendText/${cfg.instance}`, {
      method: "POST",
      body: JSON.stringify({ number: toE164(to).replace("+", ""), text: body }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      key?: { id?: string };
      message?: string;
      error?: string;
    };
    if (res.ok) return { ok: true, sid: data.key?.id ?? "" };
    return { ok: false, error: data.message ?? data.error ?? `WhatsApp ${res.status}` };
  } catch (e) {
    return { ok: false, error: `تعذر الاتصال بخدمة واتساب: ${(e as Error).message}` };
  }
}

export async function twilioSend(input: {
  to: string;
  body: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}): Promise<TwilioResult> {
  // الأولوية للجسر المجاني (الرقم المرتبط بالـQR)، وإن فشل نرجع لـTwilio.
  if (!input.contentSid) {
    const viaBridge = await bridgeSend(input.to, input.body);
    if (viaBridge?.ok) return viaBridge;
  }

  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_WHATSAPP_FROM"] ?? "whatsapp:+17372212163";
  if (!sid || !token) return { ok: false, error: "بيانات Twilio غير مكتملة في النظام" };

  const to = toE164(input.to);
  if (!to.startsWith("+") || to.length < 8) {
    return { ok: false, error: `رقم الجوال غير صالح: ${input.to}` };
  }

  const form = new URLSearchParams({ To: `whatsapp:${to}`, From: from });
  if (input.contentSid) {
    form.set("ContentSid", input.contentSid);
    if (input.contentVariables) form.set("ContentVariables", JSON.stringify(input.contentVariables));
  } else {
    form.set("Body", input.body);
  }

  let res: Response;
  try {
    res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
  } catch (e) {
    return { ok: false, error: `تعذر الاتصال بـ Twilio: ${(e as Error).message}` };
  }

  if (res.ok) {
    const data = (await res.json()) as { sid?: string };
    return { ok: true, sid: data.sid ?? "" };
  }

  const text = await res.text();
  let message = `Twilio ${res.status}`;
  try {
    const parsed = JSON.parse(text) as { message?: string; code?: number };
    if (parsed.message) message = `Twilio ${parsed.code ?? res.status}: ${parsed.message}`;
    // 63016 = خارج نافذة الـ 24 ساعة → يجب استخدام قالب معتمد
    if (parsed.code === 63016) {
      return {
        ok: false,
        needsTemplate: true,
        error: "العميل خارج نافذة الـ24 ساعة — يلزم قالب واتساب معتمد لهذه الرسالة",
      };
    }
  } catch {
    message = `Twilio ${res.status}: ${text.slice(0, 200)}`;
  }
  return { ok: false, error: message };
}

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      z
        .object({
          to: z.string().trim().regex(/^\+?[0-9\s()-]{8,20}$/),
          body: z.string().trim().min(1).max(4000),
        })
        .parse(input),
  )
  .handler(async ({ data }): Promise<TwilioResult> => {
    const { requireUnlocked } = await import("@/lib/kill-switch.server");
    await requireUnlocked();
    const result = await twilioSend({ to: data.to, body: data.body });
    const { dispatchAutomation } = await import("@/lib/automation.server");
    await dispatchAutomation("whatsapp.sent", {
      to: data.to,
      body: data.body,
      ok: result.ok,
      sid: result.ok ? result.sid : null,
      error: result.ok ? null : result.error,
    });
    return result;
  });

export const checkTwilioConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      configured: Boolean(process.env["TWILIO_ACCOUNT_SID"] && process.env["TWILIO_AUTH_TOKEN"]),
      from: process.env["TWILIO_WHATSAPP_FROM"] ?? null,
    };
  });

/** حالة ربط واتساب + رمز QR للمسح (Evolution API). */
export const getWhatsAppLinkStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cfg = evoConfig();
    if (!cfg) {
      return { configured: false, connection: "closed" as const, qr: null, me: null, error: null };
    }
    try {
      await cloudEnsureInstance();
      const stateRes = await evoFetch(`/instance/connectionState/${cfg.instance}`);
      const stateData = (await stateRes.json().catch(() => ({}))) as {
        instance?: { state?: string };
        message?: string;
      };
      const state = stateData.instance?.state ?? "close";
      if (state === "open") {
        let me: string | null = null;
        try {
          const listRes = await evoFetch(`/instance/fetchInstances`);
          const list = (await listRes.json().catch(() => [])) as Array<{
            name?: string;
            instance?: { instanceName?: string; owner?: string };
            ownerJid?: string;
          }>;
          const found = list.find(
            (i) => i.name === cfg.instance || i.instance?.instanceName === cfg.instance,
          );
          me = (found?.ownerJid ?? found?.instance?.owner ?? null)?.split("@")[0] ?? null;
        } catch {
          /* الاسم اختياري */
        }
        return { configured: true, connection: "open" as const, qr: null, me, error: null };
      }

      const qrRes = await evoFetch(`/instance/connect/${cfg.instance}`);
      const qrData = (await qrRes.json().catch(() => ({}))) as {
        base64?: string;
        code?: string;
        message?: string;
      };
      return {
        configured: true,
        connection: "connecting" as const,
        qr: qrData.base64
          ? qrData.base64.startsWith("data:")
            ? qrData.base64
            : `data:image/png;base64,${qrData.base64}`
          : null,
        me: null,
        error: qrRes.ok ? null : (qrData.message ?? `WhatsApp ${qrRes.status}`),
      };
    } catch (e) {
      return {
        configured: true,
        connection: "closed" as const,
        qr: null,
        me: null,
        error: `تعذر الوصول لخدمة واتساب: ${(e as Error).message}`,
      };
    }
  });

/** فصل الرقم المرتبط وإظهار رمز QR جديد. */
export const unlinkWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cfg = evoConfig();
    if (!cfg) return { ok: false, error: "خدمة واتساب غير مُعدّة" };
    try {
      const res = await evoFetch(`/instance/logout/${cfg.instance}`, { method: "DELETE" });
      return { ok: res.ok, error: res.ok ? null : `WhatsApp ${res.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
