import type { Metadata } from "next";
import { PlannedWorksView } from "@/components/public/PlannedWorksView";

export const metadata: Metadata = { title: "Planned works" };

export default function PlannedWorksPage() {
  return <PlannedWorksView />;
}
