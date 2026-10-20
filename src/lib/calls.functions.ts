import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ice = { urls: string | string[]; username?: string; credential?: string };

/** بيانات خادم المكالمات (Cloudflare TURN) — صالحة لمدة قصيرة. */
export const getCallIceServers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ iceServers: Ice[]; turn: boolean }> => {
    const fallback: Ice[] = [{ urls: "stun:stun.cloudflare.com:3478" }];
    const keyId = process.env["CLOUDFLARE_TURN_KEY_ID"];
    const token = process.env["CLOUDFLARE_TURN_API_TOKEN"];
    if (!keyId || !token) return { iceServers: fallback, turn: false };
    try {
      const res = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ttl: 86400 }),
        },
      );
      if (!res.ok) {
        console.error(`Cloudflare TURN failed [${res.status}]: ${await res.text()}`);
        return { iceServers: fallback, turn: false };
      }
      const data = (await res.json()) as { iceServers?: Ice[] | Ice };
      const list = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
      return { iceServers: list.length ? list : fallback, turn: list.length > 0 };
    } catch (e) {
      console.error("Cloudflare TURN error", e);
      return { iceServers: fallback, turn: false };
    }
  });
