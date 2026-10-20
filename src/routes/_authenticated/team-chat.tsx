import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";

import { DirectChats } from "@/components/chat/DirectChats";
import { StaffCall } from "@/components/chat/StaffCall";
import { PageHero } from "@/components/kit/PageHero";

export const Route = createFileRoute("/_authenticated/team-chat")({
  head: () => ({
    meta: [
      { title: "شات الموظفين | الرشودي للعقارات" },
      { name: "description", content: "محادثات ومكالمات داخلية بين موظفي الشركة." },
      { property: "og:title", content: "شات الموظفين | الرشودي للعقارات" },
      { property: "og:description", content: "محادثات ومكالمات داخلية بين موظفي الشركة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamChatPage,
});

export function TeamChatPage() {
  return (
    <>
      <PageHero
        title="شات الموظفين"
        subtitle="رسائل ومكالمات داخلية بين الموظفين — غير متاحة للعملاء."
        icon={MessagesSquare}
      />
      <div className="surface-card mb-4 flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">مكالمة جماعية</h2>
          <p className="text-[11.5px] text-muted-foreground">اضغط أيقونة الاتصال — أي موظف يضغطها ينضم لنفس المكالمة.</p>
        </div>
        <StaffCall />
      </div>
      <DirectChats />
    </>
  );
}
