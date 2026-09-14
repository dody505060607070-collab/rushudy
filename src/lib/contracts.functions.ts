import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Extraction = Record<string, unknown>;

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
};

function addCycle(base: Date, cycle: string, i: number) {
  const d = new Date(base);
  if (cycle === "monthly") d.setMonth(d.getMonth() + i);
  else if (cycle === "quarterly") d.setMonth(d.getMonth() + i * 3);
  else if (cycle === "semiannual") d.setMonth(d.getMonth() + i * 6);
  else d.setFullYear(d.getFullYear() + i);
  return d.toISOString().slice(0, 10);
}

/**
 * الترحيل الكامل لعقد مستورد من PDF:
 * ينشئ/يربط المالك والمستأجر والوسيط والعقار والعقد وجدول الدفعات والفواتير
 * وحساب بوابة العميل، ويسجّل الاستثناءات للمراجعة.
 */
export const finalizeContractImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { extraction: Extraction; filePath?: string | undefined; importId?: string | undefined }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { requireUnlocked } = await import("./kill-switch.server");
    await requireUnlocked();
    const staff = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff.data) throw new Error("غير مصرّح.");

    const db = context.supabase;
    const e = data.extraction ?? {};
    const warnings: string[] = Array.isArray(e["warnings"]) ? (e["warnings"] as string[]).map(String) : [];
    const created: string[] = [];

    /** يطابق الشخص بالهوية ثم الجوال ثم الاسم — الشخص الواحد يبقى سجلًا واحدًا مهما تعددت عقوده. */
    const findOrCreateContact = async (
      name: string,
      role: string,
      nationalId?: string,
      phone?: string,
      kind: "individual" | "organization" = "individual",
    ) => {
      const nid = str(nationalId).replace(/\D/g, "");
      const tel = str(phone).replace(/\s/g, "");
      if (!name && !nid) return null;

      type Found = { id: string; roles: string[] | null };
      let existing: Found | null = null;
      if (nid) {
        // الهوية/السجل التجاري معرّف قاطع: لا نطابق بالجوال أو الاسم عند وجودها
        // حتى لا تختلط المنشأة بممثلها أو المالك بالمستأجر.
        const byId = await db.from("contacts").select("id, roles").eq("national_id", nid).limit(1);
        existing = (byId.data?.[0] as Found | undefined) ?? null;
      } else {
        if (tel) {
          const byPhone = await db.from("contacts").select("id, roles").eq("phone", tel).limit(1);
          existing = (byPhone.data?.[0] as Found | undefined) ?? null;
        }
        if (!existing && name) {
          const byName = await db.from("contacts").select("id, roles").ilike("full_name", name).limit(1);
          existing = (byName.data?.[0] as Found | undefined) ?? null;
        }
      }

      if (existing) {
        const patch: { national_id?: string; phone?: string; roles?: string[]; full_name?: string } = {};
        if (nid) patch.national_id = nid;
        if (tel) patch.phone = tel;
        const roles = existing.roles ?? [];
        if (!roles.includes(role)) patch.roles = [...roles, role];
        if (Object.keys(patch).length) await db.from("contacts").update(patch).eq("id", existing.id);
        return existing.id;
      }


      const ins = await db
        .from("contacts")
        .insert({
          full_name: name || nid,
          kind,
          roles: [role],
          national_id: nid || null,
          phone: tel || null,
          source: "pdf_import",
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (ins.error) {
        warnings.push(`تعذّر إنشاء جهة الاتصال «${name}»: ${ins.error.message}`);
        return null;
      }
      created.push(`جهة اتصال: ${name}`);
      return ins.data.id;
    };

    const ownerName = str(e["owner_name"]);
    const tenantName = str(e["tenant_name"]);
    const brokerName = str(e["broker_name"]) || str(e["broker_entity_name"]);
    const tenantIsCompany =
      e["tenant_is_company"] === true || !!str(e["tenant_cr_number"]);
    const repName = str(e["tenant_rep_name"]);
    const repPhone = str(e["tenant_rep_phone"]);
    const repNid = str(e["tenant_rep_national_id"]);
    const ownerId = await findOrCreateContact(
      ownerName,
      "owner",
      str(e["owner_national_id"]),
      str(e["owner_phone"]),
    );
    // المستأجر التجاري: المنشأة هي الطرف، وسجلها التجاري هو معرّفها، وجوال ممثلها للتواصل.
    const tenantId = await findOrCreateContact(
      tenantName,
      "tenant",
      tenantIsCompany
        ? str(e["tenant_cr_number"]) || str(e["tenant_national_id"])
        : str(e["tenant_national_id"]),
      str(e["tenant_phone"]) || repPhone,
      tenantIsCompany ? "organization" : "individual",
    );
    if (tenantIsCompany && repName) {
      await findOrCreateContact(repName, "tenant_representative", repNid, repPhone);
      warnings.push(
        `المستأجر منشأة تجارية «${tenantName}» — ممثلها النظامي: ${repName}${repNid ? ` (هوية ${repNid})` : ""}.`,
      );
    }
    const brokerId = await findOrCreateContact(brokerName, "broker", "", str(e["broker_phone"]));
    if (!ownerName) warnings.push("لم يُستخرج اسم المالك من الملف.");
    if (!tenantName) warnings.push("لم يُستخرج اسم المستأجر من الملف.");

    // العقار
    const propertyName =
      str(e["property_name"]) ||
      [str(e["property_type"]), str(e["district"])].filter(Boolean).join(" — ") ||
      (str(e["unit_number"]) ? `وحدة ${str(e["unit_number"])}` : "");
    let propertyId: string | null = null;
    if (propertyName) {
      // البحث مقيّد بمالك العقد — حتى لا يُربط العقد بعقار مالك آخر يحمل اسمًا مشابهًا.
      let query = db.from("properties").select("id").ilike("name", propertyName).limit(1);
      query = ownerId ? query.eq("owner_id", ownerId) : query.is("owner_id", null);
      const found = await query;
      if (found.data?.[0]) propertyId = found.data[0].id;
      else {
        const code = `P-${Date.now().toString(36).toUpperCase()}`;
        const ins = await db
          .from("properties")
          .insert({
            code,
            name: propertyName,
            purpose: str(e["contract_type"]) === "sale" ? "sale" : "rent",
            city: str(e["city"]) || null,
            district: str(e["district"]) || null,
            property_type: str(e["property_type"]) || null,
            owner_id: ownerId,
            is_visible: false,
            needs_review: true,
            status: "reserved",
            internal_notes: "أُنشئ تلقائيًا من استيراد عقد PDF — يحتاج مراجعة.",
            created_by: context.userId,
          })
          .select("id")
          .single();
        if (ins.error) warnings.push(`تعذّر إنشاء العقار: ${ins.error.message}`);
        else {
          propertyId = ins.data.id;
          created.push(`عقار: ${propertyName}`);
        }
      }
    } else {
      warnings.push("لم يُستخرج اسم العقار — رُبط العقد بدون عقار.");
    }

    // الوحدات المذكورة في العقد
    const rawUnits = Array.isArray(e["units"]) ? (e["units"] as Record<string, unknown>[]) : [];
    const unitList = rawUnits
      .map((u) => ({
        unit_number: str(u["unit_number"]),
        unit_type: str(u["unit_type"]),
        floor: str(u["floor"]),
        area: num(u["area"]),
      }))
      .filter((u) => u.unit_number || u.unit_type);
    if (!unitList.length && str(e["unit_number"])) {
      for (const n of str(e["unit_number"]).split(/[،,]/).map((s) => s.trim()).filter(Boolean)) {
        unitList.push({ unit_number: n, unit_type: str(e["property_type"]), floor: "", area: null });
      }
    }
    let primaryUnitId: string | null = null;
    for (const u of unitList) {
      const label = u.unit_number || u.unit_type;
      let unitId: string | null = null;
      const found = await db
        .from("units")
        .select("id")
        .eq("owner_id", ownerId ?? "")
        .eq("unit_number", label)
        .limit(1);
      if (found.data?.[0]) unitId = found.data[0].id;
      else {
        const ins = await db
          .from("units")
          .insert({
            owner_id: ownerId,
            unit_number: label,
            unit_type: u.unit_type || null,
            floor: u.floor || null,
            area: u.area,
            status: "rented",
            is_rentable: true,
            notes: "أُنشئت تلقائيًا من استيراد عقد PDF.",
          })
          .select("id")
          .single();
        if (ins.error) warnings.push(`تعذّر إنشاء الوحدة «${label}»: ${ins.error.message}`);
        else {
          unitId = ins.data.id;
          created.push(`وحدة: ${label}`);
        }
      }
      if (unitId && !primaryUnitId) primaryUnitId = unitId;
    }
    if (primaryUnitId && propertyId) {
      await db.from("properties").update({ unit_id: primaryUnitId }).eq("id", propertyId);
    }


    // العقد
    const isSale = str(e["contract_type"]) === "sale";
    const annual = num(e["annual_rent"]);
    const total = num(e["total_value"]) ?? annual;
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(str(e["start_date"])) ? str(e["start_date"]) : null;
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(str(e["end_date"])) ? str(e["end_date"]) : null;
    if (!startDate) warnings.push("تاريخ بداية العقد غير واضح في الملف.");
    const cycleRaw = str(e["payment_cycle"]).toLowerCase();
    const cycle = cycleRaw.includes("شهر") || cycleRaw.includes("month")
      ? "monthly"
      : cycleRaw.includes("ربع") || cycleRaw.includes("quarter")
        ? "quarterly"
        : cycleRaw.includes("نصف") || cycleRaw.includes("semi")
          ? "semiannual"
          : "annual";
    // جدول الدفعات المنصوص عليه في البند ١٢ إن وُجد
    const rawRows = Array.isArray(e["payments"]) ? (e["payments"] as Record<string, unknown>[]) : [];
    const scheduleRows = rawRows
      .filter((r) => r && typeof r === "object")
      .map((r) => ({
        due: /^\d{4}-\d{2}-\d{2}$/.test(str(r["due_date"])) ? str(r["due_date"]) : null,
        amount:
          num(r["total"]) ??
          (num(r["rent"]) ?? 0) + (num(r["vat"]) ?? 0) + (num(r["services"]) ?? 0),
      }))
      .filter((r) => r.due || r.amount);
    const declaredCount = Number(num(e["payments_count"]) ?? 0);
    const paymentsCount = Math.min(
      Math.max(scheduleRows.length || declaredCount || 1, 1),
      60,
    );
    if (declaredCount && scheduleRows.length && declaredCount !== scheduleRows.length) {
      warnings.push(
        `عدد الدفعات المذكور (${declaredCount}) يخالف صفوف جدول السداد (${scheduleRows.length}) — اعتُمد الجدول.`,
      );
    }

    // منع تكرار رقم العقد لنفس النوع
    const contractType = isSale ? "sale" : "rent";
    let contractNumber = str(e["contract_number"]) || `C-${Date.now().toString(36).toUpperCase()}`;
    const baseNumber = contractNumber;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const dup = await db
        .from("contracts")
        .select("id")
        .eq("contract_number", contractNumber)
        .eq("contract_type", contractType)
        .limit(1);
      if (!dup.data?.length) break;
      const suffix = `-${(attempt + 2).toString()}-${Math.random().toString(36).toUpperCase().slice(2, 6)}`;
      contractNumber = `${baseNumber}${suffix}`;
    }
    if (contractNumber !== baseNumber) {
      warnings.push(
        `رقم العقد ${baseNumber} مسجَّل مسبقًا — تم حفظ نسخة جديدة برقم ${contractNumber} (عقد مستقل لنفس الشخص).`,
      );
    }

    const contractIns = await db
      .from("contracts")
      .insert({
        contract_number: contractNumber,
        contract_type: contractType,
        owner_id: ownerId,
        tenant_id: tenantId,
        broker_id: brokerId,
        property_id: propertyId,
        unit_id: primaryUnitId,

        start_date: startDate,
        end_date: endDate,
        signed_date: /^\d{4}-\d{2}-\d{2}$/.test(str(e["signed_date"])) ? str(e["signed_date"]) : null,
        annual_rent: annual,
        total_value: total,
        deposit: num(e["deposit"]),
        fees: num(e["fees"]),
        payment_cycle: cycle,
        payments_count: paymentsCount,
        special_terms: str(e["special_terms"]) || null,
        status: "active",
        source: "pdf_import",
        file_path: data.filePath ?? null,
        created_by: context.userId,
      })
      .select("id, contract_number")
      .single();
    if (contractIns.error) throw new Error(`تعذّر إنشاء العقد: ${contractIns.error.message}`);
    const contractId = contractIns.data.id;
    created.push(`عقد: ${contractIns.data.contract_number}`);

    // جدول الدفعات
    const base = startDate ? new Date(startDate) : new Date();
    const amountEach = total ? Math.round((total / paymentsCount) * 100) / 100 : 0;
    if (!amountEach && !scheduleRows.length)
      warnings.push("قيمة العقد غير واضحة — أُنشئت الدفعات بقيمة صفر للمراجعة.");
    const payments = Array.from({ length: paymentsCount }, (_, i) => {
      const row = scheduleRows[i];
      return {
        contract_id: contractId,
        payment_number: i + 1,
        due_date: row?.due ?? addCycle(base, cycle, i),
        amount_due: row?.amount ?? amountEach,
        amount_paid: 0,
        status: "active",
        is_derived: !row,
      };
    });
    const payIns = await db.from("contract_payments").insert(payments).select("id, due_date, amount_due, payment_number");
    if (payIns.error) warnings.push(`تعذّر إنشاء جدول الدفعات: ${payIns.error.message}`);
    else created.push(`${payIns.data.length} دفعة مجدولة`);

    // الفواتير لكل دفعة
    let invoicesCreated = 0;
    for (const p of payIns.data ?? []) {
      const invoiceNumber = `INV-${contractIns.data.contract_number}-${p.payment_number}`;
      const inv = await db
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          contact_id: tenantId,
          contract_id: contractId,
          issue_date: p.due_date,
          due_date: p.due_date,
          status: "unpaid",
          subtotal: p.amount_due,
          vat_amount: 0,
          total: p.amount_due,
          notes: "أُنشئت تلقائيًا من استيراد العقد",
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (inv.error) {
        warnings.push(`تعذّر إنشاء الفاتورة ${invoiceNumber}: ${inv.error.message}`);
        continue;
      }
      invoicesCreated += 1;
      await db.from("invoice_items").insert({
        invoice_id: inv.data.id,
        description: `دفعة رقم ${p.payment_number} — عقد ${contractIns.data.contract_number}`,
        quantity: 1,
        unit_price: p.amount_due,
        total: p.amount_due,
        sort_order: 1,
      });
    }
    if (invoicesCreated) created.push(`${invoicesCreated} فاتورة`);

    // تذكير أول دفعة
    const firstPayment = (payIns.data ?? []).sort((a, b) => a.payment_number - b.payment_number)[0];
    let tenantPhone = "";
    if (tenantId) {
      const c = await db.from("contacts").select("phone, whatsapp, national_id").eq("id", tenantId).single();
      tenantPhone = c.data?.whatsapp ?? c.data?.phone ?? "";
      if (!c.data?.national_id) warnings.push("لا يوجد رقم هوية للمستأجر — لن يُفعّل حساب البوابة قبل إضافته.");
      if (!tenantPhone) warnings.push("لا يوجد رقم جوال للمستأجر — لن تُرسل التذكيرات.");
    }
    if (firstPayment && tenantPhone && tenantId) {
      const body = `تحية طيبة ${tenantName}،\nنذكّركم بموعد سداد الدفعة رقم ${firstPayment.payment_number} بقيمة ${firstPayment.amount_due} ريال بتاريخ ${firstPayment.due_date} عن العقد ${contractIns.data.contract_number}.\nالرشودي للعقارات`;
      await db.from("reminder_followups").insert({
        contract_id: contractId,
        payment_id: null,
        recipient_contact_id: tenantId,
        recipient_name: tenantName,
        recipient_phone: tenantPhone,
        message_body: body,
        repeat_interval: "monthly",
        status: "pending",
        next_send_at: new Date(firstPayment.due_date).toISOString(),
        created_by: context.userId,
      });
      created.push("تذكير سداد مجدول");
    }

    // حسابا بوابة المالك والمستأجر
    let account: { username: string; password: string } | null = null;
    const portalContacts = [ownerId, tenantId].filter(
      (contactId, index, all): contactId is string => Boolean(contactId) && all.indexOf(contactId) === index,
    );
    for (const contactId of portalContacts) {
      try {
        const { ensureClientAccountForContact } = await import("./client-account.server");
        const result = await ensureClientAccountForContact(contactId);
        if (result.ok) {
          if (contactId === ownerId || !account) account = { username: result.username, password: result.password };
          if (result.created) created.push(contactId === ownerId ? "حساب بوابة المالك" : "حساب بوابة المستأجر");
        } else {
          warnings.push(`${contactId === ownerId ? "المالك" : "المستأجر"}: ${result.reason}`);
        }
      } catch (err) {
        warnings.push(`تعذّر إنشاء حساب ${contactId === ownerId ? "المالك" : "المستأجر"}: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
      }
    }

    if (data.importId) {
      await db
        .from("contract_imports")
        .update({
          status: warnings.length ? "needs_review" : "approved",
          contract_id: contractId,
          warnings: warnings as never,
          approved_by: context.userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", data.importId);
    } else {
      // نحفظ نسخة كاملة من البيانات المستخرجة حتى تظهر كل تفاصيل العقد في صفحته.
      await db.from("contract_imports").insert({
        file_path: data.filePath ?? "",
        file_name: (data.filePath ?? "contract.pdf").split("/").pop() ?? "contract.pdf",
        status: warnings.length ? "needs_review" : "approved",
        extraction: e as never,
        warnings: warnings as never,
        contract_id: contractId,
        uploaded_by: context.userId,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      });
    }


    await db.from("activity_log").insert({
      actor_id: context.userId,
      action: "contract_import_finalized",
      entity_type: "contract",
      entity_id: contractId,
      details: { created, warnings } as never,
    });

    const { dispatchAutomation } = await import("./automation.server");
    await dispatchAutomation("contract.created", {
      contractId,
      created,
      warnings,
      contractNumber: str(e["contract_number"]) || null,
      ownerName: str(e["owner_name"]) || null,
      tenantName: str(e["tenant_name"]) || null,
    });

    return { contractId, created, warnings, account };
  });
