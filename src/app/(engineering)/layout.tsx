import type { ReactNode } from "react";
import { DashboardProvider } from "@/components/dashboard/DashboardProvider";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getDashboardData } from "@/lib/data";

/** Engineering dashboard: full dataset, review state and engine evidence. */
export default function EngineeringLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <DashboardProvider data={getDashboardData()}>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  );
}
