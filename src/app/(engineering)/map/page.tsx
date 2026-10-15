import type { Metadata } from "next";
import { MapPageView } from "@/components/map/MapPageView";

export const metadata: Metadata = { title: "Utility Map" };

export default function MapPage() {
  return <MapPageView />;
}
