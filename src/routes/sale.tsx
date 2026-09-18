import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import heroImage from "@/assets/hero-sale.jpg";
import heroVideo from "@/assets/video-sale.mp4.asset.json";
import { InstallmentCalculator } from "@/components/site/InstallmentCalculator";
import { PageHero } from "@/components/site/PageHero";
import { BuildingCard } from "@/components/site/BuildingCard";
import { PropertyGrid } from "@/components/site/PropertyCard";
import { PropertyCard } from "@/components/site/PropertyCard";
import { PropertyMapSection } from "@/components/site/PropertyMapSection";
import { Reveal } from "@/components/site/Reveal";
import { SiteLayout } from "@/components/site/SiteLayout";
import { publicBuildingsQuery, publicPropertiesQuery } from "@/lib/site-data";

export const Route = createFileRoute("/sale")({
  head: () => ({
    meta: [
      { title: "عقارات للبيع في بريدة | الرشودي للعقارات" },
      {
        name: "description",
        content: "فلل وأراضٍ وعمائر ومحلات للبيع في بريدة بأسعار السوق الحقيقية وبيانات موثقة.",
      },
      { property: "og:title", content: "عقارات للبيع في بريدة | الرشودي للعقارات" },
      {
        property: "og:description",
        content: "فرص شراء عقارية في بريدة مع حاسبة تمويل وتواصل مباشر.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://alrashudi.sa/sale" },
    ],
    links: [{ rel: "canonical", href: "https://alrashudi.sa/sale" }],
  }),
  component: SalePage,
});

function SalePage() {
  const { data, isLoading, error } = useQuery(publicPropertiesQuery("sale", 200));
  const buildings = useQuery(publicBuildingsQuery("sale", 60));
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
        !p.building_code &&
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
        eyebrow="فرص استثمار وشراء"
        title="قسم البيع"
        subtitle="فرص شراء مدروسة في بريدة: فلل، أراضٍ، عمائر ومحلات — بمعلومات موثقة من ملاك حقيقيين."
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
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="نوع العقار"
            className={selectClass}
          >
            <option value="">كل أنواع العقارات</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            aria-label="الحي"
            className={selectClass}
          >
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
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="الترتيب"
            className={selectClass}
          >
            <option value="featured">المميزة أولاً</option>
            <option value="price-asc">الأقل سعراً</option>
            <option value="price-desc">الأعلى سعراً</option>
          </select>
        </Reveal>

        <p className="mb-4 text-[13px] text-muted-foreground">
          النتائج: {(filtered.length + (buildings.data?.length ?? 0)).toLocaleString("ar-SA")} عقار
        </p>
        {isLoading || buildings.isLoading ? (
          <PropertyGrid properties={undefined} loading />
        ) : error || buildings.error ? (
          <PropertyGrid properties={undefined} error={error ?? buildings.error} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(buildings.data ?? []).map((building) => (
              <BuildingCard key={`building-${building.id}`} building={building} />
            ))}
            {filtered.map((property) => (
              <PropertyCard key={`property-${property.id}`} property={property} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <Reveal>
          <InstallmentCalculator />
        </Reveal>
      </section>

      <PropertyMapSection properties={filtered} />
    </SiteLayout>
  );
}
