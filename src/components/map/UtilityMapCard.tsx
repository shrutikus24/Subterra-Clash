"use client";

import { Layers, Map as MapIcon, Maximize2, TriangleAlert } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { EmptyState, Panel } from "@/components/dashboard/Panel";
import { ClientMap, MapLoading } from "./ClientMap";
import { ALL_TYPES_VISIBLE, LayerControls } from "./LayerControls";
import type { MapStatus } from "./MapView";
import { SelectedFeatureDetails } from "./SelectedFeatureDetails";

interface UtilityMapCardProps {
  className?: string;
  mapHeightClass?: string;
  showDetails?: boolean;
  title?: string;
  /** Optional 2D/3D selector rendered in the card header. */
  viewSwitcher?: ReactNode;
}

export function UtilityMapCard({
  className = "",
  mapHeightClass = "h-[420px]",
  showDetails = false,
  title = "Utility Network Map",
  viewSwitcher,
}: UtilityMapCardProps) {
  const { dataset, summary } = useDashboard();
  const controlsId = useId();
  const [visibleTypes, setVisibleTypes] = useState(ALL_TYPES_VISIBLE);
  const [showExcavations, setShowExcavations] = useState(true);
  const [showConflicts, setShowConflicts] = useState(true);
  const [fitAllRequest, setFitAllRequest] = useState(0);
  const [status, setStatus] = useState<MapStatus>({ state: "loading" });
  const [controlsOpen, setControlsOpen] = useState(false);

  const empty = dataset.assets.length === 0 && dataset.excavations.length === 0;

  return (
    <Panel
      title={title}
      subtitle={`${summary.totalAssets} utility assets · ${summary.totalExcavations} excavation corridors · click a line to select`}
      icon={MapIcon}
      className={className}
      actions={
        <>
          {viewSwitcher}
          <button
            type="button"
            onClick={() => setControlsOpen((o) => !o)}
            aria-expanded={controlsOpen}
            aria-controls={controlsId}
            className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm hover:bg-sunken lg:hidden"
          >
            <Layers className="size-4" aria-hidden /> Layers
          </button>
          <button
            type="button"
            onClick={() => setFitAllRequest((n) => n + 1)}
            disabled={status.state !== "ready"}
            className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm hover:bg-sunken disabled:opacity-50"
          >
            <Maximize2 className="size-4" aria-hidden /> Fit to data
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 lg:flex-row">
        {/* flex-1 only in row layout: in a column, flex-basis 0 would override the fixed height. */}
        <div className={`relative w-full min-w-0 overflow-hidden rounded-2xl border border-line lg:flex-1 ${mapHeightClass}`}>
          {empty ? (
            <EmptyState icon={MapIcon} title="No geometry to display">
              The dataset contains no utility assets or excavation corridors.
            </EmptyState>
          ) : status.state === "error" ? (
            <EmptyState icon={TriangleAlert} title="Map unavailable">
              {status.message} The conflict list and reports still work.
            </EmptyState>
          ) : (
            <>
              <ClientMap
                visibleTypes={visibleTypes}
                showExcavations={showExcavations}
                showConflicts={showConflicts}
                fitAllRequest={fitAllRequest}
                onStatus={setStatus}
              />
              {status.state === "loading" && (
                <div className="absolute inset-0">
                  <MapLoading />
                </div>
              )}
              {status.state === "ready" && status.basemapError && (
                <p className="absolute bottom-2 left-2 rounded-full bg-card/95 px-3 py-1 text-xs text-ink-2 shadow-sm">
                  Basemap tiles unavailable; data layers are still shown.
                </p>
              )}
            </>
          )}
        </div>

        <LayerControls
          id={controlsId}
          open={controlsOpen}
          visibleTypes={visibleTypes}
          onVisibleTypesChange={setVisibleTypes}
          showExcavations={showExcavations}
          onShowExcavationsChange={setShowExcavations}
          showConflicts={showConflicts}
          onShowConflictsChange={setShowConflicts}
          showMarkerNote
        />
      </div>

      {showDetails && <SelectedFeatureDetails className="mt-3" />}
    </Panel>
  );
}
