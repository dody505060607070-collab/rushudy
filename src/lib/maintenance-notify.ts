export const MAINTENANCE_CATEGORIES: Record<string, string> = {
  plumbing: "سباكة",
  electrical: "كهرباء",
  ac: "تكييف",
  elevator: "مصعد",
  cleaning: "نظافة",
  structure: "إنشائي",
  general: "عام",
  owner: "طلب مالك",
  other: "أخرى",
};

export const MAINTENANCE_PRIORITIES: Record<string, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "طارئة",
};

export type MaintenanceNotice = {
  reporterName: string | null;
  reporterPhone: string | null;
  category: string | null;
  priority: string | null;
  description: string | null;
  place: string | null;
  unitNumber: string | null;
};

/** نص رسالة واتساب التي تصل للمكتب وموظف الصيانة عند بلاغ جديد. */
export function buildMaintenanceMessage(n: MaintenanceNotice): string {
  const lines = [
    "🔧 بلاغ صيانة جديد",
    `من: ${n.reporterName?.trim() || "غير معروف"}`,
    n.reporterPhone ? `الجوال: ${n.reporterPhone}` : null,
    n.place || n.unitNumber
      ? `المكان: ${[n.place, n.unitNumber ? `وحدة ${n.unitNumber}` : null].filter(Boolean).join(" — ")}`
      : null,
    `النوع: ${MAINTENANCE_CATEGORIES[n.category ?? ""] ?? n.category ?? "أخرى"}`,
    `الأولوية: ${MAINTENANCE_PRIORITIES[n.priority ?? ""] ?? "عادية"}`,
    `الوصف: ${(n.description ?? "").trim() || "—"}`,
    "",
    "تابع البلاغ من صفحة الصيانة في النظام.",
  ];
  return lines.filter((l) => l !== null).join("\n");
}
