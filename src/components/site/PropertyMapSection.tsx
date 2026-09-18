import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import type { PublicProperty } from "@/lib/site-data";

const PropertyMap = lazy(() =>
  import("@/components/site/PropertyMap").then((m) => ({ default: m.PropertyMap })),
);

const Placeholder = () => (
  <section className="mx-auto max-w-6xl px-4 py-14">
    <div className="h-[420px] w-full animate-pulse rounded-xl border border-border bg-secondary/60 sm:h-[520px] lg:h-[600px]" />
  </section>
);

export function PropertyMapSection(props: {
  properties: PublicProperty[] | undefined;
  title?: string;
  description?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || shouldLoad) return;
    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={rootRef}>
      {shouldLoad ? (
        <ClientOnly fallback={<Placeholder />}>
          <Suspense fallback={<Placeholder />}>
            <PropertyMap {...props} />
          </Suspense>
        </ClientOnly>
      ) : (
        <Placeholder />
      )}
    </div>
  );
}
