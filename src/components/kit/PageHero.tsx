import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type HeroStat = { value: string; label: string };

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
    <section className="space-y-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="brand-tile grid size-12 shrink-0 place-items-center">
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">{title}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {stats.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                "p-5",
                i === 0 ? "brand-tile" : i === 1 ? "surface-card" : "surface-card border-accent-2/30 bg-accent-2-soft",
              )}
            >
              <div className={cn("text-[13px] font-semibold", i === 0 ? "text-primary-foreground/85" : "text-muted-foreground")}>
                {stat.label}
              </div>
              <div className={cn("mt-2 text-3xl font-extrabold", i === 0 ? "text-primary-foreground" : i === 2 ? "text-accent-2" : "text-foreground")}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
