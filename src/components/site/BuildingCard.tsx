import { Link } from "@tanstack/react-router";
import { Building2, Layers, MapPin } from "lucide-react";

import { buildingCover, purposeLabels, type PublicBuilding } from "@/lib/site-data";

export function BuildingCard({ building }: { building: PublicBuilding }) {
  const cover = buildingCover(building);
  const floors = new Set((building.units ?? []).map((u) => (u.floor ?? "").trim() || "—")).size;

  return (
    <Link
      to="/buildings/$code"
      params={{ code: building.code }}
      className="lift group block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-float"
    >
      <div className="relative h-60 bg-muted sm:h-64">
        {cover ? (
          <img
            src={cover}
            alt={building.name}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <Building2 className="size-10" />
          </div>
        )}
        <span className="absolute end-3 top-3 rounded-lg bg-primary px-3 py-1 text-[12px] font-bold text-primary-foreground">
          عمارة • {purposeLabels[building.purpose] ?? building.purpose}
        </span>
      </div>

      <div className="space-y-3 p-5">
        <h3 className="line-clamp-1 text-[16px] font-bold text-foreground">{building.name}</h3>
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <MapPin className="size-4 text-primary/70" />
          {[building.district, building.city].filter(Boolean).join(" — ") || "بريدة"}
        </p>
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Layers className="size-4 text-primary/70" />
          {(building.floors_count ?? floors).toLocaleString("ar-SA")} أدوار •{" "}
          {(building.units ?? []).length.toLocaleString("ar-SA")} وحدة متاحة
        </p>
        <span className="mt-1 block rounded-lg bg-primary py-2 text-center text-[13px] font-bold text-primary-foreground">
          استعرض الشقق
        </span>
      </div>
    </Link>
  );
}

export function BuildingGrid({ buildings }: { buildings: PublicBuilding[] }) {
  if (!buildings.length) return null;
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {buildings.map((b) => (
        <BuildingCard key={b.id} building={b} />
      ))}
    </div>
  );
}
