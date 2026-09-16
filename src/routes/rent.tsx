import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import heroImage from "@/assets/hero-rent.jpg";
import heroVideo from "@/assets/video-rent.mp4.asset.json";
import { PageHero } from "@/components/site/PageHero";
import { PropertyGrid } from "@/components/site/PropertyCard";
import { PropertyMapSection } from "@/components/site/PropertyMapSection";
import { Reveal } from "@/components/site/Reveal";
import { SiteLayout } from "@/components/site/SiteLayout";
import { publicPropertiesQuery } from "@/lib/site-data";

export const Route = createFileRoute("/rent")({
  head: () => ({
    meta: [
      { title: "عقارات للإيجار في بريدة | الرشودي للعقارات" },
      {
        name: "description",
        content: "شقق وفلل ومكاتب ومعارض للإيجار في بريدة مع أسعار محدثة وتواصل مباشر عبر واتساب.",
      },
      { property: "og:title", content: "عقارات للإيجار في بريدة | الرشودي للعقارات" },
      {
        property: "og:description",
        content: "تصفّح وحدات الإيجار المتاحة في أحياء بريدة واختر ما يناسبك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://alrashudi.sa/rent" },
    ],
    links: [{ rel: "canonical", href: "https://alrashudi.sa/rent" }],
  }),
  component: RentPage,
});

function RentPage() {
  const { data, isLoading, error } = useQuery(publicPropertiesQuery("rent", 200));
  const [district, setDistrict] = useState("");
  const [type, setType] = useState("");
  const [term, setTerm] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("featured");

  const districts = useMemo(
    () => [...new Set((data ?? []).map((p) => p.district).filter(Boolean))] as string[],
    [data],
  );
  const types = useMemo(
    () => [...new Set((data ?? []).map((p) => p.property_type).filter(Boolean))] as string[],
    [data],
  );

  const filtered = useMemo(() => {
    const q = term.trim();
    const cap = Number(maxPrice) || 0;
    const list = (data ?? []).filter(
      (p) =>
        (!district || p.district === district) &&
        (!type || p.property_type === type) &&
        (!q || `${p.name} ${p.code} ${p.district ?? ""}`.includes(q)) &&
        (!cap || (p.price_value ?? 0) <= cap),
    );
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => (a.price_value ?? 0) - (b.price_value ?? 0));
    if (sort === "price-desc") sorted.sort((a, b) => (b.price_value ?? 0) - (a.price_value ?? 0));
    if (sort === "featured") sorted.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    return sorted;
  }, [data, district, type, term, maxPrice, sort]);

  const selectClass = "h-11 rounded-lg border border-input bg-card px-3 text-[13.5px]";

  return (
    <SiteLayout>
      <PageHero
        image={heroImage}
        video={heroVideo.url}
        eyebrow="وحدات جاهزة للسكن والعمل"
        title="قسم الإيجار"
        subtitle="وحدات سكنية وتجارية جاهزة للإيجار في أحياء بريدة، محدّثة مباشرة من نظام إدارة العقارات لدينا."
        height="lg"
      />

      <section className="mx-auto max-w-6xl px-4 py-10">
        <Reveal className="glass-panel mb-8 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="ابحث بالاسم أو رقم العقار"
            className={selectClass}
          />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="نوع العقار" className={selectClass}>
            <option value="">كل أنواع العقارات</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="الحي" className={selectClass}>
            <option value="">كل الأحياء</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="أعلى سعر (ريال)"
            className={selectClass}
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="الترتيب" className={selectClass}>
            <option value="featured">المميزة أولاً</option>
            <option value="price-asc">الأقل سعراً</option>
            <option value="price-desc">الأعلى سعراً</option>
          </select>
        </Reveal>

        <p className="mb-4 text-[13px] text-muted-foreground">
          النتائج: {filtered.length.toLocaleString("ar-SA")} عقار
        </p>

        <PropertyGrid
          properties={filtered}
          loading={isLoading}
          error={error}
          emptyText="لا توجد عقارات إيجار مطابقة حالياً."
        />
      </section>

      <PropertyMapSection properties={filtered} />
    </SiteLayout>
  );
}
