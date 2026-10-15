import type { Metadata } from "next";
import { Suspense } from "react";
import { MapLoading } from "@/components/map/ClientMap";
import { PublicMapPage } from "@/components/public/PublicMapPage";

export const metadata: Metadata = { title: "Works map" };

export default function PublicWorksMapPage() {
  // The selected work is read from the URL, which needs a Suspense boundary on a static page.
  return (
    <Suspense fallback={<div className="h-[360px] overflow-hidden rounded-3xl"><MapLoading /></div>}>
      <PublicMapPage />
    </Suspense>
  );
}
