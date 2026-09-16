import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { publicSettingsQuery, whatsappLink } from "@/lib/site-data";

/** شريط تقدّم التمرير أعلى الصفحة. */
export function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent">
      <div className="h-full bg-gold transition-[width] duration-150" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** زر الرجوع لأعلى + واتساب سريع. */
export function FloatingActions() {
  const [show, setShow] = useState(false);
  const settings = useQuery(publicSettingsQuery);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed bottom-20 end-4 z-40 flex flex-col items-center gap-2 sm:bottom-28 sm:end-5 sm:gap-3">
      {show ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="الرجوع لأعلى"
          className="glass grid size-8 place-items-center rounded-full text-foreground shadow-float transition-transform hover:-translate-y-1 sm:size-11"
        >
          <ArrowUp className="size-4 sm:size-5" />
        </button>
      ) : null}
      <a
        href={whatsappLink(settings.data?.whatsapp_number, "السلام عليكم، أرغب في الاستفسار عن عقار")}
        target="_blank"
        rel="noreferrer"
        aria-label="تواصل واتساب"
        className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-float transition-transform hover:scale-105 sm:size-16"
      >
        <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 fill-current sm:size-9">
          <path d="M16.04 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.73 6.4L3.2 28.8l6.57-1.72a12.74 12.74 0 0 0 6.27 1.6h.01c7.05 0 12.79-5.74 12.79-12.8 0-3.42-1.33-6.63-3.75-9.05a12.7 12.7 0 0 0-9.05-3.63Zm0 23.04h-.01c-1.95 0-3.86-.52-5.53-1.51l-.4-.24-4.1 1.08 1.09-4-.26-.41a10.6 10.6 0 0 1-1.63-5.66c0-5.87 4.78-10.64 10.65-10.64 2.84 0 5.51 1.11 7.52 3.12a10.57 10.57 0 0 1 3.12 7.53c0 5.87-4.78 10.73-10.45 10.73Zm5.84-7.98c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.18-.32-.02-.5.14-.66.15-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.73-.98-2.36-.26-.62-.52-.54-.71-.55l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65s1.14 3.08 1.3 3.29c.16.21 2.24 3.42 5.43 4.79.76.33 1.35.53 1.81.68.76.24 1.45.21 2 .13.61-.09 1.89-.77 2.15-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
        </svg>
      </a>
    </div>
  );
}
