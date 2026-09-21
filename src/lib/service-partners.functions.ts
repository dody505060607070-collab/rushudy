import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getServicePartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("service_partners")
      .select("id, code, name, category, description, whatsapp_number, image_key, video_urls, services, is_active")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** بيانات شركة خدمات واحدة بالكود (لصفحة الشركة داخل البوابة). */
export const getServicePartnerByCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: partner, error } = await context.supabase
      .from("service_partners")
      .select("id, code, name, category, description, whatsapp_number, image_key, video_urls, services, is_active")
      .eq("code", data.code)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!partner) throw new Error("الشركة غير موجودة.");
    return partner;
  });

/** تحديث روابط الفيديو الخاصة بشركة خدمات (للموظفين فقط). */
export const updatePartnerVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { partnerId: string; videoUrls: string[] }) => input)
  .handler(async ({ data, context }) => {
    const staff = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff.data) throw new Error("غير مصرّح.");
    const urls = data.videoUrls.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u)).slice(0, 12);
    const db = await admin();
    const result = await db.from("service_partners").update({ video_urls: urls }).eq("id", data.partnerId);
    if (result.error) throw new Error(result.error.message);
    return { ok: true, videoUrls: urls };
  });

export const getMyServiceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [requests, invoices] = await Promise.all([
      context.supabase.from("service_partner_requests").select("*, partner:partner_id(name, code)").order("created_at", { ascending: false }),
      context.supabase.from("service_partner_invoices").select("*, partner:partner_id(name)").order("issued_at", { ascending: false }),
    ]);
    if (requests.error) throw new Error(requests.error.message);
    if (invoices.error) throw new Error(invoices.error.message);
    return { requests: requests.data ?? [], invoices: invoices.data ?? [] };
  });

export const createServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { partnerId: string; contractId?: string; address: string; serviceType: string; details: string; phone: string }) => input)
  .handler(async ({ data, context }) => {
    if (!data.address.trim() || !data.details.trim() || !data.phone.trim()) throw new Error("أكمل العنوان والتفاصيل ورقم الجوال.");
    const db = await admin();
    const account = await db.from("client_accounts").select("contact_id").eq("user_id", context.userId).maybeSingle();
    if (!account.data) throw new Error("هذه الخدمة متاحة لعملاء الرشودي فقط.");
    const contact = await db.from("contacts").select("full_name, national_id").eq("id", account.data.contact_id).single();
    const inserted = await context.supabase.from("service_partner_requests").insert({
      partner_id: data.partnerId,
      requester_user_id: context.userId,
      contact_id: account.data.contact_id,
      contract_id: data.contractId || null,
      customer_name: contact.data?.full_name ?? "عميل الرشودي",
      customer_identity: contact.data?.national_id ?? null,
      customer_phone: data.phone.trim(),
      address: data.address.trim(),
      service_type: data.serviceType.trim(),
      details: data.details.trim(),
    }).select("id, request_number").single();
    if (inserted.error) throw new Error(inserted.error.message);
    return inserted.data;
  });

export const getPartnerWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const partnerId = await context.supabase.rpc("current_service_partner_id");
    if (!partnerId.data) throw new Error("هذا الحساب غير مرتبط بشركة خدمات.");
    const [partner, requests, invoices] = await Promise.all([
      context.supabase.from("service_partners").select("*").eq("id", partnerId.data).single(),
      context.supabase.from("service_partner_requests").select("*").eq("partner_id", partnerId.data).order("created_at", { ascending: false }),
      context.supabase.from("service_partner_invoices").select("*").eq("partner_id", partnerId.data).order("issued_at", { ascending: false }),
    ]);
    if (partner.error) throw new Error(partner.error.message);
    if (requests.error) throw new Error(requests.error.message);
    if (invoices.error) throw new Error(invoices.error.message);
    return { partner: partner.data, requests: requests.data ?? [], invoices: invoices.data ?? [] };
  });

export const updateServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; status: string; notes?: string }) => input)
  .handler(async ({ data, context }) => {
    const allowed = ["new", "accepted", "in_progress", "completed", "cancelled"];
    if (!allowed.includes(data.status)) throw new Error("حالة الطلب غير صحيحة.");
    const result = await context.supabase.from("service_partner_requests").update({ status: data.status, partner_notes: data.notes?.trim() || null }).eq("id", data.requestId);
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const createPartnerInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; amount?: number; description?: string; imagePath?: string }) => input)
  .handler(async ({ data, context }) => {
    const partnerId = await context.supabase.rpc("current_service_partner_id");
    if (!partnerId.data) throw new Error("غير مصرّح.");
    const request = await context.supabase.from("service_partner_requests").select("requester_user_id").eq("id", data.requestId).eq("partner_id", partnerId.data).single();
    if (request.error || !request.data) throw new Error("الطلب غير موجود.");
    const result = await context.supabase.from("service_partner_invoices").insert({
      request_id: data.requestId,
      partner_id: partnerId.data,
      customer_user_id: request.data.requester_user_id,
      amount: data.amount ?? null,
      description: data.description?.trim() || null,
      image_path: data.imagePath || null,
      status: "issued",
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const issueServicePartnerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { partnerId: string; email: string }) => input)
  .handler(async ({ data, context }) => {
    const staff = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff.data) throw new Error("غير مصرّح.");
    const db = await admin();
    const partner = await db.from("service_partners").select("name").eq("id", data.partnerId).single();
    if (!partner.data) throw new Error("الشركة غير موجودة.");
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const password = Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
    const existing = await db.from("service_partner_accounts").select("id, user_id").eq("partner_id", data.partnerId).maybeSingle();
    let userId = existing.data?.user_id;
    if (userId) {
      const updated = await db.auth.admin.updateUserById(userId, { email: data.email, password, email_confirm: true, user_metadata: { full_name: partner.data.name, portal_role: "service_partner" } });
      if (updated.error) throw new Error(updated.error.message);
    } else {
      const created = await db.auth.admin.createUser({ email: data.email, password, email_confirm: true, user_metadata: { full_name: partner.data.name, portal_role: "service_partner" } });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "تعذّر إنشاء الحساب.");
      userId = created.data.user.id;
    }
    const linked = await db.from("service_partner_accounts").upsert({ partner_id: data.partnerId, user_id: userId, login_email: data.email }, { onConflict: "partner_id,user_id" });
    if (linked.error) throw new Error(linked.error.message);
    return { email: data.email, password };
  });
