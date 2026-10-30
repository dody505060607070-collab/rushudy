import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** يرسل تفاصيل المهمة على واتساب للموظفين المكلّفين. */
export const notifyTaskNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        taskId: z.string().min(1),
        userIds: z.array(z.string()).optional(),
        schedule: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const task = await context.supabase.from("tasks").select("id").eq("id", data.taskId).single();
    if (task.error || !task.data) throw new Error("لا يمكنك إرسال هذه المهمة");
    const { notifyTaskAssigneesNow } = await import("@/lib/tasks.server");
    return notifyTaskAssigneesNow(data.taskId, data.userIds, { schedule: data.schedule ?? false });
  });

/** إنهاء المهمة وإيقاف رسائل التذكير المتكررة عليها. */
export const finishTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { reviewTask } = await import("./task-review.server");
    return reviewTask(context.supabase, context.userId, data.taskId, "submit");
  });

export const decideTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid(), decision: z.enum(["approve", "return"]), note: z.string().max(2000).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { reviewTask } = await import("./task-review.server");
    return reviewTask(context.supabase, context.userId, data.taskId, data.decision, data.note);
  });

/** إيقاف رسائل المهمة المتكررة بدون تغيير حالتها. */
export const stopTaskWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const task = await context.supabase.from("tasks").select("id").eq("id", data.taskId).single();
    if (task.error || !task.data) throw new Error("لا يمكنك تعديل هذه المهمة");
    const { stopTaskReminders } = await import("@/lib/tasks.server");
    return stopTaskReminders(data.taskId);
  });
