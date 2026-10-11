import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Archive, Bell, Bot, Building, Building2, CalendarCheck, CalendarClock, ChevronDown, ClipboardCheck, FileText, FileWarning, Handshake, History, Home, KeyRound, LayoutGrid, ListChecks, LogOut, Megaphone, Menu, MessageCircle, MessagesSquare, Receipt, Settings, ShieldCheck, Target, UserCog, UserRound, Users, Wrench, X, type LucideIcon } from "lucide-react";

const itemIcons: Record<string, LucideIcon> = {
  "/dashboard": Home, "/ai": Bot, "/properties": Building, "/sale-owners": KeyRound, "/buildings": Building2,
  "/supply-requests": FileText, "/listing-requests": ClipboardCheck, "/reservations": CalendarCheck,
  "/owners": Users, "/contracts": FileText, "/renewals": Bell, "/invoices": Receipt, "/reminders": CalendarClock,
  "/maintenance": Wrench, "/service-partners": Handshake, "/tasks": ListChecks, "/activities": History,
  "/team-chat": MessagesSquare, "/goals": Target, "/clients": UserRound, "/marketing": Megaphone,
  "/settings": Settings, "/partners": Handshake, "/services": LayoutGrid, "/whatsapp-link": MessageCircle,
  "/employees": UserCog, "/roles": ShieldCheck, "/activity-log": History, "/error-log": FileWarning, "/backup": Archive,
};
import { useState, type ReactNode } from "react";

import logoAsset from "@/assets/rashudi-logo-navbar.png.asset.json";
import { navGroups } from "@/data/nav";
import { signOut, useCurrentUser } from "@/hooks/useAuth";
import { navCountsQuery } from "@/lib/counts";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";
import { CommandPalette } from "@/components/kit/CommandPalette";
import { cn } from "@/lib/utils";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [closed, setClosed] = useState<string[]>([]);
  const { can } = useCurrentUser();
  const { data: counts } = useQuery(navCountsQuery);
  const { t } = useI18n();

  const toggle = (label: string) =>
    setClosed((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );

  return (
    <nav dir="rtl" className="flex flex-col gap-5 px-4 py-6 text-right">
      {navGroups.map((group, gi) => {
        const items = group.items.filter((item) => !item.module || can(item.module, "view"));
        if (items.length === 0) return null;
        const isOpen = !group.label || !closed.includes(group.label);
        const Icon = group.icon;
        return (
          <div key={group.label ?? gi} className="space-y-1">
            {group.label ? (
              <button
                type="button"
                onClick={() => group.label && toggle(group.label)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[13px] font-semibold text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground"
              >
                <span className="flex min-w-0 items-center gap-2 text-right">
                  {Icon ? <Icon className="size-[18px] shrink-0 text-primary/70" /> : null}
                  <span>{t(group.label)}</span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
            ) : null}

            {isOpen ? (
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.to;
                  const badge = item.countKey ? counts?.[item.countKey] : undefined;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onNavigate}
                        className={cn(
                          "group relative flex items-center justify-between rounded-xl py-2.5 pe-2 ps-3 text-[13.5px] transition-colors",
                          active
                            ? "bg-primary/[0.07] font-bold text-primary before:absolute before:inset-y-2 before:-start-1 before:w-1 before:rounded-full before:bg-primary"
                            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5 text-right">
                          {(() => {
                            const ItemIcon = itemIcons[item.to] ?? (!group.label ? Icon : undefined);
                            return ItemIcon ? (
                              <ItemIcon className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-primary/60")} />
                            ) : null;
                          })()}
                          <span>{t(item.label)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {badge ? (
                            <span className="grid min-w-7 place-items-center rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning-foreground">
                              {badge}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

import { AiDock } from "./AiDock";
import { NotificationsBell } from "./NotificationsBell";
import { PushToggle } from "./PushToggle";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, isSuperAdmin } = useCurrentUser();
  const initial = profile?.full_name?.trim().charAt(0) ?? "؟";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background md:p-3">
      <header className="brand-tile sticky top-0 z-30 flex h-16 items-center justify-between rounded-none px-3 md:top-3 md:h-20 md:rounded-3xl md:px-6">
        <div className="relative z-10 flex items-center gap-1 md:gap-2">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full bg-primary-foreground/15 text-[13px] font-bold text-primary-foreground"
            aria-label="الحساب"
            title={profile?.full_name ?? ""}
          >
            {initial}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="grid size-9 place-items-center rounded-full text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            <LogOut className="size-[18px]" />
          </button>
          <LanguageToggle className="border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20" />
          <ThemeToggle showLabel className="hidden border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 sm:inline-flex" />
          <NotificationsBell />
          <PushToggle />
        </div>

        <Link
          to="/dashboard"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 md:pointer-events-auto"
        >
          <img
            src={logoAsset.url}
            alt="الرشودي للعقارات"
            width={360}
            height={112}
            className="h-10 w-auto max-w-[180px] object-contain md:h-16 md:max-w-[270px]"
          />
        </Link>

        <div className="relative z-10 flex items-center gap-3">
          <div className="hidden text-end md:block">
            <p className="text-[14px] font-bold leading-tight text-primary-foreground">
              {profile?.full_name ?? "—"}
            </p>
            <p className="text-[11.5px] text-primary-foreground/70">
              {isSuperAdmin ? "مدير عام" : (profile?.job_title ?? "موظف")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-lg border border-primary-foreground/25 text-primary-foreground lg:hidden"
            aria-label="القائمة"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      <div className="flex gap-3 md:pt-3">
        <aside className="surface-card sticky top-[6.5rem] hidden h-[calc(100vh-7.5rem)] w-[268px] shrink-0 overflow-y-auto bg-sidebar lg:block">
          <SidebarNav />
        </aside>

        {open ? (
          <div className="fixed inset-0 top-16 z-20 md:top-24 lg:hidden">
            <button
              type="button"
              aria-label="إغلاق القائمة"
              className="absolute inset-0 bg-foreground/30"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 end-0 w-[280px] overflow-y-auto bg-sidebar shadow-xl">
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 md:surface-card md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>

        <AiDock />
        <CommandPalette />
      </div>
    </div>
  );
}
