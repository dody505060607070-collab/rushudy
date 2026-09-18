import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type PublicProperty = {
  id: string;
  code: string;
  name: string;
  purpose: string;
  rent_period: string | null;
  property_type: string | null;
  city: string | null;
  district: string | null;
  price_text: string | null;
  price_value: number | null;
  description: string | null;
  is_featured: boolean;
  map_url: string | null;
  latitude: number | null;
  longitude: number | null;
  whatsapp_number: string | null;
  link_youtube: string | null;
  link_tiktok: string | null;
  link_instagram: string | null;
  link_snapchat: string | null;
  link_x: string | null;
  link_facebook: string | null;
  link_tour: string | null;
  created_at: string;
  floor?: string | null;
  building_id?: string | null;
  building_code?: string | null;
  building_name?: string | null;
  property_images: { url: string; is_cover: boolean; sort_order: number; focal_x?: number; focal_y?: number }[];

};

const PROPERTY_FIELDS =
  "id, code, name, purpose, rent_period, property_type, city, district, price_text, price_value, description, is_featured, map_url, latitude, longitude, whatsapp_number, link_youtube, link_tiktok, link_instagram, link_snapchat, link_x, link_facebook, link_tour, created_at, property_images(url, is_cover, sort_order)";

export const DEFAULT_WHATSAPP = "966550818020";
export const COMPANY_PHONE = "0550818020";
export const COMPANY_EMAIL = "info@al-rashudi.com";

