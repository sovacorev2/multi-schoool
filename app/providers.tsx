"use client";

import { ClassProvider } from "@/lib/class-context";
import { SchoolProvider } from "@/lib/school-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SchoolProvider>
      <ClassProvider>{children}</ClassProvider>
    </SchoolProvider>
  );
}
