import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Building2, Handshake, Users } from "lucide-react";

import heroImage from "@/assets/hero-about.jpg";
import { PageHero } from "@/components/site/PageHero";
import { SiteLayout } from "@/components/site/SiteLayout";
import { whatsappLink } from "@/lib/site-data";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "من نحن | الرشودي للعقارات في بريدة" },
      {
        name: "description",
        content:
          "تعرّف على مؤسسة الرشودي للعقارات: أكثر من 8 سنوات في سوق بريدة، إيجار وبيع وإدارة أملاك بخدمة موثوقة.",
      },
      { property: "og:title", content: "من نحن | الرشودي للعقارات في بريدة" },
      {
        property: "og:description",
        content: "خبرة محلية في عقارات بريدة: إيجار، بيع، إدارة أملاك ومتابعة عقود.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://alrashudi.sa/about" },
    ],
    links: [{ rel: "canonical", href: "https://alrashudi.sa/about" }],
  }),
  component: AboutPage,
});

const stats = [
  { icon: Award, value: "+8", label: "سنوات خبرة في سوق بريدة" },
  { icon: Building2, value: "+500", label: "عقار تم تأجيره أو بيعه" },
  { icon: Users, value: "+300", label: "عميل ومالك يثق بنا" },
  { icon: Handshake, value: "100%", label: "التزام بالعقود والمواعيد" },
];

function AboutPage() {
  return (
    <SiteLayout>
      <PageHero
        image={heroImage}
        eyebrow="مؤسسة الرشودي للعقارات"
        title="من نحن"
        subtitle="خبرة محلية في بريدة، وقرار عقاري أوضح لعملائنا — إيجار وبيع وإدارة أملاك بمعايير مهنية."
        height="lg"
      />

      <section className="mx-auto max-w-4xl px-4 py-14">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <h2 className="border-e-4 border-gold pe-3 text-[19px] font-bold text-foreground">
            نعرف بريدة.. ونفهم العقار
          </h2>
          <div className="mt-5 space-y-4 text-[14px] leading-8 text-muted-foreground">
            <p>
              بدأنا العمل في سوق العقار بمدينة بريدة قبل أكثر من ثماني سنوات، وبنينا خلالها شبكة
              علاقات واسعة مع الملاك والمستأجرين والمستثمرين، ما يجعل معرفتنا بالأحياء والأسعار
              معرفة ميدانية لا نظرية.
            </p>
            <p>
              نقدّم خدمات التأجير والبيع وإدارة الأملاك والوساطة العقارية، ونتابع كل عملية من أول
              معاينة حتى توقيع العقد وتحصيل الدفعات، مع توثيق كل خطوة في نظامنا الداخلي حتى يبقى
              المالك على علم دائم بحالة عقاره.
            </p>
            <p>
              هدفنا بسيط: أن يكون قرارك العقاري مبنيًا على معلومة صحيحة وسعر واقعي وخدمة لا تتوقف
              بعد إتمام الصفقة.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border bg-card p-6 text-center shadow-card"
            >
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                <item.icon className="size-5" />
              </span>
              <p className="mt-3 text-[22px] font-extrabold text-primary">{item.value}</p>
              <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a
            href={whatsappLink(null, "مرحباً، أرغب بالتحدث مع فريق الرشودي للعقارات")}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-primary px-6 py-3 text-[14px] font-bold text-primary-foreground"
          >
            تواصل عبر واتساب
          </a>
          <Link
            to="/contact"
            className="rounded-lg border border-border px-6 py-3 text-[14px] font-bold text-foreground"
          >
            صفحة التواصل
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
