import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Handshake, Home, KeyRound, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import ctaImage from "@/assets/cta-deal.jpg";
import socialCard from "@/assets/rushdy-social-card.jpg.asset.json";
import { HeroVideo } from "@/components/site/HeroVideo";
import { PropertyGrid } from "@/components/site/PropertyCard";
import { PropertyCompare } from "@/components/site/PropertyCompare";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PropertyMapSection } from "@/components/site/PropertyMapSection";
import { Reveal } from "@/components/site/Reveal";
import { useRecentlyViewed } from "@/lib/favorites";
import { publicPropertiesQuery, publicServicesQuery } from "@/lib/site-data";
import { SITE_NAME, SITE_URL, absoluteSiteUrl } from "@/lib/site-meta";

const SOCIAL_IMAGE = absoluteSiteUrl(socialCard.url);
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": ["RealEstateAgent", "LocalBusiness"],
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: ["الرشيدي للعقارات", "Alrashudi Real Estate"],
  url: SITE_URL,
  logo: absoluteSiteUrl("/favicon.png"),
  image: SOCIAL_IMAGE,
  description: "مؤسسة عقارية متخصصة في الإيجار والبيع وإدارة الأملاك في بريدة والقصيم.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "بريدة",
    addressRegion: "القصيم",
    addressCountry: "SA",
  },
  areaServed: ["بريدة", "القصيم"],
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الرشودي للعقارات | عقارات بريدة للإيجار والبيع" },
      {
        name: "description",
        content:
          "الرشودي للعقارات في بريدة: شقق وفلل ومعارض للإيجار والبيع، خبرة محلية تفوق 8 سنوات وخدمة سريعة عبر واتساب.",
      },
      { property: "og:title", content: "الرشودي للعقارات | عقارات بريدة للإيجار والبيع" },
      {
        property: "og:description",
        content: "خبرة محلية في سوق عقارات بريدة: إيجار، بيع، إدارة أملاك ومتابعة عقود.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: SOCIAL_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "شعار الرشودي للعقارات" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: SOCIAL_IMAGE },
      { name: "twitter:image:alt", content: "شعار الرشودي للعقارات" },
      { property: "og:url", content: `${SITE_URL}/` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(organizationSchema),
      },
    ],
  }),
  component: HomePage,
});

const fallbackServices = [
  { id: "s1", title: "تأجير الوحدات", description: "شقق وفلل ومكاتب جاهزة للسكن والعمل.", icon: "KeyRound" },
  { id: "s2", title: "بيع العقارات", description: "أراضٍ وفلل وعمائر بأسعار السوق الحقيقية.", icon: "Home" },
  { id: "s3", title: "إدارة الأملاك", description: "متابعة العقود والتحصيل والصيانة عن المالك.", icon: "ShieldCheck" },
  { id: "s4", title: "الوساطة العقارية", description: "تفاوض ووساطة موثوقة بين المالك والمستأجر.", icon: "Handshake" },
];

const serviceIcons = { KeyRound, Home, ShieldCheck, Handshake, Building2 } as const;

