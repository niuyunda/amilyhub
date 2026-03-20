"use client";

import type { ComponentProps } from "react";
import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = ComponentProps<typeof SonnerToaster>;

const Toaster = ({ ...props }: ToasterProps) => {
  return <SonnerToaster richColors closeButton position="top-right" {...props} />;
};

export { Toaster };
