import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

/** الأرقام التي يصلها واتساب عند كل بلاغ صيانة جديد (المكتب + موظف الصيانة). */
export function NotifyRecipients() {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");

  const list = useQuery({
    queryKey: ["maintenance-notify-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_notify_recipients")
        .select("id, label, phone, is_active")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["maintenance-notify-recipients"] });

  const add = useMutation({
    mutationFn: async () => {
      const p = phone.trim();
      if (p.replace(/\D/g, "").length < 9) throw new Error("اكتب رقم جوال صحيح");
      const { error } = await supabase
        .from("maintenance_notify_recipients")
        .insert({ label: label.trim() || "رقم إضافي", phone: p });
      if (error) throw new Error(error.code === "23505" ? "الرقم موجود مسبقًا" : error.message);
    },
    onSuccess: () => {
      setLabel("");
      setPhone("");
      toast.success("تمت إضافة الرقم");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (row: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("maintenance_notify_recipients")
        .update({ is_active: !row.is_active })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_notify_recipients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الرقم");
      void refresh();
    },
  });

  const field = "h-10 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground";

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-3 flex items-start gap-2">
        <BellRing className="mt-0.5 size-4 text-primary" />
        <div>
          <h2 className="text-[14px] font-bold text-foreground">من يصله واتساب عند بلاغ صيانة جديد؟</h2>
          <p className="text-[12px] text-muted-foreground">
            لما يرسل المستأجر أو المالك أو أي شخص من صفحة الموقع بلاغ صيانة، تصل رسالة لكل رقم مفعّل هنا.
          </p>
        </div>
      </header>
      <div className="flex flex-wrap gap-2">
        {(list.data ?? []).map((r) => (
          <div
            key={r.id}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] ${r.is_active ? "border-primary/30 bg-primary/5" : "border-border bg-muted/40 text-muted-foreground"}`}
          >
            <b>{r.label}</b>
            <span dir="ltr">{r.phone}</span>
            <button
              type="button"
              onClick={() => toggle.mutate(r)}
              className="rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold"
            >
              {r.is_active ? "إيقاف" : "تشغيل"}
            </button>
            <button
              type="button"
              aria-label="حذف الرقم"
              onClick={() => {
                if (confirm(`حذف ${r.label}؟`)) remove.mutate(r.id);
              }}
              className="text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {list.data && list.data.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">لا توجد أرقام بعد — أضف رقم المكتب.</p>
        ) : null}
      </div>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <input className={field} placeholder="الاسم (مثال: المكتب)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className={field} dir="ltr" placeholder="05xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button
          type="submit"
          disabled={add.isPending}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> إضافة رقم
        </button>
      </form>
    </section>
  );
}
