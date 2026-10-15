import type { Metadata } from "next";
import { ConflictsView } from "@/components/review-queue/ConflictsView";

export const metadata: Metadata = { title: "Conflicts" };

export default function ConflictsPage() {
  return <ConflictsView />;
}
