import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/site/SiteLayout";

const BASE = "https://alrashudi.sa";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية | الرشودي للعقارات" },
      {
        name: "description",
        content:
          "سياسة الخصوصية في الرشودي للعقارات: كيف نجمع بيانات زوار الموقع والعملاء ونستخدمها ونحميها.",
      },
      { property: "og:title", content: "سياسة الخصوصية | الرشودي للعقارات" },
      { property: "og:description", content: "كيف نتعامل مع بياناتك في الرشودي للعقارات." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE}/privacy` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${BASE}/privacy` }],
  }),
  component: PrivacyPage,
});

const sections = [
  {
    title: "البيانات التي نجمعها",
    body: "الاسم ورقم الجوال والبريد الإلكتروني والمدينة والحي وتفاصيل الطلب العقاري التي ترسلها عبر نماذج الموقع، إضافة إلى بيانات تصفح عامة مثل نوع الجهاز والصفحات التي زرتها.",
  },
  {
    title: "كيف نستخدم البيانات",
    body: "للتواصل معك بخصوص طلبك، عرض العقارات المناسبة، إعداد العقود والفواتير، وتحسين خدمات الموقع. لا نبيع بياناتك ولا نشاركها لأغراض تسويقية خارجية.",
  },
  {
    title: "ملفات تعريف الارتباط",
    body: "نستخدم ملفات تعريف الارتباط لحفظ تفضيلاتك مثل اللغة والعقارات المفضلة وقبول إشعار الخصوصية. يمكنك حذفها من إعدادات المتصفح في أي وقت.",
  },
  {
    title: "مشاركة البيانات",
    body: "قد نشارك بياناتك مع الجهات الرسمية أو مزوّدي الخدمة الضروريين لتنفيذ العقد (مثل توثيق العقود أو الدفع) وبالحد الأدنى اللازم فقط.",
  },
  {
    title: "حماية البيانات",
    body: "بياناتك محفوظة على خوادم آمنة مع صلاحيات وصول محدودة لموظفي الرشودي للعقارات المعنيين بطلبك.",
  },
  {
    title: "حقوقك",
    body: "يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها بالتواصل معنا عبر صفحة «تواصل معنا» أو الواتساب.",
  },
];

function PrivacyPage() {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-2xl font-extrabold text-foreground md:text-3xl">سياسة الخصوصية</h1>
        <p className="mt-3 text-[13.5px] leading-7 text-muted-foreground">
          توضّح هذه السياسة طريقة تعامل مؤسسة الرشودي للعقارات مع بيانات زوار الموقع وعملائها.
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
