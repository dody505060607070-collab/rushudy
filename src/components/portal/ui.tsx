import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const num = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
export const money = (v: number | null | undefined) => `${num(Math.round(Number(v ?? 0)))} ر.س`;
export const pct = (v: number | null | undefined) => `${(Number(v ?? 0)).toFixed(1)}%`;
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function PortalCard({
  title,
  icon: Icon,
  subtitle,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Icon className="h-4 w-4 text-primary" /> {title}
          </h3>
          {subtitle ? <p className="mt-0.5 text-[11.5px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    bad: "text-destructive",
  };
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[10.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Bars({
  items,
  formatter = money,
}: {
  items: { label: string; value: number; secondary?: number }[];
  formatter?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => Math.max(i.value, i.secondary ?? 0)));
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[6rem_1fr_6rem] items-center gap-2 text-[11.5px]">
          <span className="truncate text-muted-foreground">{i.label}</span>
          <span className="relative h-3 overflow-hidden rounded-full bg-muted">
            <span className="absolute inset-y-0 right-0 rounded-full bg-primary" style={{ width: `${(i.value / max) * 100}%` }} />
            {i.secondary != null ? (
              <span
                className="absolute inset-y-0 right-0 rounded-full bg-destructive/60"
                style={{ width: `${(i.secondary / max) * 100}%`, height: "35%", top: "65%" }}
              />
            ) : null}
          </span>
          <span className="text-left font-semibold text-foreground">{formatter(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </span>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "good" | "warn" | "bad" | "info" }) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    good: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    bad: "bg-destructive/15 text-destructive",
    info: "bg-primary/10 text-primary",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">{text}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[12px] font-semibold text-foreground">
      {label}
      {children}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] font-normal text-foreground";
export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60";
export const btnGhost =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted";
