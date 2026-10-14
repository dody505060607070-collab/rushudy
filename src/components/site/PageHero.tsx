import type { ReactNode } from "react";

type PageHeroProps = {
  image: string;
  video?: string;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: ReactNode;
  height?: "sm" | "md" | "lg";
};

const heights = {
  sm: "min-h-[280px] md:min-h-[340px]",
  md: "min-h-[360px] md:min-h-[460px]",
  lg: "min-h-[440px] md:min-h-[560px]",
} as const;

/** قسم علوي بصورة (أو فيديو) حقيقية بدون طبقة لون فوق الصورة، مع تدرّج خفيف أسفلها لقراءة النص. */
export function PageHero({
  image,
  video,
  title,
  subtitle,
  eyebrow,
  children,
  height = "md",
}: PageHeroProps) {
  return (
    <section className={`relative isolate flex items-end overflow-hidden bg-foreground ${heights[height]}`}>
      {video ? (
        <video
          src={video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          className="absolute inset-0 -z-10 size-full object-cover"
        />
      ) : (
        <img
          src={image}
          alt={title}
          width={1920}
          height={1080}
          className="absolute inset-0 -z-10 size-full object-cover"
        />
      )}

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
      />

      <div className="mx-auto w-full max-w-6xl px-4 pb-9 pt-24 text-white">
        {eyebrow ? (
          <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold backdrop-blur-md">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="animate-pop-in mt-3 text-[30px] font-extrabold drop-shadow-lg sm:text-[40px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-2xl text-[14px] leading-7 text-white/90 drop-shadow">
            {subtitle}
          </p>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </section>
  );
}
