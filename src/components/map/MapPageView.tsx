"use client";

import { FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ConflictListPanel } from "@/components/review-queue/ConflictListPanel";
import { EvidencePanel } from "@/components/review-queue/EvidencePanel";
import { useAutoSelectFirst } from "@/components/review-queue/useAutoSelectFirst";
import { Underground3DCard } from "@/components/underground3d/Underground3DCard";
import { UtilityMapCard } from "./UtilityMapCard";

/** Mapping workspace: conflict list beside the 2D map and 3D viewer, with collapsible evidence below. */
export function MapPageView() {
  useAutoSelectFirst();
  return (
    <>
      <PageHeader
        title="Utility Map"
        subtitle="Select a conflict to see it on the 2D map, in the 3D underground view and in the evidence below. Positions are only as accurate as the synthetic source records."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-2">
            <FlaskConical className="size-3.5 text-accent" aria-hidden /> Synthetic Demonstration Data
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,34fr)_66fr]">
        <ConflictListPanel />
        <div className="grid min-w-0 content-start gap-4">
          <UtilityMapCard title="2D Utility Map" mapHeightClass="h-[340px] sm:h-[380px]" />
          <Underground3DCard heightClass="h-[380px] sm:h-[420px]" showSummary={false} />
        </div>
      </div>
      <EvidencePanel className="mt-4" />
    </>
  );
}
