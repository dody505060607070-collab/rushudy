import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * يعمل كل 30 دقيقة: يرسل الدفعة التالية (20 رسالة) من طابور متابعة الملاك.
 * يبدأ الطابور يوم الجمعة 4 العصر، وتستمر الدفعات حتى يفرغ.
 */
export const Route = createFileRoute("/api/public/jobs/owner-followup-batch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { sendOwnerFollowupBatch } = await import("@/lib/owner-biweekly.server");
        const result = await sendOwnerFollowupBatch();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