function HomePage() {
  const rent = useQuery(publicPropertiesQuery("rent", 6));
  const sale = useQuery(publicPropertiesQuery("sale", 6));
  const services = useQuery(publicServicesQuery);
  const all = useQuery(publicPropertiesQuery(undefined, 200));

  const [purpose, setPurpose] = useState("");
  const [type, setType] = useState("");
  const [district, setDistrict] = useState("");
  const [rentPeriod, setRentPeriod] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const types = useMemo(
    () => [...new Set((all.data ?? []).map((p) => p.property_type).filter(Boolean))] as string[],
    [all.data],
  );
  const districts = useMemo(
    () => [...new Set((all.data ?? []).map((p) => p.district).filter(Boolean))] as string[],
    [all.data],
  );
  const rentPeriods = ["سنوي", "شهري", "يومي"];

  const results = useMemo(() => {
    if (!searchSubmitted) return null;
    return (all.data ?? []).filter(
      (p) =>
        (!purpose || p.purpose === purpose) &&
        (!type || p.property_type === type) &&
        (!district || p.district === district) &&
        (!rentPeriod || `${p.name} ${p.description ?? ""} ${p.price_text ?? ""}`.includes(rentPeriod)),
    );
  }, [all.data, purpose, type, district, rentPeriod, searchSubmitted]);

  const recentCodes = useRecentlyViewed();
  const recent = (all.data ?? []).filter((p) => recentCodes.includes(p.code)).slice(0, 3);

  const shownServices = services.data?.length ? services.data : fallbackServices;
  const compareProperties = (all.data ?? []).filter((property) => compareIds.includes(property.id));
  const toggleCompare = (property: (typeof compareProperties)[number]) => {
    setCompareIds((current) => {
      if (current.includes(property.id)) return current.filter((id) => id !== property.id);
      if (current.length >= 3) return current;
      return [...current, property.id];
    });
  };

  return (
    <SiteLayout>
      <HeroVideo
        types={types}
        districts={districts}
        rentPeriods={rentPeriods}
        type={type}
        district={district}
        rentPeriod={rentPeriod}
        onTypeChange={setType}
        onDistrictChange={setDistrict}
        onRentPeriodChange={setRentPeriod}
        onSearch={() => {
          setPurpose(rentPeriod ? "rent" : "");
          setSearchSubmitted(true);
          window.setTimeout(() => document.querySelector("#search-results")?.scrollIntoView({ behavior: "smooth" }), 0);
        }}
      />

      {results ? (
        <section id="search-results" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
          <h2 className="mb-6 text-[22px] font-bold text-foreground">نتائج البحث</h2>
          <PropertyGrid
            properties={results}
            loading={all.isLoading}
            error={all.error}
            emptyText="لا توجد عقارات مطابقة لبحثك حالياً."
            compareIds={compareIds}
            onCompare={toggleCompare}
          />
        </section>
      ) : null}

      <Reveal as="section" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[22px] font-bold text-foreground sm:text-[26px]">أحدث عقارات الإيجار</h2>
          <Link to="/rent" className="text-[13.5px] font-semibold text-primary hover:underline">
            عرض الكل
          </Link>
        </div>
        <PropertyGrid
          properties={rent.data}
          loading={rent.isLoading}
          error={rent.error}
          emptyText="لا توجد عقارات إيجار معروضة حالياً."
          compareIds={compareIds}
          onCompare={toggleCompare}
        />
      </Reveal>

      <Reveal as="section" className="mesh-bg py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-[22px] font-bold text-foreground sm:text-[26px]">أحدث عقارات البيع</h2>
            <Link to="/sale" className="text-[13.5px] font-semibold text-primary hover:underline">
              عرض الكل
            </Link>
          </div>
          <PropertyGrid
            properties={sale.data}
            loading={sale.isLoading}
            error={sale.error}
            emptyText="لا توجد عقارات بيع معروضة حالياً."
            compareIds={compareIds}
            onCompare={toggleCompare}
          />
        </div>
      </Reveal>

      <Reveal as="section" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-[24px] font-bold text-foreground sm:text-[30px]">خدماتنا</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[13.5px] leading-7 text-muted-foreground">
          نغطي رحلة العقار كاملة: العرض، التفاوض، العقد، ثم المتابعة والتحصيل.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shownServices.map((service) => {
            const Icon =
              serviceIcons[(service.icon ?? "Building2") as keyof typeof serviceIcons] ?? Building2;
            return (
              <div
                key={service.id}
                className="glass lift rounded-2xl p-6 text-center"
              >
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-card">
                  <Icon className="size-6" />
                </span>
                <h3 className="mt-4 text-[15.5px] font-bold text-foreground">{service.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>
      </Reveal>

      {recent.length > 0 ? (
        <Reveal as="section" className="mx-auto max-w-6xl px-4 pb-6">
          <h2 className="mb-6 text-[22px] font-bold text-foreground sm:text-[26px]">شاهدتها مؤخراً</h2>
          <PropertyGrid properties={recent} />
        </Reveal>
      ) : null}

      <div id="property-map" className="scroll-mt-24">
        <PropertyMapSection properties={all.data} />
      </div>

      <section className="relative isolate overflow-hidden py-20 text-white">
        <img
          src={ctaImage}
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-primary/75" />
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 text-center">
          <h2 className="text-[24px] font-bold sm:text-[30px]">عندك عقار للإيجار أو البيع؟</h2>
          <p className="max-w-xl text-[14px] leading-7 text-white/90">
            أرسل تفاصيل عقارك وسيتواصل معك فريقنا لتقييمه وعرضه على العملاء المناسبين.
          </p>
          <Link
            to="/list-property"
            className="shine rounded-xl bg-gold px-8 py-3.5 text-[14px] font-bold text-gold-foreground"
          >
            اعرض | اطلب عقارك
          </Link>
        </div>
      </section>
      <PropertyCompare
        properties={compareProperties}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))}
        onClear={() => { setCompareIds([]); setCompareOpen(false); }}
      />
    </SiteLayout>
  );
}
