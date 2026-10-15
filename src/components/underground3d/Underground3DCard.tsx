"use client";

import { Box, Layers, Minus, Plus, RotateCcw, RotateCw, TriangleAlert, Undo2 } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { EmptyState, Panel } from "@/components/dashboard/Panel";
import { ALL_TYPES_VISIBLE, LayerControls } from "@/components/map/LayerControls";
import { SelectedFeatureDetails } from "@/components/map/SelectedFeatureDetails";
import { UTILITY_META } from "@/components/dashboard/meta";
import { buildSceneModel, ILLUSTRATIVE_DEPTH_RANGES_M, type SceneModel } from "@/lib/scene3d/model";
import { UTILITY_TYPES } from "@/types";
import { ClientUnderground3D, Viewer3DLoading } from "./ClientUnderground3D";
import { SelectedClashSummary } from "./SelectedClashSummary";
import { SelectedDepthDetails } from "./SelectedDepthDetails";
import type { ViewerCommand, ViewerStatus } from "./Underground3DView";

const EXAGGERATIONS = [1, 5, 10, 20] as const;

interface Underground3DCardProps {
  className?: string;
  heightClass?: string;
  showDetails?: boolean;
  title?: string;
  viewSwitcher?: ReactNode;
  /**
   * Show the selected clash's engine summary under the scene. When off (an evidence panel is nearby),
   * a compact depth-details strip is shown instead.
   */
  showSummary?: boolean;
}

const toolButton =
  "grid size-9 place-items-center rounded-full border border-line bg-card/95 text-ink-2 shadow-sm hover:bg-sunken hover:text-ink";

