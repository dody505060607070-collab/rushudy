import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reserve")({
  head: () => ({
    meta: [
      { title: "حجز عقار | الرشودي للعقارات" },
      { name: "description", content: "إنشاء حجز عقاري جديد للموظفين." },
      { property: "og:title", content: "حجز عقار | الرشودي للعقارات" },
      { property: "og:description", content: "إنشاء حجز عقاري جديد للموظفين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReserveRedirect,
});

function ReserveRedirect() {
  return <Navigate to="/rent" replace />;
}