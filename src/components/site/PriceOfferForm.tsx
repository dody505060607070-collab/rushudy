import { useState } from "react";
import { Gavel } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getStoredReferral } from "@/lib/marketing";

export function PriceOfferForm({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const [form, setForm] = useState({ name: "", phone: "", amount: "", message: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (form.name.trim().length < 2 || form.phone.trim().length < 6 || Number(form.amount) <= 0) {
      toast.error("أكمل الاسم والجوال وقيمة العرض");
      return;
    }
    setSending(true);
    const referral = getStoredReferral();
    const { error } = await supabase.from("price_offers").insert({
      property_id: propertyId,
      customer_name: form.name.trim(),
      customer_phone: form.phone.trim(),
      offer_amount: Number(form.amount),
      message: form.message.trim() || null,
      referral_code: referral?.code ?? null,
    });
    setSending(false);
    if (error) {
      toast.error("تعذر إرسال العرض، حاول مرة أخرى");
      return;
    }
    setDone(true);
    toast.success("تم استلام عرضك، وسنتواصل معك قريبًا");
  };

  const inputClass =
    "h-11 w-full rounded-lg border border-border bg-card px-3 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40";

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card" dir="rtl">
      <header className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl border border-border bg-background text-primary">
          <Gavel className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">قدّم عرض سعرك</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            اقترح المبلغ الذي تراه مناسبًا لـ{propertyName} وسنعرضه على المالك.
          </p>
        </div>
      </header>

      {done ? (
        <p className="rounded-lg border border-border bg-muted/40 p-4 text-[13px] text-foreground">
          وصلنا عرضك بنجاح ✅ سنتواصل معك على الرقم المدخل بعد مراجعته.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="الاسم"
            className={inputClass}
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="رقم الجوال"
            inputMode="tel"
            className={inputClass}
          />
          <input
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="قيمة العرض بالريال"
            inputMode="numeric"
            className={inputClass}
          />
          <input
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="ملاحظة (اختياري)"
            className={inputClass}
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="h-11 rounded-lg bg-primary px-5 text-[13.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 sm:col-span-2"
          >
            {sending ? "جارٍ الإرسال…" : "إرسال العرض"}
          </button>
        </div>
      )}
    </section>
  );
}
