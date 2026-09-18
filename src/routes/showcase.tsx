import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { coverImage, publicPropertiesQuery, purposeLabels } from "@/lib/site-data";

const TITLE = "شاشة عرض العقارات | الرشودي للعقارات";
const DESC = "وضع العرض داخل المكتب: شاشة متجددة تلقائيًا تستعرض أحدث عقارات الرشودي بدون أي بيانات داخلية.";

export const Route = createFileRoute("/showcase")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ShowcasePage,
});

function ShowcasePage() {
  const { data = [] } = useQuery(publicPropertiesQuery(undefined, 30));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (data.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % data.length), 9000);
    return () => clearInterval(timer);
  }, [data.length]);

  const property = data[index];
  const cover = property ? coverImage(property) : null;
  const price =
    property?.price_text ??
    (property?.price_value ? `${property.price_value.toLocaleString("ar-SA")} ريال` : "السعر عند الطلب");

  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {cover ? (
        <img src={cover} alt={property?.name ?? ""} className="absolute inset-0 size-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />

      <section className="relative z-10 flex min-h-screen flex-col justify-between p-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black">الرشودي للعقارات</h1>
            <p className="mt-1 text-base text-muted-foreground">أحدث العقارات المتاحة الآن</p>
          </div>
          <div className="rounded-xl border border-border bg-card/80 px-5 py-3 text-center backdrop-blur">
            <div className="text-2xl font-bold">{data.length}</div>
            <div className="text-[13px] text-muted-foreground">عقار معروض</div>
          </div>
        </header>

        {property ? (
          <div className="max-w-3xl space-y-4 rounded-3xl border border-border bg-card/85 p-8 backdrop-blur">
            <span className="inline-flex rounded-lg border border-border bg-background px-3 py-1 text-sm font-semibold">
              {purposeLabels[property.purpose] ?? property.purpose}
            </span>
            <h2 className="text-4xl font-black leading-tight">{property.name}</h2>
            <p className="text-lg text-muted-foreground">
              {[property.district, property.city].filter(Boolean).join(" — ") || "المملكة العربية السعودية"}
            </p>
            <div className="text-3xl font-bold text-primary">{price}</div>
            <p className="text-base text-muted-foreground">
              للاستفسار تواصل مع موظف الاستقبال، أو امسح كود العقار: {property.code}
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card/85 p-8 text-lg backdrop-blur">
            لا توجد عقارات معروضة حاليًا.
          </div>
        )}

        <footer className="flex items-center gap-2">
          {data.map((item, i) => (
            <span
              key={item.id}
              className={
                i === index
                  ? "h-1.5 w-10 rounded-full bg-primary"
                  : "h-1.5 w-5 rounded-full bg-muted-foreground/40"
              }
            />
          ))}
        </footer>
      </section>
    </main>
  );
}
