import type { Metadata } from "next";
import { ScheduleView } from "@/components/timeline/ScheduleView";

export const metadata: Metadata = { title: "Excavation Schedule" };

export default function SchedulePage() {
  return <ScheduleView />;
}
