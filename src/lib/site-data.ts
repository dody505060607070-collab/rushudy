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
  property_images: { url: string; is_cover: boolean; sort_order: number }[];
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
  return (Array.isArray(data) ? data : []) as unknown as PublicProperty[];
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
