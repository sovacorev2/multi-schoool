"use client";

import { ClassProvider } from "@/lib/class-context";
import { SchoolProvider } from "@/lib/school-context";
import { ThemeProvider } from "@/lib/theme-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SchoolProvider>
        <ClassProvider>{children}</ClassProvider>
      </SchoolProvider>
    </ThemeProvider>
  );
}
