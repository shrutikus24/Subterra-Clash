"use client";

import { CalendarClock, ClipboardCheck, FileSearch } from "lucide-react";
import { ConfidenceBadge, SeverityBadge, UtilitySwatch, WorkStatusPill } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { ACTION_LABEL, REASON_LABEL, REVIEW_STATUS_META } from "@/components/dashboard/meta";
import { EmptyState, Panel } from "@/components/dashboard/Panel";
import { formatDateRange, formatMetres, formatSignedMetres, shortClashId } from "@/lib/format";
import { REVIEW_STATUSES, type AssetMeasurementField } from "@/types";

export const FIELD_LABEL: Record<AssetMeasurementField, string> = {
  depthM: "Depth",
  depthUncertaintyM: "Depth uncertainty",
  diameterM: "Diameter",
  horizontalUncertaintyM: "Position uncertainty",
  surveyDate: "Survey date",
};

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const missing = value === "Not recorded";
  return (
    <div className="rounded-2xl bg-sunken p-3">
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tracking-tight ${missing ? "text-base font-normal text-ink-3 italic" : ""}`}>
        {value}
      </dd>
      {hint && <dd className="text-[11px] text-ink-3">{hint}</dd>}
    </div>
  );
}

export function ConflictDetail({ className = "" }: { className?: string }) {
  const { selectedClash: clash, assetById, excavationById, reviewStatusOf, setReviewStatus } = useDashboard();

  if (!clash) {
    return (
      <Panel title="Conflict Details" icon={FileSearch} className={className}>
        <EmptyState icon={FileSearch} title="No conflict selected">
          Choose a conflict from the queue or click a highlighted line on the map.
        </EmptyState>
      </Panel>
    );
  }

  const asset = assetById.get(clash.affectedAssetIds[0] ?? "");
  const excavation = excavationById.get(clash.excavationId);
  const evidence = clash.evidence[0];
  const review = reviewStatusOf(clash.id);

  return (
    <Panel
      title="Conflict Details"
      subtitle={shortClashId(clash.id)}
      icon={FileSearch}
      className={className}
      actions={<SeverityBadge severity={clash.severity} size="md" />}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium">{asset?.name}</span>
          {asset && <UtilitySwatch type={asset.type} />}
          <span className="text-ink-3" aria-hidden>
            ×
          </span>
          <span className="font-medium">{excavation?.name}</span>
          {excavation && <WorkStatusPill status={excavation.status} />}
          <span className="ml-auto">
            <ConfidenceBadge confidence={clash.confidence} />
          </span>
        </div>

        <p className="text-sm leading-relaxed text-ink-2">{clash.explanation}</p>

        <dl className="grid grid-cols-2 gap-2">
          <Metric label="Horizontal distance to corridor edge" value={formatMetres(clash.horizontalDistanceM)} hint={evidence?.combinedHorizontalUncertaintyM !== undefined ? `± ${formatMetres(evidence.combinedHorizontalUncertaintyM)} combined` : undefined} />
          <Metric label="Vertical clearance" value={formatSignedMetres(clash.verticalClearanceM)} hint={evidence?.combinedDepthUncertaintyM !== undefined ? `± ${formatMetres(evidence.combinedDepthUncertaintyM)} combined` : "Cannot be calculated"} />
        </dl>

        <section aria-labelledby="reasons-h">
          <h3 id="reasons-h" className="text-xs font-medium text-ink-3">
            Reason codes
          </h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {clash.reasonCodes.map((code) => (
              <li key={code} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2" title={code}>
                {REASON_LABEL[code]}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="action-h" className="rounded-2xl border border-accent/30 bg-accent-soft p-3">
          <h3 id="action-h" className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <ClipboardCheck className="size-3.5" aria-hidden /> Recommended inspection: {ACTION_LABEL[clash.recommendedAction.action]}
          </h3>
          <p className="mt-1 text-sm text-ink">{clash.recommendedAction.summary}</p>
        </section>

        <section aria-labelledby="schedule-h">
          <h3 id="schedule-h" className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
            <CalendarClock className="size-3.5" aria-hidden /> Schedule
          </h3>
          {excavation && (
            <p className="mt-1 text-sm text-ink-2">
              This work: {formatDateRange(excavation.schedule.startDate, excavation.schedule.endDate)}
            </p>
          )}
          <p className="mt-0.5 text-sm text-ink-2">
            {clash.scheduleOverlap.hasOverlap && clash.scheduleOverlap.overlapWindow
              ? `Overlaps with ${clash.scheduleOverlap.overlappingExcavationIds
                  .map((id) => excavationById.get(id)?.name ?? id)
                  .join(", ")} on this asset: ${formatDateRange(
                  clash.scheduleOverlap.overlapWindow.startDate,
                  clash.scheduleOverlap.overlapWindow.endDate,
                )}.`
              : "No other excavation affects this asset during the same period."}
          </p>
        </section>

        {evidence && evidence.missingFields.length > 0 && (
          <section aria-labelledby="missing-h">
            <h3 id="missing-h" className="text-xs font-medium text-ink-3">
              Missing measurements
            </h3>
            <p className="mt-1 text-sm text-ink-2">{evidence.missingFields.map((f) => FIELD_LABEL[f]).join(", ")}</p>
          </section>
        )}

        <details className="rounded-2xl border border-line px-3 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-ink-2">
            Assumptions used ({clash.assumptions.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ink-2">
            {clash.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>

        <fieldset className="border-t border-line pt-3">
          <legend className="text-xs font-medium text-ink-3">Review status (manual)</legend>
          <div className="mt-1.5 inline-flex rounded-full bg-sunken p-1">
            {REVIEW_STATUSES.map((status) => (
              <label
                key={status}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                  review === status ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
                }`}
              >
                <input
                  type="radio"
                  name={`review-${clash.id}`}
                  value={status}
                  checked={review === status}
                  onChange={() => setReviewStatus(clash.id, status)}
                  className="sr-only"
                />
                {REVIEW_STATUS_META[status].label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-3">
            Stored in this browser only. Recording a review does not approve or reject a permit.
          </p>
        </fieldset>
      </div>
    </Panel>
  );
}

