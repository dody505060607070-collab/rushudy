import { CheckCircle2, ClipboardList, Eye, LayoutGrid, List, MapPin, Phone, User, Wallet, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { formatDate } from "@/components/kit/LiveTable";

export type BoardItem = {
  id: string;
  status: string;
  title: string;
  phone?: string | null;
  kind?: string | null;
  location?: string | null;
  money?: string | null;
  staff?: string | null;
  tag?: string | null;
  created_at: string;
  extra?: ReactNode;
};

const COLS = [
  { key: "open", label: "قيد المراجعة", icon: ClipboardList, match: ["new", "in_review"], tone: "bg-primary/10 text-primary", head: "bg-primary/5" },
  { key: "contacted", label: "تم التواصل", icon: Phone, match: ["contacted"], tone: "bg-accent-2/15 text-accent-2", head: "bg-accent-2/5" },
  { key: "done", label: "منجزة", icon: CheckCircle2, match: ["converted", "approved"], tone: "bg-success/15 text-success", head: "bg-success/5" },
  { key: "closed", label: "مغلقة", icon: XCircle, match: ["closed", "rejected"], tone: "bg-muted text-muted-foreground", head: "bg-muted/50" },
] as const;

export function ViewToggle({ view, onChange }: { view: "board" | "table"; onChange: (v: "board" | "table") => void }) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-card p-1">
      {([["board", LayoutGrid, "عرض اللوحة"], ["table", List, "عرض الجدول"]] as const).map(([k, Icon, label]) => (
        <button
          key={k}
          type="button"
          aria-label={label}
          onClick={() => onChange(k)}
          className={`grid size-9 place-items-center rounded-lg ${view === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

export function RequestBoard({ items, onOpen, codePrefix }: { items: BoardItem[]; onOpen: (id: string) => void; codePrefix: string }) {
  const cols = COLS.filter((c) => c.key !== "closed" || items.some((i) => (c.match as readonly string[]).includes(i.status)));
  return (
    <div className={`grid gap-4 ${cols.length === 4 ? "lg:grid-cols-2 2xl:grid-cols-4" : "lg:grid-cols-3"}`}>
      {cols.map((c) => {
        const list = items.filter((i) => (c.match as readonly string[]).includes(i.status));
        const Icon = c.icon;
        return (
          <section key={c.key} className="surface-card overflow-hidden">
            <header className={`flex items-center justify-between px-4 py-3 ${c.head}`}>
              <h3 className="text-[15px] font-bold">{c.label} <span className="text-muted-foreground">({list.length})</span></h3>
              <span className={`grid size-9 place-items-center rounded-full ${c.tone}`}><Icon className="size-4" /></span>
            </header>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-8 text-center text-[12px] text-muted-foreground">لا توجد طلبات</p>
              ) : (
                list.map((i) => (
                  <article key={i.id} className="space-y-3 rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.tone}`}>
                        <Icon className="size-3" /> {c.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground" dir="ltr">#{codePrefix}-{i.id.slice(0, 4).toUpperCase()}</span>
                    </div>
                    <p className="flex items-center gap-1.5 text-[14px] font-bold"><User className="size-4 text-primary" />{i.title}</p>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <span className="truncate rounded-lg bg-muted/60 px-2 py-1.5">{i.kind || "—"}</span>
                      <span className="flex items-center gap-1 truncate rounded-lg bg-muted/60 px-2 py-1.5"><MapPin className="size-3.5 shrink-0" />{i.location || "—"}</span>
                    </div>
                    {i.money ? <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><Wallet className="size-4 text-muted-foreground" />{i.money}</p> : null}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[11.5px] text-muted-foreground">
                      <span>الموظف: <b className="text-foreground">{i.staff || "—"}</b></span>
                      {i.tag ? <span className="rounded-md bg-muted px-2 py-0.5 text-foreground">{i.tag}</span> : null}
                      <span>{formatDate(i.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpen(i.id)}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-warning/50 text-[12.5px] font-semibold text-warning hover:bg-warning/10"
                      >
                        <Eye className="size-4" /> عرض الطلب
                      </button>
                      {i.extra}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
