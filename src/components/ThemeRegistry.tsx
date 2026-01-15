"use client";

import { useState } from "react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { useServerInsertedHTML } from "next/navigation";

// Minimal Emotion cache provider for App Router to keep SSR/CSR styles in sync
export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [cache] = useState(() => {
    const c = createCache({ key: "mui", prepend: true });
    c.compat = true;
    return c;
  });

  useServerInsertedHTML(() => (
    <style
      data-emotion={`${cache.key} ${Object.keys(cache.inserted).join(" ")}`}
      dangerouslySetInnerHTML={{ __html: Object.values(cache.inserted).join(" ") }}
    />
  ));

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
