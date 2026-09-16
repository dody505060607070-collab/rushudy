import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/site/SiteLayout";

const BASE = "https://alrashudi.sa";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "الشروط والأحكام | الرشودي للعقارات" },
      {
        name: "description",
        content:
          "الشروط والأحكام الخاصة باستخدام موقع الرشودي للعقارات وعرض العقارات وطلبات الإيجار والبيع.",
      },
      { property: "og:title", content: "الشروط والأحكام | الرشودي للعقارات" },
      { property: "og:description", content: "شروط استخدام موقع الرشودي للعقارات وخدماته." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE}/terms` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${BASE}/terms` }],
  }),
  component: TermsPage,
});

const sections = [
  {
    title: "استخدام الموقع",
    body: "الموقع مخصص لعرض العقارات وطلبها والتواصل مع مؤسسة الرشودي للعقارات. يُمنع استخدامه لأي غرض مخالف للأنظمة السعودية أو نسخ محتواه تجاريًا دون إذن.",
  },
  {
    title: "دقة بيانات العقار",
    body: "نحرص على تحديث الأسعار والمواصفات باستمرار، وقد تتغير حالة العقار أو سعره قبل تحديث الموقع. يُعتمد ما يرد في العقد الموقّع فقط.",
  },
  {
    title: "الطلبات والحجوزات",
    body: "إرسال طلب عرض أو توفير عقار لا يُعدّ حجزًا أو التزامًا تعاقديًا، ويُعتمد الطلب بعد تأكيد فريق الرشودي للعقارات والاتفاق على الشروط.",
  },
  {
    title: "العقود والمبالغ",
    body: "تُحدَّد قيمة الإيجار أو البيع والعمولة والرسوم في العقد. أي مبالغ تُدفع خارج القنوات الرسمية للمؤسسة لا تتحمل المؤسسة مسؤوليتها.",
  },
  {
    title: "الملكية الفكرية",
    body: "الشعار والصور والنصوص في الموقع ملك لمؤسسة الرشودي للعقارات أو مستخدمة بترخيص، ولا يجوز إعادة نشرها دون إذن كتابي.",
  },
  {
    title: "تعديل الشروط",
    body: "يحق للمؤسسة تحديث هذه الشروط في أي وقت، ويسري التحديث فور نشره على هذه الصفحة.",
  },
];

function TermsPage() {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-2xl font-extrabold text-foreground md:text-3xl">الشروط والأحكام</h1>
        <p className="mt-3 text-[13.5px] leading-7 text-muted-foreground">
          باستخدامك موقع الرشودي للعقارات فإنك توافق على الشروط التالية.
        </p>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-[15px] font-bold text-foreground">{section.title}</h2>
              <p className="mt-2 text-[13.5px] leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </SiteLayout>
  );
}
