import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** يستخرج الإحداثيات من أي رابط خرائط Google أو نص "lat,lng". */
export function parseCoordsFromMapLink(raw: string): { lat: string; lng: string } | null {
  const text = raw.trim();
  if (!text) return null;
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|destination|daddr|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && m[2]) return { lat: m[1], lng: m[2] };
  }
  return null;
}

/**
 * يفك الروابط المختصرة (maps.app.goo.gl / goo.gl/maps) ويعيد الإحداثيات.
 * يُستخدم عند لصق رابط من تطبيق الخرائط على الجوال.
 */
export const resolveMapLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().trim().min(3).max(2000) }).parse(input))
  .handler(async ({ data }): Promise<{ lat: string; lng: string } | null> => {
    const direct = parseCoordsFromMapLink(data.url);
    if (direct) return direct;
    if (!/^https?:\/\//i.test(data.url)) return null;
    try {
      const res = await fetch(data.url, { redirect: "follow" });
      const fromUrl = parseCoordsFromMapLink(res.url);
      if (fromUrl) return fromUrl;
      const html = await res.text();
      return parseCoordsFromMapLink(html);
    } catch {
      return null;
    }
  });
