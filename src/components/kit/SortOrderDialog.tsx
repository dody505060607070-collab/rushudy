import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/kit/Modal";
import { supabase } from "@/integrations/supabase/client";
import { describeDbError } from "@/lib/db-errors";

export type SortItem = { id: string; title: string; subtitle?: string | null; sort_order: number | null };

/** ترتيب يدوي بالسحب أو بالأسهم — الترتيب المحفوظ هو نفس ترتيب الظهور في الموقع. */
export function SortOrderDialog({
  open,
  onClose,
  table,
  items,
  title,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  table: "properties" | "buildings";
  items: SortItem[];
  title: string;
  onSaved: () => void;
}) {
  const [list, setList] = useState<SortItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setList([...items].sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9)));
  }, [open, items]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [it] = next.splice(from, 1);
    if (it) next.splice(to, 0, it);
    setList(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const changed = list
        .map((it, i) => ({ id: it.id, order: i + 1, old: it.sort_order }))
        .filter((r) => r.order !== r.old);
      for (const r of changed) {
        const { error } = await supabase.from(table).update({ sort_order: r.order }).eq("id", r.id);
        if (error) throw error;
      }
      toast.success("تم حفظ الترتيب");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(describeDbError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-3 text-[12.5px] text-muted-foreground">
        اسحب العنصر لمكانه، أو استخدم الأسهم. الأول هنا يظهر أول شيء في الموقع.
      </p>
      <ol className="max-h-[60vh] space-y-1.5 overflow-y-auto">
        {list.map((it, i) => (
          <li
            key={it.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== i) {
                move(dragIndex, i);
                setDragIndex(i);
              }
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`flex cursor-grab items-center gap-2 rounded-md border bg-card p-2 active:cursor-grabbing ${dragIndex === i ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <GripVertical className="size-4 shrink-0 text-muted-foreground" />
            <span className="w-7 shrink-0 text-center text-[12px] font-bold text-primary">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{it.title}</p>
              {it.subtitle ? <p className="truncate text-[11.5px] text-muted-foreground">{it.subtitle}</p> : null}
            </div>
            <div className="flex shrink-0 gap-0.5">
              <IconBtn label="للأول" onClick={() => move(i, 0)}><ArrowUpToLine className="size-3.5" /></IconBtn>
              <IconBtn label="فوق" onClick={() => move(i, i - 1)}><ChevronUp className="size-3.5" /></IconBtn>
              <IconBtn label="تحت" onClick={() => move(i, i + 1)}><ChevronDown className="size-3.5" /></IconBtn>
              <IconBtn label="للأخير" onClick={() => move(i, list.length - 1)}><ArrowDownToLine className="size-3.5" /></IconBtn>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-[13px]">
          إلغاء
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null} حفظ الترتيب
        </button>
      </div>
    </Modal>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="grid size-7 place-items-center rounded border border-border hover:bg-muted">
      {children}
    </button>
  );
}