export function whatsappLink(number?: string | null, text?: string) {
  const digits = (number ?? DEFAULT_WHATSAPP).replace(/[^0-9]/g, "");
  const normalized = digits.startsWith("966") ? digits : `966${digits.replace(/^0/, "")}`;
  return `https://wa.me/${normalized}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** رسالة واتساب جاهزة للاستفسار عن عقار، تتضمن الكود ورابط صفحة العقار. */
export function propertyEnquiryText(property: {
  code: string;
  name: string;
  city?: string | null;
  district?: string | null;
  price_text?: string | null;
  price_value?: number | null;
}) {
  const place = [property.district, property.city].filter(Boolean).join(" — ");
  const price =
    property.price_text ??
    (property.price_value ? `${property.price_value.toLocaleString("ar-SA")} ريال` : null);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/properties/${encodeURIComponent(property.code)}`
      : `https://alrashudi.sa/properties/${encodeURIComponent(property.code)}`;
  return [
    "السلام عليكم ورحمة الله 🌿",
    "أرغب في الاستفسار عن هذا العقار:",
    `• الاسم: ${property.name}`,
    `• الكود: ${property.code}`,
    place ? `• الموقع: ${place}` : null,
    price ? `• السعر: ${price}` : null,
    `• الرابط: ${url}`,
    "",
    "برجاء تزويدي بالتفاصيل وموعد المعاينة. وشكرًا لكم.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function coverImage(property: Pick<PublicProperty, "property_images">) {
  const images = [...(property.property_images ?? [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
  );
  return images[0]?.url ?? null;
}

export function galleryImages(property: Pick<PublicProperty, "property_images">) {
  return [...(property.property_images ?? [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
  );
}

async function fetchProperties(purpose?: "rent" | "sale", limit = 60) {
  const args = purpose ? { _purpose: purpose, _limit: limit } : { _limit: limit };
  const { data, error } = await supabase.rpc("get_public_properties", args);
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as unknown as PublicProperty[];
  // في الموقع العام تظهر العمارة كإعلان واحد، ولا تظهر شققها منفردة.
  return rows.filter((row) => !row.building_id);
}

export const publicPropertiesQuery = (purpose?: "rent" | "sale", limit?: number) =>
  queryOptions({
    queryKey: ["public-properties", purpose ?? "all", limit ?? 60],
    queryFn: () => fetchProperties(purpose, limit),
    staleTime: 60_000,
  });

export const publicPropertyQuery = (code: string) =>
  queryOptions({
    queryKey: ["public-property", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_properties", {
        _code: code,
        _limit: 1,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : null) as unknown as PublicProperty | null;
    },
  });

export type PublicBuildingUnit = {
  id: string;
  code: string;
  name: string;
  floor: string | null;
  purpose: string;
  rent_period: string | null;
  property_type: string | null;
  status: string;
  price_text: string | null;
  price_value: number | null;
  description: string | null;
  whatsapp_number: string | null;
  city: string | null;
  district: string | null;
  link_tour: string | null;
  latitude: number | null;
  longitude: number | null;
  images: { url: string; is_cover: boolean; sort_order: number }[];
};

export type PublicBuilding = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  district: string | null;
  address: string | null;
  description: string | null;
  purpose: string;
  floors_count: number | null;
  cover_url: string | null;
  sort_order: number;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  map_url: string | null;
  units: PublicBuildingUnit[];
};

async function fetchBuildings(args: { code?: string | undefined; purpose?: "rent" | "sale" | undefined; limit?: number }) {
  const params: { _code?: string; _purpose?: string; _limit?: number } = { _limit: args.limit ?? 60 };
  if (args.code) params._code = args.code;
  if (args.purpose) params._purpose = args.purpose;
  const { data, error } = await supabase.rpc("get_public_buildings", params);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as unknown as PublicBuilding[];
}

export const publicBuildingsQuery = (purpose?: "rent" | "sale", limit?: number) =>
  queryOptions({
    queryKey: ["public-buildings", purpose ?? "all", limit ?? 60],
    queryFn: () => fetchBuildings({ purpose: purpose ?? undefined, limit: limit ?? 60 }),
    staleTime: 60_000,
  });

export const publicBuildingQuery = (code: string) =>
  queryOptions({
    queryKey: ["public-building", code],
    queryFn: async () => (await fetchBuildings({ code, limit: 1 }))[0] ?? null,
  });

/** غلاف العمارة: الصورة المرفوعة أو أول صورة من شققها. */
export function buildingCover(building: PublicBuilding) {
  if (building.cover_url) return building.cover_url;
  for (const unit of building.units ?? []) {
    const cover = [...(unit.images ?? [])].sort(
      (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
    )[0];
    if (cover) return cover.url;
  }
  return null;
}

/** نسبة إشغال العمارة من حالات شققها. */
export function buildingOccupancy(units: { status: string }[]) {
  const total = units.length;
  const busy = units.filter((u) => u.status === "rented" || u.status === "sold" || u.status === "reserved").length;
  return { total, busy, free: total - busy, rate: total ? Math.round((busy / total) * 100) : 0 };
}

/** ترتيب شقق العمارة حسب الأدوار. */
export function groupUnitsByFloor(units: PublicBuildingUnit[]) {
  const map = new Map<string, PublicBuildingUnit[]>();
  for (const unit of units ?? []) {
    const key = (unit.floor ?? "").trim() || "بدون دور";
    map.set(key, [...(map.get(key) ?? []), unit]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "ar", { numeric: true }));
}


export const publicServicesQuery = queryOptions({
  queryKey: ["public-services"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("services")
      .select("id, title, description, icon, image_url")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 300_000,
});

export const publicSettingsQuery = queryOptions({
  queryKey: ["public-settings"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_public_settings");
    if (error) throw error;
    return data && typeof data === "object" && !Array.isArray(data)
      ? data as {
          company_name?: string;
          phone?: string | null;
          whatsapp_number?: string | null;
          email?: string | null;
          address?: string | null;
          about?: string | null;
          stats?: Record<string, unknown>;
          social_links?: Record<string, unknown>;
        }
      : null;
  },
  staleTime: 300_000,
});

export const purposeLabels: Record<string, string> = {
  rent: "إيجار",
  sale: "بيع",
  investment: "استثمار",
};

export const rentPeriodLabels: Record<string, string> = {
  yearly: "سنوي",
  monthly: "شهري",
  daily: "يومي",
};
