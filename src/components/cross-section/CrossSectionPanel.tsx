"use client";

import { Rows3 } from "lucide-react";
import { SeverityBadge } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { EmptyState, Panel } from "@/components/dashboard/Panel";
import { shortClashId } from "@/lib/format";
import { CrossSection } from "./CrossSection";

export function CrossSectionPanel({ className = "" }: { className?: string }) {
  const { selectedClash, assetById, excavationById, config } = useDashboard();
  const asset = selectedClash ? assetById.get(selectedClash.affectedAssetIds[0] ?? "") : undefined;
  const excavation = selectedClash ? excavationById.get(selectedClash.excavationId) : undefined;

  return (
    <Panel
      title="Underground Cross-Section"
      subtitle="Schematic · depth to scale, horizontal positions not to scale"
      icon={Rows3}
      className={className}
      actions={selectedClash && <SeverityBadge severity={selectedClash.severity} />}
    >
      {selectedClash && asset && excavation ? (
        <figure>
          <CrossSection
            clash={selectedClash}
            asset={asset}
            excavation={excavation}
            verticalBufferM={config.verticalBufferM}
          />
          <figcaption className="mt-2 text-xs text-ink-3">
            <span className="font-mono">{shortClashId(selectedClash.id)}</span> · Shows recorded depths, tolerances and
            the engine&apos;s vertical clearance. Missing values are marked as unknown, not estimated.
          </figcaption>
        </figure>
      ) : (
        <EmptyState icon={Rows3} title="No conflict selected">
          Select a conflict in the list or on the map to see its schematic cross-section.
        </EmptyState>
      )}
    </Panel>
  );
}
