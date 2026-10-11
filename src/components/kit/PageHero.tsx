import { BarChart3, CircleDot, Hourglass, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type HeroStat = { value: string; label: string; icon?: LucideIcon; unit?: string };

const tones = [
  { card: "border-primary/15 bg-primary/[0.04]", icon: "bg-primary/10 text-primary", value: "text-primary", fallback: BarChart3 },
  { card: "border-accent-2/25 bg-accent-2-soft", icon: "bg-accent-2/15 text-accent-2", value: "text-foreground", fallback: CircleDot },
  { card: "border-warning/25 bg-warning/[0.07]", icon: "bg-warning/15 text-warning-foreground", value: "text-foreground", fallback: Hourglass },
];

export function PageHero({
  title,
  subtitle,
  icon: Icon,
  stats = [],
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  stats?: HeroStat[];
}) {
  return (
    <section className="space-y-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-7" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">{title}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {stats.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, i) => {
            const tone = tones[i % tones.length] ?? tones[0]!;
            const StatIcon = stat.icon ?? (i === 0 ? Icon : tone.fallback);
            return (
              <div
                key={stat.label}
                className={cn("flex items-center justify-between gap-4 rounded-2xl border p-5 shadow-sm", tone.card)}
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-muted-foreground">{stat.label}</div>
                  <div className={cn("mt-1.5 text-3xl font-extrabold tabular-nums", tone.value)}>{stat.value}</div>
                  {stat.unit ? <div className="mt-0.5 text-[11.5px] text-muted-foreground">{stat.unit}</div> : null}
                </div>
                <div className={cn("grid size-14 shrink-0 place-items-center rounded-full", tone.icon)}>
                  <StatIcon className="size-6" />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
