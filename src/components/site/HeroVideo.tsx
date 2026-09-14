import { Link } from "@tanstack/react-router";
import { MapPinned, Search } from "lucide-react";

import desktopHero from "@/assets/home-hero-desktop.jpg";
import desktopHeroVideo from "@/assets/hero-desktop.mp4.asset.json";

import mobileHero from "@/assets/home-hero-mobile.jpg";
import mobileHeroVideo from "@/assets/hero-mobile.mp4.asset.json";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeroVideoProps = {
  types: string[];
  districts: string[];
  rentPeriods: string[];
  type: string;
  district: string;
  rentPeriod: string;
  onTypeChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onRentPeriodChange: (value: string) => void;
  onSearch: () => void;
};

const selectClass =
  "h-14 w-full rounded-xl border border-input bg-card px-4 text-[14px] text-card-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 md:h-16 md:text-[15px]";

export function HeroVideo({
  types,
  districts,
  rentPeriods,
  type,
  district,
  rentPeriod,
  onTypeChange,
  onDistrictChange,
  onRentPeriodChange,
  onSearch,
}: HeroVideoProps) {

  return (
    <section className="relative isolate min-h-[760px] overflow-hidden bg-foreground md:min-h-[760px] lg:min-h-[calc(100svh-74px)]">
      <video
        aria-hidden
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={mobileHero}
        src={mobileHeroVideo.url}
        className="absolute inset-0 -z-20 size-full object-cover object-center md:hidden"
      />
      <video
        aria-hidden
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={desktopHero}
        src={desktopHeroVideo.url}
        className="absolute inset-0 -z-20 hidden size-full object-cover object-center md:block"
      />
      <picture aria-hidden className="pointer-events-none absolute inset-0 -z-30">
        <source media="(max-width: 767px)" srcSet={mobileHero} />
        <img src={desktopHero} alt="" className="size-full object-cover object-center" />
      </picture>
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-foreground/55 via-foreground/20 to-foreground/65"
      />

      <div className="mx-auto flex min-h-[760px] w-full max-w-7xl flex-col justify-between px-4 pb-7 pt-14 text-center md:min-h-[760px] md:px-8 md:pb-10 md:pt-20 lg:min-h-[calc(100svh-74px)]">
        <div className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center py-8 md:py-12">
          <h1 className="animate-pop-in flex w-full flex-col items-center gap-2 font-hero font-bold leading-[1.25] md:gap-4">
            <span className="text-[13px] tracking-wide text-primary-foreground/80 sm:text-[15px] md:text-[19px]">
              خبرةٌ محلية.. وقرارٌ عقاري أوضح
            </span>
            <span className="hero-title-shadow mt-1 text-[42px] text-primary-foreground sm:text-[64px] md:mt-2 md:text-[92px] lg:text-[110px]">
              الرشودي للعقارات
            </span>
            <span className="hero-accent-text mt-1 text-[22px] sm:text-[30px] md:mt-2 md:text-[44px] lg:text-[52px]">
              تعرف بريدة.. ونفهم العقار
            </span>
          </h1>
          <p className="animate-pop-in mt-5 max-w-4xl text-[15px] font-medium leading-8 text-primary-foreground/85 sm:text-[17px] md:mt-7 md:text-[22px] md:leading-10">
            نسمع احتياجك، ونرشح لك الأنسب للبيع أو الإيجار، ونمشي معك حتى اكتمال الصفقة بخبرة تمتد لأكثر من 8 سنوات.
          </p>

          <div className="animate-pop-in mt-7 grid w-full max-w-3xl grid-cols-3 gap-2.5 md:mt-9 md:gap-5">
            <Link
              to="/rent"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-14 rounded-full border-primary-foreground/35 bg-card/10 px-2 text-[13px] font-bold text-primary-foreground shadow-none backdrop-blur-sm hover:bg-primary-foreground/10 hover:text-primary-foreground md:h-16 md:text-[18px]",
              )}
            >
              تصفح الإيجار
            </Link>
            <Link
              to="/sale"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-14 rounded-full border-primary-foreground/35 bg-card/10 px-2 text-[13px] font-bold text-primary-foreground shadow-none backdrop-blur-sm hover:bg-primary-foreground/10 hover:text-primary-foreground md:h-16 md:text-[18px]",
              )}
            >
              تصفح البيع
            </Link>
            <a
              href="#property-map"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-14 rounded-full border-primary-foreground/35 bg-card/10 px-2 text-[13px] font-bold text-primary-foreground shadow-none backdrop-blur-sm hover:bg-primary-foreground/10 hover:text-primary-foreground md:h-16 md:text-[18px]",
              )}
            >
              <MapPinned className="hidden size-5 sm:block" />
              الخريطة
            </a>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl rounded-[28px] bg-card p-4 text-right shadow-float md:rounded-[34px] md:p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <label className="min-w-0">
              <span className="mb-2 block text-[13px] font-bold text-card-foreground md:text-[15px]">نوع العقار</span>
              <select
                value={type}
                onChange={(event) => onTypeChange(event.target.value)}
                className={selectClass}
              >
                <option value="">كل الأنواع</option>
                {types.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-2 block text-[13px] font-bold text-card-foreground md:text-[15px]">الحي</span>
              <select
                value={district}
                onChange={(event) => onDistrictChange(event.target.value)}
                className={selectClass}
              >
                <option value="">كل الأحياء</option>
                {districts.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-2 block text-[13px] font-bold text-card-foreground md:text-[15px]">مدة الإيجار</span>
              <select
                value={rentPeriod}
                onChange={(event) => onRentPeriodChange(event.target.value)}
                className={selectClass}
              >
                <option value="">كل المدد</option>
                {rentPeriods.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="flex min-w-0 flex-col justify-end">
              <span aria-hidden className="mb-2 hidden text-[15px] font-bold md:block">&nbsp;</span>
              <Button
                type="button"
                onClick={onSearch}
                className="h-14 w-full rounded-xl text-[15px] font-bold md:h-16 md:text-[17px]"
              >
                <Search className="size-5" />
                بحث
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
