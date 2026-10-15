import type { Metadata } from "next";
import { InspectionReport } from "@/components/reports/InspectionReport";

export const metadata: Metadata = { title: "Inspection report" };

export default function InspectionReportPage() {
  return <InspectionReport />;
}
