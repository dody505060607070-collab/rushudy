import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Download, ExternalLink } from "lucide-react";

import profileAsset from "@/assets/alrashudi-real-estate-profile.pdf.asset.json";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/company-profile")({
  head: () => ({
    meta: [
      { title: "ملف هوية الرشودي | الرشودي للعقارات" },
      {
        name: "description",
        content: "الملف التعريفي لنظام وخدمات الرشودي للعقارات في بريدة والقصيم.",
      },
      { property: "og:title", content: "ملف هوية الرشودي | الرشودي للعقارات" },
      {
        property: "og:description",
        content: "تعرف على نظام وخدمات الرشودي للعقارات من خلال الملف التعريفي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyProfilePage,
});

function CompanyProfilePage() {
  return (
    <main dir="rtl" className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              aria-label="الرجوع إلى الرئيسية"
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0")}
            >
              <ArrowRight className="size-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-[16px] font-bold text-foreground sm:text-[18px]">
                ملف هوية الرشودي
              </h1>
              <p className="text-[12px] text-muted-foreground">الملف التعريفي — سبتمبر 2026</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={profileAsset.url}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
            >
              <ExternalLink className="size-4" />
              فتح مباشر
            </a>
            <a
              href={profileAsset.url}
              download="ملف-هوية-الرشودي.pdf"
              className={cn(buttonVariants({ size: "sm" }), "gap-2")}
            >
              <Download className="size-4" />
              تنزيل
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col p-2 sm:p-4">
        <object
          data={profileAsset.url}
          type="application/pdf"
          aria-label="ملف هوية الرشودي"
          className="min-h-[calc(100svh-90px)] w-full flex-1 rounded-lg border border-border bg-card"
        >
          <div className="flex min-h-[70svh] flex-col items-center justify-center gap-4 px-5 text-center">
            <p className="text-[14px] text-muted-foreground">متصفحك لا يدعم عرض الملف داخل الصفحة.</p>
            <a href={profileAsset.url} className={buttonVariants()}>
              فتح ملف الهوية
            </a>
          </div>
        </object>
      </section>
    </main>
  );
}