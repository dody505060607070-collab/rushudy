import { useEffect, useMemo, useRef, useState } from "react";

import type { PublicProperty } from "@/lib/site-data";

type MapProperty = PublicProperty & {
  latitude?: number | null;
  longitude?: number | null;
};

const filters = [
  { key: "all", label: "الكل" },
  { key: "sale", label: "بيع" },
  { key: "rent", label: "إيجار" },
] as const;

const colors: Record<string, string> = {
  sale: "var(--map-sale)",
  rent: "var(--primary)",
};

function normalizePurpose(p?: string | null): "sale" | "rent" {
  const v = (p ?? "").toLowerCase().trim();
  if (v === "sale" || v === "sell" || v === "بيع" || v === "للبيع") return "sale";
  return "rent";
}

export function PropertyMap({
  properties,
  title = "العقارات على الخريطة",
  description = "اضغط على أي نقطة لعرض تفاصيل العقار — الرمادي للبيع والأحمر للإيجار.",
}: {
  properties: MapProperty[] | undefined;
  title?: string;
  description?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const [leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null);
  const [active, setActive] = useState<"all" | "sale" | "rent">("all");

  const points = useMemo(
    () =>
      (properties ?? []).filter(
        (p) =>
          typeof p.latitude === "number" &&
          typeof p.longitude === "number" &&
          (active === "all" || normalizePurpose(p.purpose) === active),
      ),
    [properties, active],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([import("leaflet/dist/leaflet.css"), import("leaflet")]).then(([, mod]) => {
      if (!cancelled) setLeaflet(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!leaflet || !containerRef.current) return;
    const L = leaflet;
    if (!mapRef.current) {
      const map = L.map(containerRef.current, { scrollWheelZoom: true, zoomControl: false }).setView(
        [26.3536, 43.9667],
        11,
      );
      setTimeout(() => map.invalidateSize(), 200);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.control.scale({ position: "bottomright", imperial: false }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);

    }
    const map = mapRef.current as import("leaflet").Map;
    const layer = layerRef.current as import("leaflet").LayerGroup;
    layer.clearLayers();

    const bounds: [number, number][] = [];
    points.forEach((property) => {
      const lat = Number(property.latitude);
      const lng = Number(property.longitude);
      bounds.push([lat, lng]);
      const purposeKey = normalizePurpose(property.purpose);
      const color = colors[purposeKey];
      const priceLabel = property.price_text ?? "عند التواصل";
      const icon = L.divIcon({
        className: "mithra-map-marker",
        iconSize: [40, 52],
        iconAnchor: [20, 50],
        popupAnchor: [0, -46],
        html: `<div class="mithra-marker-pin" style="--marker-color:${color};display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))">
          <div style="background:${color};border:2px solid #fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>
            </svg>
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};margin-top:-1px"></div>
        </div>`,
      });
      L.marker([lat, lng], { icon, title: property.name })
        .bindPopup(
          `<div dir="rtl" style="min-width:210px;font-family:inherit">
            <span style="display:inline-block;background:${color};color:#fff;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;margin-bottom:6px">${
              purposeKey === "sale" ? "للبيع" : "للإيجار"
            }</span>
            <strong style="display:block;margin-bottom:4px">${property.name}</strong>
            <span style="color:#666;font-size:12px">${property.district ?? ""}${
              property.city ? `، ${property.city}` : ""
            }</span><br/>
            <span style="color:${color};font-weight:700;font-size:13px">${priceLabel}</span>
            <div style="display:flex;gap:10px;margin-top:8px">
              <a href="/properties/${property.code}" style="color:${color};font-weight:700;font-size:12px">عرض التفاصيل</a>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener" style="color:#0a7d33;font-weight:700;font-size:12px">الاتجاهات</a>
            </div>
          </div>`,
        )
        .addTo(layer);
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    else if (bounds.length === 1) map.setView(bounds[0]!, 13);
  }, [leaflet, points]);

  useEffect(
    () => () => {
      if (mapRef.current) {
        (mapRef.current as import("leaflet").Map).remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    },
    [],
  );

  return (
    <section id="map-section" className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-foreground">{title}</h2>
          <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActive(filter.key)}
              className={`shine rounded-full px-4 py-2 text-[13px] font-bold transition ${
                active === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 pb-4 text-[12.5px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: colors["sale"] }} /> عقارات
          للبيع
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: colors["rent"] }} /> عقارات للإيجار
        </span>
        <span>{points.length} عقار على الخريطة</span>
      </div>

      <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-border shadow-float sm:h-[520px] lg:h-[600px]">
        <div
          ref={containerRef}
          className="size-full"
        />
      </div>
    </section>
  );
}
