import { Link } from "@tanstack/react-router";
import { Building2, GitCompareArrows, MapPin } from "lucide-react";

import { FavoriteButton } from "@/components/site/FavoriteButton";
import { coverImage, purposeLabels, whatsappLink, type PublicProperty } from "@/lib/site-data";

export function PropertyCard({ property, comparing = false, onCompare }: { property: PublicProperty; comparing?: boolean; onCompare?: (property: PublicProperty) => void }) {
  const cover = coverImage(property);
  const price =
    property.price_text ??
    (property.price_value ? `${property.price_value.toLocaleString("ar-SA")} ريال` : "السعر عند الطلب");

  return (
    <article className="lift group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-float">
      <div className="relative h-60 bg-muted sm:h-64">
        {cover ? (
          <img
            src={cover}
            alt={property.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <Building2 className="size-10" />
          </div>
        )}
        <span className="absolute end-3 top-3 rounded-lg bg-primary px-3 py-1 text-[12px] font-bold text-primary-foreground">
          {purposeLabels[property.purpose] ?? property.purpose}
        </span>
        <FavoriteButton code={property.code} className="absolute bottom-3 end-3" />
        {onCompare ? (
          <button
            type="button"
            onClick={() => onCompare(property)}
            aria-label={comparing ? "إزالة العقار من المقارنة" : "إضافة العقار للمقارنة"}
            className={`absolute bottom-3 start-3 grid size-9 place-items-center rounded-full border shadow-card transition-colors ${comparing ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}
          >
            <GitCompareArrows className="size-4" />
          </button>
        ) : null}
        {property.is_featured ? (
          <span className="absolute start-3 top-3 rounded-lg bg-gold px-3 py-1 text-[12px] font-bold text-gold-foreground">
            مميز
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-5">
        <h3 className="line-clamp-1 text-[16px] font-bold text-foreground">{property.name}</h3>
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <MapPin className="size-4 text-primary/70" />
          {[property.district, property.city].filter(Boolean).join(" — ") || "بريدة"}
        </p>
        {property.property_type ? (
          <p className="text-[13px] text-muted-foreground">{property.property_type}</p>
        ) : null}
        <p className="text-[15px] font-bold text-primary">{price}</p>

        <div className="flex gap-2 pt-1">
          <Link
            to="/properties/$code"
            params={{ code: property.code }}
            className="flex-1 rounded-lg bg-primary py-2 text-center text-[13px] font-bold text-primary-foreground"
          >
            عرض التفاصيل
          </Link>
          <a
            href={whatsappLink(
              property.whatsapp_number,
              `استفسار عن العقار ${property.code} — ${property.name}`,
            )}
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
}

export function PropertyGrid({
  properties,
  loading,
  error,
  emptyText = "لا توجد عقارات معروضة حالياً.",
  compareIds,
  onCompare,
}: {
  properties: PublicProperty[] | undefined;
  loading?: boolean;
  error?: unknown;
  emptyText?: string;
  compareIds?: string[];
  onCompare?: (property: PublicProperty) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl border border-border bg-muted/60" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-[13.5px] text-destructive">
        تعذّر تحميل العقارات، حاول تحديث الصفحة.
      </p>
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-[13.5px] text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} comparing={compareIds?.includes(property.id)} onCompare={onCompare} />
      ))}
    </div>
  );
}
