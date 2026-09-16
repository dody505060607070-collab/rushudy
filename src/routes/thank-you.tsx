import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Home, MessageCircle, Phone } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { COMPANY_PHONE, whatsappLink } from "@/lib/site-data";

const BASE = "https://alrashudi.sa";

export const Route = createFileRoute("/thank-you")({
  head: () => ({
    meta: [
      { title: "تم استلام طلبك | الرشودي للعقارات" },
      {
        name: "description",
        content: "شكرًا لتواصلك مع الرشودي للعقارات، سنعاود الاتصال بك خلال ساعات العمل.",
      },
      { property: "og:title", content: "تم استلام طلبك | الرشودي للعقارات" },
      { property: "og:description", content: "سنتواصل معك قريبًا بخصوص طلبك العقاري." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE}/thank-you` },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThankYouPage,
});

function ThankYouPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto size-16 text-primary" />
        <h1 className="mt-5 text-2xl font-extrabold text-foreground md:text-3xl">
          تم استلام طلبك بنجاح
        </h1>
        <p className="mt-3 text-[14px] leading-7 text-muted-foreground">
          شكرًا لثقتك بالرشودي للعقارات. وصل طلبك لفريقنا، وسنتواصل معك خلال ساعات العمل
          (السبت — الخميس 9ص — 10م).
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={whatsappLink(undefined, "مرحبًا، أرسلت طلبًا عبر الموقع وأود المتابعة.")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-[13.5px] font-bold text-primary-foreground"
          >
            <MessageCircle className="size-4" />
            متابعة عبر واتساب
          </a>
          <a
            href={`tel:${COMPANY_PHONE}`}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-[13.5px] font-bold text-foreground"
          >
            <Phone className="size-4" />
            اتصال مباشر
          </a>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-[13.5px] font-bold text-foreground"
          >
            <Home className="size-4" />
            العودة للرئيسية
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
