import { createFileRoute, redirect } from "@tanstack/react-router";

// نظام CRM أصبح هو لوحة التحكم الرئيسية
export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "نظام CRM | الرشودي للعقارات" },
      { name: "description", content: "نظام CRM أصبح جزءًا من لوحة التحكم الرئيسية." },
      { property: "og:title", content: "نظام CRM | الرشودي للعقارات" },
      { property: "og:description", content: "العملاء والفرص والمتابعات ومؤشرات الأداء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
