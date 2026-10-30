export function incrementAchievement(previous: number, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("اكتب إضافة أكبر من صفر");
  if (!Number.isFinite(previous) || previous < 0) throw new Error("قيمة الإنجاز غير صالحة");
  return previous + amount;
}