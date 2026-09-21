/**
 * يحوّل أخطاء قاعدة البيانات إلى رسالة عربية واضحة تشرح سبب فشل الحفظ
 * (كود متكرر، حقل مطلوب، صلاحية…) بدل رسالة "تعذّر الحفظ" العامة.
 */
type DbErrorShape = { code?: string; message?: string; details?: string; hint?: string };

const FIELD_LABELS: Record<string, string> = {
  code: "كود العقار",
  unit_number: "رقم الوحدة",
  name: "الاسم",
  email: "البريد الإلكتروني",
  phone: "رقم الجوال",
  username: "اسم المستخدم",
  slug: "الرابط المختصر",
};

function fieldLabelFrom(text: string) {
  for (const key of Object.keys(FIELD_LABELS)) {
    if (new RegExp(`\\b${key}\\b`).test(text)) return FIELD_LABELS[key] as string;
  }
  return null;
}

export function describeDbError(error: unknown, fallback = "تعذّر الحفظ"): string {
  if (!error) return fallback;
  const raw = error as DbErrorShape;
  const text = `${raw.message ?? ""} ${raw.details ?? ""}`.trim();

  switch (raw.code) {
    case "23505": {
      const label = fieldLabelFrom(text) ?? "إحدى القيم";
      return `${label} مستخدم مسبقًا في سجل آخر. غيّر القيمة ثم احفظ مرة أخرى.`;
    }
    case "23503":
      return "هناك ارتباط غير صالح (عمارة أو مالك أو عميل محذوف). راجع الحقول المرتبطة ثم احفظ.";
    case "23502": {
      const label = fieldLabelFrom(text) ?? "أحد الحقول المطلوبة";
      return `${label} مطلوب ولا يمكن تركه فارغًا.`;
    }
    case "23514":
      return `قيمة غير مقبولة في أحد الحقول${text ? ` (${text})` : ""}. راجع القيم المدخلة.`;
    case "22P02":
      return "صيغة إحدى القيم غير صحيحة (رقم أو تاريخ). راجع الحقول الرقمية.";
    case "42501":
      return "ليست لديك صلاحية لحفظ هذا السجل. تواصل مع مدير النظام.";
    default:
      break;
  }

  if (error instanceof Error && error.message) return error.message;
  if (raw.message) return raw.message;
  return fallback;
}
