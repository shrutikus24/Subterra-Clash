"use client";

import type { ReactNode } from "react";
import { UtilitySwatch } from "@/components/dashboard/badges";
import { SEVERITY_META } from "@/components/dashboard/meta";
import { SEVERITY_PRIORITY } from "@/lib/reports";
import { UTILITY_TYPES, type UtilityType } from "@/types";

export const ALL_TYPES_VISIBLE = Object.fromEntries(UTILITY_TYPES.map((t) => [t, true])) as Record<UtilityType, boolean>;

interface LayerControlsProps {
  id: string;
  open: boolean;
  visibleTypes: Record<UtilityType, boolean>;
  onVisibleTypesChange: (next: Record<UtilityType, boolean>) => void;
  showExcavations: boolean;
  onShowExcavationsChange: (show: boolean) => void;
  showConflicts: boolean;
  onShowConflictsChange: (show: boolean) => void;
  /** Additional controls (e.g. 3D vertical exaggeration). */
  extra?: ReactNode;
  /** Explain the 2D conflict markers. */
  showMarkerNote?: boolean;
}

/** Utility-type legend with visibility toggles, shared by the 2D map and 3D view. */
export function LayerControls({
  id,
  open,
  visibleTypes,
  onVisibleTypesChange,
  showExcavations,
  onShowExcavationsChange,
  showConflicts,
  onShowConflictsChange,
  extra,
  showMarkerNote = false,
}: LayerControlsProps) {
  return (
    <div id={id} className={`${open ? "grid" : "hidden"} gap-3 sm:grid-cols-2 lg:grid lg:w-56 lg:grid-cols-1 lg:content-start`}>
      <fieldset className="rounded-2xl border border-line p-3">
        <legend className="px-1 text-xs font-medium text-ink-3">Utility types</legend>
        <ul className="grid gap-1.5">
          {UTILITY_TYPES.map((type) => (
            <li key={type}>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1 py-0.5 hover:bg-sunken">
                <UtilitySwatch type={type} />
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  checked={visibleTypes[type]}
                  onChange={(e) => onVisibleTypesChange({ ...visibleTypes, [type]: e.target.checked })}
                />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <fieldset className="rounded-2xl border border-line p-3">
        <legend className="px-1 text-xs font-medium text-ink-3">Layers</legend>
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-xs text-ink-2 hover:bg-sunken">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm border border-ink bg-ink/20" aria-hidden />
            Excavation corridors
          </span>
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={showExcavations}
            onChange={(e) => onShowExcavationsChange(e.target.checked)}
          />
        </label>
        <label className="mt-1.5 flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-xs text-ink-2 hover:bg-sunken">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-full bg-sev-critical/40" aria-hidden />
            Conflict highlights
          </span>
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={showConflicts}
            onChange={(e) => onShowConflictsChange(e.target.checked)}
          />
        </label>
        {/* Severity is never colour-only: each halo colour is keyed to its icon and label here. */}
        <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 px-1" aria-label="Severity key">
          {SEVERITY_PRIORITY.map((sev) => {
            const meta = SEVERITY_META[sev];
            const Icon = meta.icon;
            return (
              <li key={sev} className="inline-flex items-center gap-1 text-[11px] text-ink-2">
                <Icon className="size-3.5 shrink-0" style={{ color: meta.color }} aria-hidden />
                {meta.label}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 px-1 text-[11px] leading-snug text-ink-3">
          Halo colour shows the asset&apos;s highest-severity result. Cyan marks the current selection. Cancelled works
          are grey.
          {showMarkerNote &&
            " Dots mark where recorded centrelines cross, or their closest approach — a display aid, not a surveyed clash point."}
        </p>
      </fieldset>
      {extra}
    </div>
  );
}
