import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { describeDbError } from "@/lib/db-errors";

type Props = {
  table: "contracts" | "contacts" | "properties" | "units";
  id: string | null | undefined;
  column: string;
  value: string | number | null | undefined;
  type?: "text" | "number" | "date" | "tel" | "email" | "textarea";
  options?: { value: string; label: string }[];
  display?: ReactNode;
};

/** قيمة قابلة للتعديل في مكانها بزر قلم صغير — الحفظ مباشر في النظام ويحدّث كل الشاشات */
export function InlineEdit({ table, id, column, value, type = "text", options, display }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (!id) return <>{display ?? value ?? "—"}</>;

  const start = () => {
    setDraft(value == null ? "" : String(value));
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const raw = draft.trim();
    const next = raw === "" ? null : type === "number" ? Number(raw) : raw;
    const { error } = await (supabase.from(table) as any).update({ [column]: next }).eq("id", id);
    setSaving(false);
    if (error) {
      toast.error(describeDbError(error));
      return;
    }
    setEditing(false);
    toast.success("تم الحفظ وتحديث البيانات في كل النظام");
    await qc.invalidateQueries();
  };

  if (!editing) {
    return (
      <span className="group inline-flex items-center gap-1.5">
        <span>{display ?? (value === null || value === undefined || value === "" ? "—" : value)}</span>
        <button
          type="button"
          onClick={start}
          aria-label="تعديل"
          className="rounded p-0.5 text-muted-foreground opacity-60 transition hover:bg-accent hover:text-primary hover:opacity-100"
        >
          <Pencil className="size-3" />
        </button>
      </span>
    );
  }

  const cls = "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-[13px]";
  return (
    <span className="flex items-center gap-1">
      {options ? (
        <select className={cls} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea className={`${cls} h-20 py-1`} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
      ) : (
        <input
          className={cls}
          type={type}
          value={draft}
          dir={type === "tel" || type === "email" ? "ltr" : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
        />
      )}
      <button type="button" onClick={() => void save()} disabled={saving} aria-label="حفظ" className="rounded bg-primary p-1 text-primary-foreground">
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      </button>
      <button type="button" onClick={() => setEditing(false)} aria-label="إلغاء" className="rounded border border-border p-1">
        <X className="size-3.5" />
      </button>
    </span>
  );
}
