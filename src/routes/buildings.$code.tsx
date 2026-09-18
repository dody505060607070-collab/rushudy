import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, DoorOpen, Layers, MapPin } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import {
  buildingCover,
  groupUnitsByFloor,
  propertyEnquiryText,
  publicBuildingQuery,
  purposeLabels,
  whatsappLink,
  type PublicBuildingUnit,
} from "@/lib/site-data";

export const Route = createFileRoute("/buildings/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `عمارة ${params.code} | الرشودي للعقارات` },
      {
        name: "description",
        content: `شقق عمارة ${params.code} في بريدة موزعة على الأدوار مع الصور والأسعار وتواصل مباشر.`,
      },
      { property: "og:title", content: `عمارة ${params.code} | الرشودي للعقارات` },
      { property: "og:description", content: "استعرض شقق العمارة حسب الدور مع الصور والأسعار." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `https://alrashudi.sa/buildings/${encodeURIComponent(params.code)}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `https://alrashudi.sa/buildings/${encodeURIComponent(params.code)}` }],
  }),
  component: BuildingPage,
});

function unitCover(unit: PublicBuildingUnit) {
  return (
    [...(unit.images ?? [])].sort(
      (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
    )[0]?.url ?? null
  );
}

const statusLabels: Record<string, string> = {
  available: "متاحة",
  reserved: "محجوزة",
  rented: "مؤجرة",
  sold: "مبيعة",
};

function BuildingPage() {
  const { code } = Route.useParams();
  const { data: building, isLoading } = useQuery(publicBuildingQuery(code));

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
      </SiteLayout>
    );
  }

  if (!building) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-xl font-bold text-foreground">العمارة غير متاحة</h1>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">
            العودة للرئيسية
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const cover = buildingCover(building);
  const floors = groupUnitsByFloor(building.units ?? []);

  return (
    <SiteLayout>
      <section className="relative h-[46vh] min-h-72 w-full overflow-hidden bg-muted">
        {cover ? (
          <img src={cover} alt={building.name} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <Building2 className="size-14" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-8">
          <span className="rounded-lg bg-primary px-3 py-1 text-[12px] font-bold text-primary-foreground">
            عمارة • {purposeLabels[building.purpose] ?? building.purpose}
          </span>
          <h1 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">{building.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-4 text-[13.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 text-primary/70" />
              {[building.district, building.city, building.address].filter(Boolean).join(" — ") || "بريدة"}
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="size-4 text-primary/70" />
              {(building.floors_count ?? floors.length).toLocaleString("ar-SA")} أدوار
            </span>
            <span className="flex items-center gap-1.5">
              <DoorOpen className="size-4 text-primary/70" />
              {(building.units ?? []).length.toLocaleString("ar-SA")} شقة معروضة
            </span>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-10 px-4 py-12">
        {building.description ? (
          <p className="whitespace-pre-wrap rounded-2xl border border-border bg-card p-6 text-[14px] leading-8 text-muted-foreground">
            {building.description}
          </p>
        ) : null}

        {!floors.length ? (
          <p className="rounded-2xl border border-border bg-card p-10 text-center text-[14px] text-muted-foreground">
            لا توجد شقق معروضة في هذه العمارة حالياً.
          </p>
        ) : null}

        {floors.map(([floor, units]) => (
          <div key={floor} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Layers className="size-5" />
              </span>
              <h2 className="text-lg font-bold text-foreground">{floor}</h2>
              <span className="rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground">
                {units.length.toLocaleString("ar-SA")} شقة
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {units.map((unit) => {
                const img = unitCover(unit);
                const price =
                  unit.price_text ??
                  (unit.price_value ? `${unit.price_value.toLocaleString("ar-SA")} ريال` : "السعر عند الطلب");
                return (
                  <article
                    key={unit.id}
                    className="lift group overflow-hidden rounded-2xl border border-border bg-card shadow-card"
                  >
                    <Link to="/properties/$code" params={{ code: unit.code }} className="block">
                      <div className="relative h-52 bg-muted">
                        {img ? (
                          <img
                            src={img}
                            alt={unit.name}
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="grid size-full place-items-center text-muted-foreground">
                            <DoorOpen className="size-9" />
                          </div>
                        )}
                        <span className="absolute end-3 top-3 rounded-lg bg-card/90 px-3 py-1 text-[12px] font-bold text-foreground">
                          {statusLabels[unit.status] ?? unit.status}
                        </span>
                      </div>
                    </Link>
                    <div className="space-y-2 p-4">
                      <h3 className="line-clamp-1 text-[15px] font-bold text-foreground">{unit.name}</h3>
                      <p className="text-[12.5px] text-muted-foreground">
                        {[unit.property_type, unit.floor].filter(Boolean).join(" • ") || "شقة"}
                      </p>
                      <p className="text-[15px] font-bold text-primary">{price}</p>
                      <div className="flex gap-2 pt-1">
                        <Link
                          to="/properties/$code"
                          params={{ code: unit.code }}
                          className="flex-1 rounded-lg bg-primary py-2 text-center text-[13px] font-bold text-primary-foreground"
                        >
                          تفاصيل الشقة
                        </Link>
                        <a
                          href={whatsappLink(unit.whatsapp_number, propertyEnquiryText(unit))}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground"
                        >
                          واتساب
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </SiteLayout>
  );
}
