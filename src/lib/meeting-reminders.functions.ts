import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** إرسال التذكير الآن لكل الأطراف (بضغطة من الموظف). */
export const sendMeetingReminderNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const row = await context.supabase.from("meeting_reminders").select("*").eq("id", data.id).single();
    if (row.error || !row.data) throw new Error("لا يمكنك الوصول لهذا الموعد");
    const { sendMeetingNow } = await import("./meeting-reminders.server");
    return sendMeetingNow(row.data);
  });
