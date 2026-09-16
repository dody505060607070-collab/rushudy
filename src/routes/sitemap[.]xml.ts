import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/site-meta";

/** الصفحات العامة القابلة للأرشفة فقط (لا لوحة تحكم ولا بوابة عميل). */
const STATIC_PATHS = [
  "/",
  "/rent",
  "/sale",
  "/about",
  "/contact",
  "/list-property",
  "/privacy",
  "/terms",
];

function xmlEscape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const paths = new Set(STATIC_PATHS);

        try {
          const apiUrl = process.env["SUPABASE_URL"];
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
          if (apiUrl && key) {
            const response = await fetch(`${apiUrl}/rest/v1/rpc/get_public_properties`, {
              method: "POST",
              headers: { apikey: key, "Content-Type": "application/json" },
              body: JSON.stringify({ _limit: 1000 }),
            });
            if (response.ok) {
              const data: unknown = await response.json();
              if (Array.isArray(data)) {
                for (const row of data) {
                  if (row && typeof row === "object" && "code" in row && typeof row.code === "string") {
                    paths.add(`/properties/${encodeURIComponent(row.code)}`);
                  }
                }
              }
            }
          }
        } catch {
          // Keep the static sitemap available if the property inventory is temporarily unavailable.
        }

        const urls = [...paths]
          .map((path) => `<url><loc>${xmlEscape(new URL(path, SITE_URL).href)}</loc></url>`)
          .join("");

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
          {
            headers: {
              "Content-Type": "application/xml",
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      },
    },
  },
});
