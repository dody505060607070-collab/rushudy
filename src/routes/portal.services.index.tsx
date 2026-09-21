import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Handshake } from "lucide-react";

import partnerImage from "@/assets/almqrin-services.jpg";
import { Button } from "@/components/ui/button";
import { getMyServiceRequests, getServicePartners } from "@/lib/service-partners.functions";

export const Route = createFileRoute("/portal/services/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "شركاؤنا وخدماتنا | بوابة عميل الرشودي" },
    { name: "description", content: "اطلب خدمات التنظيف ونقل الأثاث والصيانة من شركاء الرشودي وتابع طلبك وفاتورتك." },
    { property: "og:title", content: "شركاؤنا وخدماتنا | بوابة عميل الرشودي" },
    { property: "og:description", content: "خدمات مختارة لعملاء الرشودي من شركات موثوقة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ServicesIndexPage,
});

const statusLabels: Record<string, string> = { new: "جديد", accepted: "مقبول", in_progress: "قيد التنفيذ", completed: "مكتمل", cancelled: "ملغي" };

function ServicesIndexPage() {
  const partners = useQuery({ queryKey: ["service-partners"], queryFn: () => getServicePartners() });
  const activity = useQuery({ queryKey: ["portal-service-requests"], queryFn: () => getMyServiceRequests() });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black">
          <Handshake className="size-6 text-primary" /> شركاؤنا وخدماتنا
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          اضغط على الشركة لعرض صفحتها كاملة: الخدمات، رقم التواصل، الفيديوهات، وطلب الخدمة.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {partners.data?.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <Link to="/portal/services/$partnerCode" params={{ partnerCode: item.code }} className="block">
              <img
                src={partnerImage}
                alt={item.name}
                width={1200}
                height={912}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
            </Link>
            <div className="p-5">
              <p className="text-xs font-bold text-primary">{item.category}</p>
              <h2 className="mt-1 text-lg font-black">{item.name}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.services.map((s) => (
                  <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs">{s}</span>
                ))}
              </div>
              <Button asChild className="mt-5 w-full">
                <Link to="/portal/services/$partnerCode" params={{ partnerCode: item.code }}>
                  عرض الشركة وطلب الخدمة <ArrowLeft className="size-4" />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>

      <section>
        <h2 className="text-base font-bold">طلباتي السابقة</h2>
        <div className="mt-3 space-y-2">
          {activity.data?.requests.map((r) => (
            <article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div>
                <p className="font-bold">{r.request_number} — {r.partner?.name}</p>
                <p className="text-xs text-muted-foreground">{r.service_type} • {r.address}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {statusLabels[r.status] ?? r.status}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
