import {
  Home,
  Building2,
  Factory,
  CircleCheck,
  Settings,
  ShieldCheck,
  Users,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  /** مفتاح العدّاد القادم من قاعدة البيانات */
  countKey?: string;
  /** القسم المطلوب لعرض العنصر */
  module?: string;
};

export type NavGroup = {
  label?: string;
  icon?: LucideIcon;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    icon: Home,
    items: [
      { label: "لوحة التحكم", to: "/dashboard" },
      { label: "المساعد الذكي", to: "/ai" },
    ],
  },
  {
    label: "إدارة العقارات",
    icon: Factory,
    items: [
      { label: "العقارات", to: "/properties", countKey: "properties", module: "properties" },
      { label: "العمارات", to: "/buildings", module: "properties" },
      { label: "طلبات توفير العقار", to: "/supply-requests", countKey: "supplyRequests", module: "requests" },
      { label: "طلبات عرض العقار", to: "/listing-requests", countKey: "listingRequests", module: "requests" },
      { label: "إدارة الحجوزات", to: "/reservations", countKey: "reservations", module: "reservations" },
    ],
  },
  {
    label: "إدارة الإيجارات",
    icon: Building2,
    items: [
      { label: "الملاك", to: "/owners", countKey: "owners", module: "owners" },
      { label: "إدارة العقود", to: "/contracts", countKey: "contracts", module: "contracts" },
      { label: "تنبيهات التجديد", to: "/renewals", module: "contracts" },
      { label: "الفواتير", to: "/invoices", countKey: "invoices", module: "invoices" },
      { label: "إدارة التذكيرات", to: "/reminders", countKey: "followups", module: "reminders" },
    ],
  },
  {
    label: "المهام",
    icon: CircleCheck,
    items: [{ label: "كل المهام", to: "/tasks", countKey: "tasks", module: "tasks" }],
  },
  {
    label: "CRM",
    icon: Users,
    items: [
      { label: "نظام CRM", to: "/crm", module: "crm" },
      { label: "العملاء", to: "/clients", countKey: "contacts", module: "contacts" },
      { label: "الفرص", to: "/opportunities", countKey: "opportunities", module: "crm" },
      { label: "عروض الأسعار", to: "/price-offers", module: "crm" },
      { label: "المتابعات والأنشطة", to: "/activities", module: "crm" },
      { label: "شات الموظفين", to: "/team-chat", module: "chat" },
      { label: "التقارير", to: "/reports", module: "crm" },
      { label: "التقرير التنفيذي", to: "/executive-report", module: "crm" },
      { label: "التقييم والعائد", to: "/valuation", module: "crm" },
    ],
  },
  {
    label: "التسويق العقاري",
    icon: Megaphone,
    items: [{ label: "المسوقون والإحالات", to: "/marketing", module: "marketing" }],
  },

  {
    label: "إعدادات الموقع",
    icon: Settings,
    items: [
      { label: "إعدادات الموقع", to: "/settings", module: "settings" },
      { label: "الشركاء", to: "/partners", module: "settings" },
      { label: "الخدمات", to: "/services", module: "settings" },
      { label: "ربط واتساب", to: "/whatsapp-link", module: "settings" },
    ],
  },
  {
    label: "الإدارة",
    icon: ShieldCheck,
    items: [
      { label: "الموظفون", to: "/employees", module: "employees" },
      { label: "الأدوار والصلاحيات", to: "/roles", module: "employees" },
      { label: "سجل الأنشطة", to: "/activity-log", module: "logs" },
      { label: "سجل الأخطاء", to: "/error-log", module: "logs" },
      { label: "النسخ الاحتياطي", to: "/backup", module: "logs" },
    ],
  },
];

/** كل الأقسام والإجراءات المتاحة للصلاحيات */
export const permissionModules: { key: string; label: string; actions: string[] }[] = [
  { key: "properties", label: "العقارات", actions: ["view", "add", "edit", "delete"] },
  { key: "requests", label: "الطلبات", actions: ["view", "edit"] },
  { key: "reservations", label: "الحجوزات", actions: ["view", "book", "delete"] },
  { key: "owners", label: "الملاك والوحدات", actions: ["view", "edit"] },
  { key: "contracts", label: "العقود", actions: ["view", "add", "edit", "delete", "approve"] },
  { key: "payments", label: "التحصيل", actions: ["collect"] },
  { key: "invoices", label: "الفواتير", actions: ["view", "edit", "export"] },
  { key: "reminders", label: "التذكيرات", actions: ["view", "edit", "send"] },
  { key: "tasks", label: "المهام", actions: ["view", "add", "edit", "delete", "approve"] },
  { key: "contacts", label: "العملاء", actions: ["view", "add", "edit", "delete"] },
  { key: "crm", label: "CRM", actions: ["view", "edit"] },
  { key: "marketing", label: "التسويق العقاري", actions: ["view", "add", "edit", "delete", "send", "approve"] },
  { key: "chat", label: "المحادثات الداخلية", actions: ["view"] },
  { key: "settings", label: "الإعدادات", actions: ["view", "edit"] },
  { key: "employees", label: "الموظفون", actions: ["view", "manage"] },
  { key: "logs", label: "السجلات", actions: ["view"] },
];

export const actionLabels: Record<string, string> = {
  view: "عرض",
  add: "إضافة",
  edit: "تعديل",
  delete: "حذف / أرشفة",
  approve: "اعتماد",
  export: "تصدير",
  collect: "تحصيل",
  send: "إرسال يدوي",
  book: "حجز وتمديد",
  manage: "إدارة موظفين",
};
