"use client";

import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { ConfidenceBadge, SeverityBadge } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { ACTION_LABEL, REASON_LABEL } from "@/components/dashboard/meta";
import { formatMetres, formatSignedMetres, shortClashId } from "@/lib/format";

/** Engine output for the selected clash: severity, confidence, evidence and recommended action. */
export function SelectedClashSummary({ className = "" }: { className?: string }) {
  const { selectedClash: clash, assetById, excavationById } = useDashboard();
  if (!clash) {
    return (
      <p className={`rounded-2xl border border-dashed border-line bg-sunken px-4 py-3 text-sm text-ink-3 ${className}`}>
        Click a utility or trench in the 3D view, or pick a conflict from the list, to see its engine result.
      </p>
    );
  }
  const asset = assetById.get(clash.affectedAssetIds[0] ?? "");
  const excavation = excavationById.get(clash.excavationId);
  const evidence = clash.evidence[0];

  return (
    <div className={`rounded-2xl border border-line bg-sunken p-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={clash.severity} />
        <ConfidenceBadge confidence={clash.confidence} />
        <span className="font-mono text-xs text-ink-3">{shortClashId(clash.id)}</span>
        <Link href="/conflicts" className="ml-auto rounded-full border border-line bg-card px-3 py-1 text-xs hover:bg-line">
          Open in review
        </Link>
      </div>
      <p className="mt-2 text-sm font-medium">
        {asset?.name} <span className="text-ink-3">×</span> {excavation?.name}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-ink-3">To corridor edge</dt>
          <dd>{formatMetres(clash.horizontalDistanceM)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Vertical clearance</dt>
          <dd className={clash.verticalClearanceM === undefined ? "text-ink-3 italic" : ""}>
            {formatSignedMetres(clash.verticalClearanceM)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">Combined tolerance</dt>
          <dd>
            {evidence?.combinedHorizontalUncertaintyM !== undefined ? `± ${formatMetres(evidence.combinedHorizontalUncertaintyM)} plan` : "—"}
            {evidence?.combinedDepthUncertaintyM !== undefined ? ` · ± ${formatMetres(evidence.combinedDepthUncertaintyM)} depth` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">Missing</dt>
          <dd className="text-ink-2">{evidence?.missingFields.length ? evidence.missingFields.join(", ") : "None"}</dd>
        </div>
      </dl>
      <ul className="mt-2 flex flex-wrap gap-1">
        {clash.reasonCodes.map((code) => (
          <li key={code} className="rounded-full border border-line bg-card px-2 py-0.5 text-[11px] text-ink-2">
            {REASON_LABEL[code]}
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-2">
        <ClipboardCheck className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
        <span>
          <strong className="font-medium text-ink">{ACTION_LABEL[clash.recommendedAction.action]}:</strong>{" "}
          {clash.recommendedAction.summary}
        </span>
      </p>
    </div>
  );
}
