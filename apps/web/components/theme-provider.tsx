"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Temporary workaround for React 19 + next-themes warning
if (typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args) => {
    const isScriptError = typeof args[0] === "string" && args[0].includes("Encountered a script tag while rendering React component");
    if (isScriptError) return;
    originalError(...args);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
