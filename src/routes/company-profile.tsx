import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Download, ExternalLink } from "lucide-react";

import profileAsset from "@/assets/alrashudi-real-estate-profile.pdf.asset.json";
import page01 from "@/assets/company-profile-page-01.jpg.asset.json";
import page02 from "@/assets/company-profile-page-02.jpg.asset.json";
import page03 from "@/assets/company-profile-page-03.jpg.asset.json";
import page04 from "@/assets/company-profile-page-04.jpg.asset.json";
import page05 from "@/assets/company-profile-page-05.jpg.asset.json";
import page06 from "@/assets/company-profile-page-06.jpg.asset.json";
import page07 from "@/assets/company-profile-page-07.jpg.asset.json";
import page08 from "@/assets/company-profile-page-08.jpg.asset.json";
import page09 from "@/assets/company-profile-page-09.jpg.asset.json";
import page10 from "@/assets/company-profile-page-10.jpg.asset.json";
import page11 from "@/assets/company-profile-page-11.jpg.asset.json";
import page12 from "@/assets/company-profile-page-12.jpg.asset.json";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const profilePages = [page01, page02, page03, page04, page05, page06, page07, page08, page09, page10, page11, page12];

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

      <section className="mx-auto w-full max-w-5xl space-y-3 p-2 sm:space-y-5 sm:p-5">
        {profilePages.map((page, index) => (
          <img
            key={page.url}
            src={page.url}
            alt={`ملف هوية الرشودي — صفحة ${index + 1}`}
            width={935}
            height={1210}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            className="h-auto w-full rounded-lg border border-border bg-card shadow-card"
          />
        ))}
      </section>
    </main>
  );
}