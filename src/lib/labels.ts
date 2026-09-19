export const requestStatusLabels: Record<string, string> = {
  new: "جديد",
  in_review: "قيد المراجعة",
  contacted: "تم التواصل",
  approved: "معتمد",
  rejected: "مرفوض",
  converted: "تم التحويل",
  closed: "مغلق",
};

export const reservationStatusLabels: Record<string, string> = {
  hold: "حجز مؤقت",
  active: "حجز نشط",
  expired: "منتهي",
  cancelled: "ملغي",
  converted: "تحوّل لعقد",
};

export const contractStatusLabels: Record<string, string> = {
  draft: "مسودة",
  active: "ساري",
  expired: "منتهي",
  terminated: "منهي",
  renewed: "مُجدّد",
};

export const invoiceStatusLabels: Record<string, string> = {
  draft: "مسودة",
  unpaid: "غير مدفوعة",
  partial: "مدفوعة جزئيًا",
  paid: "مدفوعة",
  overdue: "متأخرة",
  cancelled: "ملغاة",
};

export const paymentStatusLabels: Record<string, string> = {
  unpaid: "غير محصّلة",
  partial: "محصّلة جزئيًا",
  paid: "محصّلة",
  overdue: "متأخرة",
};

export const taskStatusLabels: Record<string, string> = {
  new: "جديدة",
  in_progress: "قيد التنفيذ",
  submitted: "بانتظار الاعتماد",
  approved: "معتمدة",
  rejected: "مرفوضة",
  done: "منجزة",
  cancelled: "ملغاة",
};

export const priorityLabels: Record<string, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};

export const followupStatusLabels: Record<string, string> = {
  pending: "بالانتظار",
  sent: "أُرسل",
  failed: "فشل الإرسال",
  stopped: "موقوف",
  done: "منتهٍ",
};

export const importStatusLabels: Record<string, string> = {
  pending: "بانتظار المراجعة",
  processing: "قيد الاستخراج",
  needs_review: "يحتاج تدقيق",
  approved: "معتمد",
  rejected: "مرفوض",
  failed: "فشل",
  duplicate: "مكرر",
};

export const stageLabels: Record<string, string> = {
  new: "جديد",
  qualified: "مؤهل",
  viewing: "معاينة",
  negotiation: "تفاوض",
  contract: "تعاقد",
  won: "ناجحة",
  lost: "خاسرة",
};

export const contactRoleLabels: Record<string, string> = {
  owner: "مالك",
  tenant: "مستأجر",
  buyer: "مشتري",
  broker: "وسيط عقد",
  lead: "عميل",
};
