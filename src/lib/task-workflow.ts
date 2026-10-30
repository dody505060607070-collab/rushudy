export type TaskDecision = "submit" | "approve" | "return";

export function taskTransition(status: string, decision: TaskDecision, isAdmin: boolean, isAssignee: boolean) {
  if (decision === "submit") {
    if (!isAssignee && !isAdmin) throw new Error("المهمة ليست مسندة إليك");
    if (!["new", "in_progress", "rejected"].includes(status)) throw new Error("المهمة ليست قيد التنفيذ");
    return "submitted";
  }
  if (!isAdmin) throw new Error("اعتماد وإرجاع المهام متاح للمدير فقط");
  if (status !== "submitted") throw new Error("المهمة ليست بانتظار الموافقة");
  return decision === "approve" ? "approved" : "in_progress";
}