import type { Metadata } from "next";
import { PublicConflictsView } from "@/components/public/PublicConflictsView";

export const metadata: Metadata = { title: "Conflict findings" };

export default function PublicConflictsPage() {
  return <PublicConflictsView />;
}
