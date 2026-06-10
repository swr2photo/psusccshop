"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

// Official MUI + Next.js App Router cache — keeps Emotion SSR/CSR class names in sync
export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui", prepend: true }}>
      {children}
    </AppRouterCacheProvider>
  );
}
