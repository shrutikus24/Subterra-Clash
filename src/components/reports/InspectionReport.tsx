"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { CrossSection } from "@/components/cross-section/CrossSection";
import { SeverityBadge, UtilitySwatch } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import {
  ACTION_LABEL,
  CONFIDENCE_LABEL,
  DATA_QUALITY_LABEL,
  REASON_LABEL,
  REVIEW_STATUS_META,
  WORK_STATUS_META,
} from "@/components/dashboard/meta";
import { FIELD_LABEL } from "@/components/review-queue/ConflictDetail";
import { formatDate, formatDateRange, formatDiameter, formatMetres, formatSignedMetres, shortClashId } from "@/lib/format";
import { SEVERITY_PRIORITY } from "@/lib/reports";
import { buildInspectionReport, type InspectionReportItem } from "@/lib/reports/inspection";

const NOT_RECORDED = "Not recorded";
const tolerance = (u: number | undefined) => (u === undefined ? "" : ` ± ${formatMetres(u)}`);

function Section({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-8 ${className}`}>
      <h2 className="border-b border-line pb-1.5 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className={`text-sm ${value.startsWith(NOT_RECORDED) ? "text-ink-3 italic" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

function ConflictEvidence({ item, verticalBufferM }: { item: InspectionReportItem; verticalBufferM: number }) {
  const { clash, asset, excavation } = item;
  const evidence = clash.evidence[0];
  return (
    <article className="mt-6 break-inside-avoid rounded-2xl border border-line p-4 print:mt-4">
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-3">#{item.rank}</span>
        <h3 className="font-mono text-sm font-semibold">{shortClashId(clash.id)}</h3>
        <SeverityBadge severity={clash.severity} />
        <span className="text-xs text-ink-2">Confidence: {CONFIDENCE_LABEL[clash.confidence]}</span>
        <span className="ml-auto text-xs text-ink-2">Review: {REVIEW_STATUS_META[item.reviewStatus].label}</span>
      </header>
      <p className="mt-2 text-sm font-medium">
        {asset?.name ?? clash.affectedAssetIds.join(", ")}
        {asset && (
          <span className="ml-2 inline-flex align-middle">
            <UtilitySwatch type={asset.type} />
          </span>
        )}
        <span className="text-ink-3"> × </span>
        {excavation?.name ?? clash.excavationId}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{clash.explanation}</p>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Asset top depth" value={`${formatMetres(asset?.depthM)}${tolerance(asset?.depthUncertaintyM)}`} />
        <Fact label="Asset diameter" value={formatDiameter(asset?.diameterM)} />
        <Fact
          label="Planned dig depth"
          value={excavation ? `${formatMetres(excavation.plannedDepthM)}${tolerance(excavation.depthUncertaintyM)}` : NOT_RECORDED}
        />
        <Fact label="Asset record source" value={asset?.source ?? NOT_RECORDED} />
        <Fact label="Horizontal distance to corridor edge" value={formatMetres(clash.horizontalDistanceM)} />
        <Fact label="Vertical clearance" value={formatSignedMetres(clash.verticalClearanceM)} />
        <Fact
          label="Combined tolerance"
          value={
            evidence?.combinedHorizontalUncertaintyM !== undefined || evidence?.combinedDepthUncertaintyM !== undefined
              ? [
                  evidence?.combinedHorizontalUncertaintyM !== undefined ? `± ${formatMetres(evidence.combinedHorizontalUncertaintyM)} plan` : "",
                  evidence?.combinedDepthUncertaintyM !== undefined ? `± ${formatMetres(evidence.combinedDepthUncertaintyM)} depth` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : NOT_RECORDED
          }
        />
        <Fact
          label="Missing measurements"
          value={evidence?.missingFields.length ? evidence.missingFields.map((f) => FIELD_LABEL[f]).join(", ") : "None"}
        />
      </dl>

      <p className="mt-3 text-xs text-ink-2">
        <span className="text-ink-3">Reasons: </span>
        {clash.reasonCodes.map((c) => REASON_LABEL[c]).join(" · ")}
      </p>
      <p className="mt-1 text-xs text-ink-2">
        <span className="text-ink-3">Schedule: </span>
        {excavation ? formatDateRange(excavation.schedule.startDate, excavation.schedule.endDate) : NOT_RECORDED}
        {clash.scheduleOverlap.hasOverlap && clash.scheduleOverlap.overlapWindow
          ? ` · overlaps ${item.overlappingWorkNames.join(", ")} on this asset (${formatDateRange(
              clash.scheduleOverlap.overlapWindow.startDate,
              clash.scheduleOverlap.overlapWindow.endDate,
            )})`
          : " · no schedule overlap on this asset"}
      </p>

      {asset && excavation && (
        <div className="mt-3 max-w-xl rounded-xl border border-line bg-sunken p-2">
          <CrossSection clash={clash} asset={asset} excavation={excavation} verticalBufferM={verticalBufferM} />
        </div>
      )}

      <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-sm">
        <strong className="font-semibold">Recommended inspection: {ACTION_LABEL[clash.recommendedAction.action]}.</strong>{" "}
        {clash.recommendedAction.summary}
      </p>

      {clash.assumptions.length > 0 && (
        <div className="mt-2 text-xs text-ink-2">
          <p className="text-ink-3">Engine assumptions</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {clash.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Left blank for the reviewing engineer; the tool never fills in a decision. */}
      <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-ink-3 sm:grid-cols-3">
        <p className="border-b border-ink-3/60 pb-5">Reviewing engineer</p>
        <p className="border-b border-ink-3/60 pb-5">Date</p>
        <p className="border-b border-ink-3/60 pb-5">Decision and notes</p>
      </div>
    </article>
  );
}

/** Printable inspection report (browser "Save as PDF"). Built entirely from engine results and records. */
export function InspectionReport() {
  const { dataset, config, analysisDate, reviewStatusOf, assetById } = useDashboard();
  const report = useMemo(
    () => buildInspectionReport(dataset, config, analysisDate, reviewStatusOf),
    [dataset, config, analysisDate, reviewStatusOf],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/reports" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-sm hover:bg-sunken">
          <ArrowLeft className="size-4" aria-hidden /> Back to reports
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/90"
        >
          <Printer className="size-4" aria-hidden /> Print / Save as PDF
        </button>
      </div>

      <article className="rounded-3xl border border-line bg-card p-5 sm:p-8 print:rounded-none print:border-0 print:p-0">
        <header>
          <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">Subterra Clash · Inspection report</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Excavation conflict inspection report</h1>
          <p className="mt-1 text-sm text-ink-2">
            Analysis date {formatDate(report.analysisDate)} · synthetic dataset · {report.summary.totalClashes} engine results
          </p>
        </header>

        <ul className="mt-4 space-y-1 rounded-2xl border border-line bg-sunken p-4 text-sm text-ink-2">
          {report.disclaimers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>

        <Section title="Summary">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Utility assets" value={String(report.summary.totalAssets)} />
            <Fact
              label="Excavation works"
              value={`${report.summary.totalExcavations} (${report.summary.cancelledExcavations} cancelled)`}
            />
            <Fact label="Potential conflicts" value={String(report.summary.totalClashes)} />
            <Fact label="Clearance buffers applied" value={`${formatMetres(report.buffers.horizontalM)} plan · ${formatMetres(report.buffers.verticalM)} vertical`} />
          </dl>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Conflicts by severity">
            {SEVERITY_PRIORITY.map((sev) => (
              <li key={sev} className="inline-flex items-center gap-1.5 text-sm">
                <SeverityBadge severity={sev} /> <span className="tabular-nums">{report.bySeverity[sev]}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Conflict register">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[720px] text-left text-xs print:min-w-0">
              <thead className="text-ink-3">
                <tr className="border-b border-line">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 pr-2 font-medium">Conflict</th>
                  <th className="py-2 pr-2 font-medium">Asset</th>
                  <th className="py-2 pr-2 font-medium">Excavation</th>
                  <th className="py-2 pr-2 font-medium">Severity</th>
                  <th className="py-2 pr-2 font-medium">Confidence</th>
                  <th className="py-2 pr-2 font-medium">Vertical clearance</th>
                  <th className="py-2 pr-2 font-medium">Recommended action</th>
                  <th className="py-2 font-medium">Review</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((item) => (
                  <tr key={item.clash.id} className="border-b border-line break-inside-avoid">
                    <td className="py-2 pr-2 tabular-nums">{item.rank}</td>
                    <td className="py-2 pr-2 font-mono">{shortClashId(item.clash.id)}</td>
                    <td className="py-2 pr-2">{item.asset?.name ?? item.clash.affectedAssetIds.join(", ")}</td>
                    <td className="py-2 pr-2">{item.excavation?.name ?? item.clash.excavationId}</td>
                    <td className="py-2 pr-2">
                      <SeverityBadge severity={item.clash.severity} />
                    </td>
                    <td className="py-2 pr-2">{CONFIDENCE_LABEL[item.clash.confidence]}</td>
                    <td className={`py-2 pr-2 ${item.clash.verticalClearanceM === undefined ? "text-ink-3 italic" : ""}`}>
                      {formatSignedMetres(item.clash.verticalClearanceM)}
                    </td>
                    <td className="py-2 pr-2">{ACTION_LABEL[item.clash.recommendedAction.action]}</td>
                    <td className="py-2">{REVIEW_STATUS_META[item.reviewStatus].label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Conflict evidence">
          <p className="text-sm text-ink-2">
            One entry per engine result, in review-priority order. Cross-sections are schematic: depth to scale,
            horizontal positions not to scale.
          </p>
          {report.items.map((item) => (
            <ConflictEvidence key={item.clash.id} item={item} verticalBufferM={report.buffers.verticalM} />
          ))}
        </Section>

        {report.excludedWorks.length > 0 && (
          <Section title="Works excluded from detection" className="break-inside-avoid">
            <ul className="space-y-1 text-sm">
              {report.excludedWorks.map((w) => (
                <li key={w.id}>
                  {w.name} <span className="font-mono text-xs text-ink-3">{w.id}</span> ·{" "}
                  {WORK_STATUS_META[w.status].label} · {formatDateRange(w.schedule.startDate, w.schedule.endDate)}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Data-quality limitations" className="break-inside-avoid">
          {report.dataQuality.assets.length === 0 ? (
            <p className="text-sm text-ink-2">No data-quality issues were flagged in the asset records.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-ink-3">
                <tr className="border-b border-line">
                  <th className="py-2 pr-2 font-medium">Asset</th>
                  <th className="py-2 pr-2 font-medium">Source record</th>
                  <th className="py-2 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody>
                {report.dataQuality.assets.map(({ assetId, issues }) => {
                  const asset = assetById.get(assetId);
                  return (
                    <tr key={assetId} className="border-b border-line">
                      <td className="py-2 pr-2">{asset?.name ?? assetId}</td>
                      <td className="py-2 pr-2 text-ink-2">{asset?.source ?? NOT_RECORDED}</td>
                      <td className="py-2">{issues.map((i) => DATA_QUALITY_LABEL[i]).join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>
      </article>
    </div>
  );
}
