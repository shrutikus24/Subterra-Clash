"use client";

import { ArrowRight, ListChecks } from "lucide-react";
import Link from "next/link";
import { SpatialViewCard } from "@/components/underground3d/SpatialViewCard";
import { ReviewQueueTable } from "@/components/review-queue/ReviewQueueTable";
import { TimelinePanel } from "@/components/timeline/TimelinePanel";
import { formatDate } from "@/lib/format";
import { useDashboard } from "./DashboardProvider";
import { ConflictActivity, DataQualityCard, SeverityDistribution, SummaryCards } from "./overview-cards";
import { PageHeader } from "./PageHeader";
import { Panel } from "./Panel";

export function OverviewView() {
  const { analysisDate, rankedClashes } = useDashboard();
  return (
    <>
      <PageHeader
        title="Underground Infrastructure Overview"
        subtitle={`Potential conflicts between buried utilities and proposed excavations, analysed ${formatDate(analysisDate)} on synthetic demonstration data.`}
        actions={
          <Link
            href="/conflicts"
            className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/90"
          >
            Review conflicts <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <SummaryCards className="lg:col-span-7" />
        <SeverityDistribution className="lg:col-span-5" />

        <SpatialViewCard className="lg:col-span-8" heightClass="h-[360px] sm:h-[440px]" />
        <ConflictActivity className="lg:col-span-4" />

        <Panel
          title="Review Queue"
          subtitle="Top conflicts by review priority · select a row to locate it on the map"
          icon={ListChecks}
          className="lg:col-span-8"
          actions={
            <Link href="/conflicts" className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-sunken">
              Open review
            </Link>
          }
        >
          <ReviewQueueTable clashes={rankedClashes.slice(0, 6)} />
        </Panel>
        <DataQualityCard className="lg:col-span-4" />

        <TimelinePanel className="lg:col-span-12" />
      </div>
    </>
  );
}