export function Underground3DCard({
  className = "",
  heightClass = "h-[420px]",
  showDetails = false,
  title = "3D Underground View",
  viewSwitcher,
  showSummary = true,
}: Underground3DCardProps) {
  const { dataset } = useDashboard();
  const controlsId = useId();
  const hintId = useId();
  const [visibleTypes, setVisibleTypes] = useState(ALL_TYPES_VISIBLE);
  const [showExcavations, setShowExcavations] = useState(true);
  const [showConflicts, setShowConflicts] = useState(true);
  const [exaggeration, setExaggeration] = useState<number>(10);
  const [command, setCommand] = useState<ViewerCommand | null>(null);
  const [status, setStatus] = useState<ViewerStatus>({ state: "loading" });
  const [hover, setHover] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);

  const built = useMemo((): { model: SceneModel } | { error: string } => {
    try {
      return { model: buildSceneModel(dataset) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "The scene could not be built." };
    }
  }, [dataset]);

  const run = (type: ViewerCommand["type"]) => setCommand((c) => ({ type, n: (c?.n ?? 0) + 1 }));
  const onKeyDown = (e: KeyboardEvent) => {
    const map: Record<string, ViewerCommand["type"]> = {
      ArrowLeft: "rotate-left",
      ArrowRight: "rotate-right",
      "+": "zoom-in",
      "=": "zoom-in",
      "-": "zoom-out",
      r: "reset",
      R: "reset",
    };
    const type = map[e.key];
    if (type) {
      e.preventDefault();
      run(type);
    }
  };

  const ready = status.state === "ready";
  const errorMessage = "error" in built ? built.error : status.state === "error" ? status.message : null;

  return (
    <Panel
      title={title}
      subtitle={`Schematic, not a certified engineering model · synthetic data · vertical exaggeration ×${exaggeration}`}
      icon={Box}
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
            onClick={() => run("reset")}
            disabled={!ready}
            className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm hover:bg-sunken disabled:opacity-50"
          >
            <Undo2 className="size-4" aria-hidden /> Reset view
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 lg:flex-row">
        <div
          className={`relative w-full min-w-0 overflow-hidden rounded-2xl border border-line bg-shell lg:flex-1 ${heightClass}`}
          tabIndex={0}
          role="group"
          aria-label="3D underground view"
          aria-describedby={hintId}
          onKeyDown={onKeyDown}
        >
          {errorMessage ? (
            <EmptyState icon={TriangleAlert} title="3D view unavailable">
              {errorMessage} The 2D map, conflict list and cross-section still work.
            </EmptyState>
          ) : dataset.assets.length + dataset.excavations.length === 0 ? (
            <EmptyState icon={Box} title="No geometry to display" />
          ) : (
            "model" in built && (
              <>
                <ClientUnderground3D
                  model={built.model}
                  visibleTypes={visibleTypes}
                  showExcavations={showExcavations}
                  showConflicts={showConflicts}
                  exaggeration={exaggeration}
                  command={command}
                  onStatus={setStatus}
                  onHover={setHover}
                />
                {status.state === "loading" && (
                  <div className="absolute inset-0">
                    <Viewer3DLoading />
                  </div>
                )}
                {hover && (
                  <p className="pointer-events-none absolute top-2 left-2 max-w-[70%] truncate rounded-full bg-card/95 px-3 py-1 text-xs shadow-sm">
                    {hover}
                  </p>
                )}
                <p className="pointer-events-none absolute top-2 right-2 hidden rounded-full bg-ink/85 px-3 py-1 text-[11px] text-white sm:block">
                  Synthetic demonstration data
                </p>
                <div className="absolute bottom-2 left-2 flex gap-1.5" role="toolbar" aria-label="Camera">
                  <button type="button" className={toolButton} onClick={() => run("rotate-left")} aria-label="Rotate left" title="Rotate left (←)">
                    <RotateCcw className="size-4" aria-hidden />
                  </button>
                  <button type="button" className={toolButton} onClick={() => run("rotate-right")} aria-label="Rotate right" title="Rotate right (→)">
                    <RotateCw className="size-4" aria-hidden />
                  </button>
                  <button type="button" className={toolButton} onClick={() => run("zoom-in")} aria-label="Zoom in" title="Zoom in (+)">
                    <Plus className="size-4" aria-hidden />
                  </button>
                  <button type="button" className={toolButton} onClick={() => run("zoom-out")} aria-label="Zoom out" title="Zoom out (−)">
                    <Minus className="size-4" aria-hidden />
                  </button>
                </div>
                <p id={hintId} className="pointer-events-none absolute right-2 bottom-2 hidden rounded-full bg-card/95 px-3 py-1 text-[11px] text-ink-3 sm:block">
                  Drag to orbit · scroll to zoom · right-drag to pan · keys ← → + − R
                </p>
              </>
            )
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
          extra={
            <>
              <fieldset className="rounded-2xl border border-line p-3">
                <legend className="px-1 text-xs font-medium text-ink-3">Vertical exaggeration</legend>
                <div className="flex gap-1">
                  {EXAGGERATIONS.map((x) => (
                    <button
                      key={x}
                      type="button"
                      aria-pressed={exaggeration === x}
                      onClick={() => setExaggeration(x)}
                      className={`flex-1 rounded-full px-2 py-1 text-xs ${exaggeration === x ? "bg-ink text-white" : "bg-sunken text-ink-2 hover:bg-line"}`}
                    >
                      ×{x}
                    </button>
                  ))}
                </div>
                <p className="mt-2 px-1 text-[11px] leading-snug text-ink-3">
                  Visualization only: depths are stretched for legibility and the ruler shows true metres. Faint ribbons
                  show recorded depth tolerance; unknown depths appear as full-height curtains, not a guessed position.
                </p>
              </fieldset>
              <details className="rounded-2xl border border-line p-3 text-[11px] text-ink-3">
                <summary className="cursor-pointer text-xs font-medium text-ink-3">Illustrative depth ranges</summary>
                <ul className="mt-2 space-y-0.5">
                  {UTILITY_TYPES.map((t) => (
                    <li key={t} className="flex justify-between gap-2">
                      <span>{UTILITY_META[t].label}</span>
                      <span className="tabular-nums text-ink-2">
                        {ILLUSTRATIVE_DEPTH_RANGES_M[t][0]}–{ILLUSTRATIVE_DEPTH_RANGES_M[t][1]} m
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 leading-snug">
                  Demo reference only, not installation standards. The scene always uses each record&apos;s own depth.
                </p>
              </details>
            </>
          }
        />
      </div>

      {showSummary ? <SelectedClashSummary className="mt-3" /> : <SelectedDepthDetails className="mt-3" />}
      {showDetails && <SelectedFeatureDetails className="mt-3" />}
    </Panel>
  );
}
