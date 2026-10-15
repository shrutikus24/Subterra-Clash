"use client";

import { SeverityBadge, UtilitySwatch, WorkStatusPill } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { ACTION_LABEL, CONFIDENCE_LABEL } from "@/components/dashboard/meta";
import { formatDiameter, formatMetres, formatSignedMetres, shortClashId } from "@/lib/format";
import { utilityBottomDepthM } from "@/lib/scene3d/model";

const NOT_RECORDED = "Not recorded";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className={value.startsWith(NOT_RECORDED) ? "text-ink-3 italic" : ""}>{value}</dd>
    </>
  );
}

const tolerance = (u: number | undefined) => (u === undefined ? NOT_RECORDED : `± ${formatMetres(u)}`);

/**
 * Compact strip under the 3D scene describing the shared selection's depths. Values are recorded measurements
 * and engine output only; anything missing reads "Not recorded".
 */
export function SelectedDepthDetails({ className = "" }: { className?: string }) {
  const { selectedClash: clash, selectedFeature, assetById, excavationById } = useDashboard();

  const asset = assetById.get(clash?.affectedAssetIds[0] ?? (selectedFeature?.kind === "asset" ? selectedFeature.id : ""));
  const excavation = excavationById.get(clash?.excavationId ?? (selectedFeature?.kind === "excavation" ? selectedFeature.id : ""));
  if (!clash && !asset && !excavation) return null;

  const quality = asset?.dataQuality;
  const qualityText = quality
    ? `${CONFIDENCE_LABEL[quality.confidence]} confidence${quality.captureMethod ? ` · ${quality.captureMethod}` : ""}`
    : NOT_RECORDED;
  const bottom = asset ? utilityBottomDepthM(asset) : undefined;
  // A selection that started from an excavation leads with that excavation's own details.
  const excavationFirst = selectedFeature?.kind === "excavation";

  return (
    <div
      className={`rounded-2xl border border-line bg-sunken p-3 text-xs ${className}`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-ink-2">
          {clash ? shortClashId(clash.id) : (asset?.name ?? excavation?.name)}
        </span>
        {clash && <SeverityBadge severity={clash.severity} />}
      </div>

      {/* Below sm the full evidence panel sits directly under the viewer, so only the header shows. */}
      <div className="hidden gap-x-6 sm:grid sm:grid-cols-3">
        {asset && (
          <div className="min-w-0">
            <p className="mt-2 flex items-center gap-2 font-medium text-ink">
              <span className="truncate">{asset.name}</span>
              <UtilitySwatch type={asset.type} />
            </p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <Row label="Top depth" value={formatMetres(asset.depthM)} />
              {bottom !== undefined && <Row label="Bottom depth" value={formatMetres(bottom)} />}
              <Row label="Diameter" value={formatDiameter(asset.diameterM)} />
              <Row label="Uncertainty" value={tolerance(asset.depthUncertaintyM)} />
              <Row label="Data quality" value={qualityText} />
            </dl>
          </div>
        )}
        {excavation && (
          <div className={`min-w-0 ${excavationFirst ? "sm:order-first" : ""}`}>
            <p className="mt-2 flex items-center gap-2 font-medium text-ink">
              <span className="truncate">{excavation.name}</span>
              <WorkStatusPill status={excavation.status} />
            </p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <Row
                label="Planned depth"
                value={`${formatMetres(excavation.plannedDepthM)}${
                  excavation.depthUncertaintyM !== undefined ? ` ± ${formatMetres(excavation.depthUncertaintyM)}` : ""
                }`}
              />
            </dl>
          </div>
        )}
        {clash && (
          <div className="min-w-0">
            <p className="mt-2 font-medium text-ink">Engine result</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <Row label="Clearance" value={formatSignedMetres(clash.verticalClearanceM)} />
              <Row label="Action" value={ACTION_LABEL[clash.recommendedAction.action]} />
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
