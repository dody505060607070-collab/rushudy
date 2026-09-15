import { createFileRoute } from "@tanstack/react-router";

/**
 * نقطة دخول n8n إلى النظام.
 * POST /api/public/n8n  مع الترويسة X-Mithra-Token
 * body: { action: "send_whatsapp" | "notify_staff" | "log", ... }
 */
export const Route = createFileRoute("/api/public/n8n")({
  server: {
    handlers: {
      // تشغيل دوري (cron كل ساعة): GET مع الترويسة X-Mithra-Token
      GET: async ({ request }) => {
        const { verifyAutomationToken } = await import("@/lib/automation.server");
        const token = request.headers.get("x-mithra-token");
        if (!(await verifyAutomationToken(token))) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { runHourlyAutomation } = await import("@/lib/automation-runner.server");
        try {
          const result = await runHourlyAutomation();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      POST: async ({ request }) => {
        const { verifyAutomationToken } = await import("@/lib/automation.server");
        const token = request.headers.get("x-mithra-token");
        if (!(await verifyAutomationToken(token))) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: Record<string, unknown>;
        try {
          const length = Number(request.headers.get("content-length") ?? 0);
          if (length > 100_000) return new Response(JSON.stringify({ ok: false, error: "payload too large" }), { status: 413, headers: { "Content-Type": "application/json" } });
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "invalid json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const action = String(body["action"] ?? "");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        try {
          if (action === "run_hourly" || action === "run_reminders") {
            const { runHourlyAutomation } = await import("@/lib/automation-runner.server");
            return json(await runHourlyAutomation());
          }

          if (action === "send_whatsapp") {
            const to = String(body["to"] ?? "");
            const text = String(body["body"] ?? "");
            if (!/^\+?[0-9]{8,15}$/.test(to.replace(/[\s()-]/g, "")) || !text.trim() || text.length > 4000) return json({ ok: false, error: "بيانات الرسالة غير صالحة" }, 400);
            const { whatsappSend } = await import("@/lib/whatsapp.functions");
            const result = await whatsappSend({ to, body: text });
            await supabaseAdmin.from("automation_events").insert({
              event: "whatsapp.inbound_request",
              direction: "in",
              payload: { to } as never,
              status: result.ok ? "sent" : "failed",
              response: result.ok ? result.sid : result.error,
            });
            return json(result, result.ok ? 200 : 502);
          }

          if (action === "notify_staff") {
            const title = String(body["title"] ?? "تنبيه من الأتمتة");
            const text = body["body"] ? String(body["body"]) : null;
            const link = body["link"] ? String(body["link"]) : null;
            if (title.length > 160 || (text?.length ?? 0) > 2000 || (link?.length ?? 0) > 500 || (link && !link.startsWith("/"))) return json({ ok: false, error: "بيانات التنبيه غير صالحة" }, 400);
            const { data: staff } = await supabaseAdmin.from("user_roles").select("user_id");
            const ids = Array.from(new Set((staff ?? []).map((r) => r.user_id)));
            if (ids.length > 0) {
              await supabaseAdmin
                .from("notifications")
                .insert(ids.map((user_id) => ({ user_id, title, body: text, link })));
            }
            await supabaseAdmin.from("automation_events").insert({
              event: "staff.notified",
              direction: "in",
              payload: { title, count: ids.length } as never,
              status: "sent",
            });
            return json({ ok: true, notified: ids.length });
          }

          if (action === "log") {
            await supabaseAdmin.from("automation_events").insert({
              event: String(body["event"] ?? "n8n.log"),
              direction: "in",
              payload: (body["data"] ?? {}) as never,
              status: "sent",
            });
            return json({ ok: true });
          }

          return json({ ok: false, error: `action غير معروف: ${action}` }, 400);
        } catch (e) {
          return json({ ok: false, error: (e as Error).message }, 500);
        }
      },
    },
  },
});
