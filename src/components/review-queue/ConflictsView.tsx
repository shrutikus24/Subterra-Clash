"use client";

import { ListChecks } from "lucide-react";
import { CrossSectionPanel } from "@/components/cross-section/CrossSectionPanel";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { SpatialViewCard } from "@/components/underground3d/SpatialViewCard";
import { ConflictDetail } from "./ConflictDetail";
import { ConflictFilters } from "./ConflictFilters";
import { ReviewQueueTable } from "./ReviewQueueTable";
import { useAutoSelectFirst } from "./useAutoSelectFirst";

export function ConflictsView() {
  const { filteredClashes } = useDashboard();
  useAutoSelectFirst();

  return (
    <>
      <PageHeader
        title="Conflict Review"
        subtitle="Engine results ranked by review priority. Recommendations support engineering judgement; they do not approve or reject excavation permits."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <ConflictFilters />
        </div>
        <Panel title="Review Queue" icon={ListChecks} className="xl:col-span-12">
          <ReviewQueueTable clashes={filteredClashes} />
        </Panel>
        <ConflictDetail className="xl:col-span-5" />
        <div className="grid content-start gap-4 xl:col-span-7">
          <CrossSectionPanel />
          <SpatialViewCard heightClass="h-[380px]" title2d="Location" title3d="Location · 3D" />
        </div>
      </div>
    </>
  );
}
