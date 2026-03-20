import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AmilyHub Dashboard",
  description: "AmilyHub frontend powered by Next.js",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
