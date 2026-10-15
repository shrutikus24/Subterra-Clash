import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DashboardProvider } from "@/components/dashboard/DashboardProvider";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getDashboardData } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Subterra Clash", template: "%s · Subterra Clash" },
  description: "Detecting conflicts in shared underground works. Synthetic demonstration data.",
};

export const viewport: Viewport = { themeColor: "#e8e8e6" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <DashboardProvider data={getDashboardData()}>
          <DashboardShell>{children}</DashboardShell>
        </DashboardProvider>
      </body>
    </html>
  );
}
