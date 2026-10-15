"use client";

import { MousePointerClick } from "lucide-react";
import { SeverityBadge, UtilitySwatch, WorkStatusPill } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { EmptyState } from "@/components/dashboard/Panel";
import { formatDate, formatDateRange, formatDiameter, formatMetres, shortClashId } from "@/lib/format";

function Field({ label, value }: { label: string; value: string }) {
  const missing = value === "Not recorded";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className={`truncate text-sm ${missing ? "text-ink-3 italic" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

/** Details of the asset or excavation selected on the map, with links to its conflicts. */
export function SelectedFeatureDetails({ className = "" }: { className?: string }) {
  const { selectedFeature, assetById, excavationById, clashesByAsset, rankedClashes, selectClash, selectedClash } =
    useDashboard();

  if (!selectedFeature) {
    return (
      <div className={className}>
        <EmptyState icon={MousePointerClick} title="Nothing selected">
          Click a utility line or excavation corridor on the map, or choose a conflict from the list.
        </EmptyState>
      </div>
    );
  }

  const related =
    selectedFeature.kind === "asset"
      ? (clashesByAsset.get(selectedFeature.id) ?? [])
      : rankedClashes.filter((c) => c.excavationId === selectedFeature.id);

  const asset = selectedFeature.kind === "asset" ? assetById.get(selectedFeature.id) : undefined;
  const excavation = selectedFeature.kind === "excavation" ? excavationById.get(selectedFeature.id) : undefined;

  return (
    <div className={`rounded-2xl border border-line bg-sunken p-4 ${className}`}>
      {asset && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{asset.name}</p>
            <UtilitySwatch type={asset.type} />
            <span className="font-mono text-xs text-ink-3">{asset.id}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Depth to top" value={formatMetres(asset.depthM)} />
            <Field label="Depth uncertainty" value={asset.depthUncertaintyM === undefined ? "Not recorded" : `± ${formatMetres(asset.depthUncertaintyM)}`} />
            <Field label="Diameter" value={formatDiameter(asset.diameterM)} />
            <Field label="Position uncertainty" value={asset.horizontalUncertaintyM === undefined ? "Not recorded" : `± ${formatMetres(asset.horizontalUncertaintyM)}`} />
            <Field label="Survey date" value={asset.surveyDate ? formatDate(asset.surveyDate) : "Not recorded"} />
            <Field label="Record quality" value={asset.dataQuality?.confidence ?? "Not recorded"} />
            <Field label="Owner" value={asset.owner ?? "Not recorded"} />
            <Field label="Source" value={asset.source} />
          </dl>
          {asset.dataQuality?.notes && <p className="mt-2 text-xs text-ink-2">Note: {asset.dataQuality.notes}</p>}
        </>
      )}
      {excavation && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{excavation.name}</p>
            <WorkStatusPill status={excavation.status} />
            <span className="font-mono text-xs text-ink-3">{excavation.id}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Planned depth" value={formatMetres(excavation.plannedDepthM)} />
            <Field label="Corridor width" value={formatMetres(excavation.widthM)} />
            <Field label="Schedule" value={formatDateRange(excavation.schedule.startDate, excavation.schedule.endDate)} />
            <Field label="Contractor" value={excavation.contractor ?? "Not recorded"} />
          </dl>
          {excavation.status === "cancelled" && (
            <p className="mt-2 text-xs text-ink-2">Cancelled works are excluded from clash detection.</p>
          )}
        </>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <p className="text-xs font-medium text-ink-3">
          {related.length ? `Detected conflicts (${related.length})` : "No conflicts detected for this feature under current assumptions."}
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-2">
          {related.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => selectClash(c.id)}
                aria-pressed={selectedClash?.id === c.id}
                className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
                  selectedClash?.id === c.id ? "border-accent bg-accent-soft" : "border-line bg-card hover:bg-sunken"
                }`}
              >
                <span className="font-mono">{shortClashId(c.id)}</span>
                <SeverityBadge severity={c.severity} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
