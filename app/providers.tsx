"use client";

import { ClassProvider } from "@/lib/class-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <ClassProvider>{children}</ClassProvider>;
}
