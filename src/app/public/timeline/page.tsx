import type { Metadata } from "next";
import { PublicTimelineView } from "@/components/public/PublicTimelineView";

export const metadata: Metadata = { title: "Timeline and notices" };

export default function PublicTimelinePage() {
  return <PublicTimelineView />;
}
