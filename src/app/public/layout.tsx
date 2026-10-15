import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicDataProvider } from "@/components/public/PublicDataProvider";
import { PublicShell } from "@/components/public/PublicShell";
import { getDashboardData } from "@/lib/data";
import { buildPublicData } from "@/lib/public";

export const metadata: Metadata = {
  title: { default: "Public Works Portal", template: "%s · Public Works Portal" },
  description: "Read-only information on planned street works and potential underground conflicts. Synthetic demonstration data.",
};

/**
 * Public transparency portal. The public view model is built here on the server, so only
 * public-safe fields are serialised to the browser; the engineering dataset stays server-side.
 */
export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { dataset, analysisDate } = getDashboardData();
  return (
    <PublicDataProvider data={buildPublicData(dataset, analysisDate)}>
      <PublicShell>{children}</PublicShell>
    </PublicDataProvider>
  );
}
