/**
 * Reporting and dashboard aggregation over engine output. These functions only summarise
 * `ClashResult`s and asset records; they never re-run or second-guess clash detection.
 */
import { DEFAULT_CLASH_CONFIG, type ClashEngineConfig } from "@/lib/clash-engine";
import { isOlderThan, scheduleIntersection } from "@/lib/clash-engine/schedule";
import {
  CONFLICT_SEVERITIES,
  INSPECTION_ACTIONS,
  UTILITY_TYPES,
  type ClashResult,
  type ConfidenceLevel,
  type ConflictSeverity,
  type ExcavationWork,
  type InspectionAction,
  type IsoDate,
  type ProjectDataset,
  type ReviewStatus,
  type UtilityAsset,
  type UtilityType,
  type WorkSchedule,
} from "@/types";

// ---------------------------------------------------------------------------
// Priority ordering
// ---------------------------------------------------------------------------

/** Review priority: needs-data ranks above medium because an unknown may hide a strike. */
export const SEVERITY_PRIORITY: readonly ConflictSeverity[] = ["critical", "high", "needs-data", "medium", "low"];
const CONFIDENCE_PRIORITY: readonly ConfidenceLevel[] = ["high", "medium", "low"];

export function compareClashPriority(a: ClashResult, b: ClashResult): number {
  return (
    SEVERITY_PRIORITY.indexOf(a.severity) - SEVERITY_PRIORITY.indexOf(b.severity) ||
    CONFIDENCE_PRIORITY.indexOf(a.confidence) - CONFIDENCE_PRIORITY.indexOf(b.confidence) ||
    (a.horizontalDistanceM ?? Infinity) - (b.horizontalDistanceM ?? Infinity) ||
    a.id.localeCompare(b.id)
  );
}

export function rankClashes(clashes: readonly ClashResult[]): ClashResult[] {
  return [...clashes].sort(compareClashPriority);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const zeroCounts = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export interface DatasetSummary {
  totalAssets: number;
  totalExcavations: number;
  activeExcavations: number;
  cancelledExcavations: number;
  totalClashes: number;
  criticalOrHigh: number;
  needsData: number;
  clashesWithScheduleOverlap: number;
  affectedAssets: number;
  bySeverity: Record<ConflictSeverity, number>;
  byUtilityType: Record<UtilityType, number>;
  byAction: Record<InspectionAction, number>;
}

export function summarizeDataset({ assets, excavations, clashes }: ProjectDataset): DatasetSummary {
  const assetType = new Map(assets.map((a) => [a.id, a.type]));
  const bySeverity = zeroCounts(CONFLICT_SEVERITIES);
  const byUtilityType = zeroCounts(UTILITY_TYPES);
  const byAction = zeroCounts(INSPECTION_ACTIONS);
  const affected = new Set<string>();

  for (const c of clashes) {
    bySeverity[c.severity] += 1;
    byAction[c.recommendedAction.action] += 1;
    for (const id of c.affectedAssetIds) {
      affected.add(id);
      const type = assetType.get(id);
      if (type) byUtilityType[type] += 1;
    }
  }

  return {
    totalAssets: assets.length,
    totalExcavations: excavations.length,
    activeExcavations: excavations.filter((e) => e.status === "active").length,
    cancelledExcavations: excavations.filter((e) => e.status === "cancelled").length,
    totalClashes: clashes.length,
    criticalOrHigh: bySeverity.critical + bySeverity.high,
    needsData: bySeverity["needs-data"],
    clashesWithScheduleOverlap: clashes.filter((c) => c.scheduleOverlap.hasOverlap).length,
    affectedAssets: affected.size,
    bySeverity,
    byUtilityType,
    byAction,
  };
}

// ---------------------------------------------------------------------------
// Schedule overlaps
// ---------------------------------------------------------------------------

export interface ScheduleOverlapGroup {
  excavationIds: [string, string];
  assetIds: string[];
  window: WorkSchedule;
}

/** Pairs of excavations the engine reported as affecting the same assets at the same time. */
export function collectScheduleOverlaps({ excavations, clashes }: ProjectDataset): ScheduleOverlapGroup[] {
  const byId = new Map(excavations.map((e) => [e.id, e]));
  const groups = new Map<string, { ids: [string, string]; assets: Set<string> }>();

  for (const clash of clashes) {
    for (const otherId of clash.scheduleOverlap.overlappingExcavationIds) {
      const ids = [clash.excavationId, otherId].sort() as [string, string];
      const key = ids.join("|");
      const group = groups.get(key) ?? { ids, assets: new Set<string>() };
      for (const assetId of clash.affectedAssetIds) group.assets.add(assetId);
      groups.set(key, group);
    }
  }

  const result: ScheduleOverlapGroup[] = [];
  for (const { ids, assets } of groups.values()) {
    const a = byId.get(ids[0]);
    const b = byId.get(ids[1]);
    const window = a && b ? scheduleIntersection(a.schedule, b.schedule) : undefined;
    if (window) result.push({ excavationIds: ids, assetIds: [...assets].sort(), window });
  }
  return result.sort((x, y) => x.window.startDate.localeCompare(y.window.startDate));
}

// ---------------------------------------------------------------------------
// Data quality
// ---------------------------------------------------------------------------

export const DATA_QUALITY_ISSUES = [
  "missing-depth",
  "missing-depth-uncertainty",
  "missing-diameter",
  "high-horizontal-uncertainty",
  "missing-horizontal-uncertainty",
  "outdated-survey",
  "missing-survey-date",
  "low-quality-record",
] as const;
export type DataQualityIssue = (typeof DATA_QUALITY_ISSUES)[number];

export interface AssetDataQuality {
  assetId: string;
  issues: DataQualityIssue[];
}

export interface DataQualityReport {
  assets: AssetDataQuality[];
  counts: Record<DataQualityIssue, number>;
}

export function assessDataQuality(
  assets: readonly UtilityAsset[],
  referenceDate: IsoDate,
  config: Pick<ClashEngineConfig, "highHorizontalUncertaintyM" | "outdatedSurveyYears"> = DEFAULT_CLASH_CONFIG,
): DataQualityReport {
  const counts = zeroCounts(DATA_QUALITY_ISSUES);
  const report: AssetDataQuality[] = [];

  for (const a of assets) {
    const issues: DataQualityIssue[] = [];
    if (a.depthM === undefined) issues.push("missing-depth");
    else if (a.depthUncertaintyM === undefined) issues.push("missing-depth-uncertainty");
    if (a.diameterM === undefined) issues.push("missing-diameter");
    if (a.horizontalUncertaintyM === undefined) issues.push("missing-horizontal-uncertainty");
    else if (a.horizontalUncertaintyM >= config.highHorizontalUncertaintyM) issues.push("high-horizontal-uncertainty");
    if (a.surveyDate === undefined) issues.push("missing-survey-date");
    else if (isOlderThan(a.surveyDate, config.outdatedSurveyYears, referenceDate)) issues.push("outdated-survey");
    if (a.dataQuality?.confidence === "low" || a.dataQuality?.captureMethod === "estimated") {
      issues.push("low-quality-record");
    }
    for (const issue of issues) counts[issue] += 1;
    if (issues.length > 0) report.push({ assetId: a.id, issues });
  }
  return { assets: report, counts };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/** Quotes a CSV cell and neutralises spreadsheet formula injection in text cells. */
function csvCell(value: string | number | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const CSV_COLUMNS = [
  "dataset",
  "clash_id",
  "severity",
  "confidence",
  "excavation_id",
  "excavation_name",
  "excavation_status",
  "asset_ids",
  "asset_names",
  "utility_types",
  "horizontal_distance_m",
  "vertical_clearance_m",
  "schedule_overlap",
  "overlapping_excavations",
  "overlap_window",
  "reason_codes",
  "recommended_action",
  "action_summary",
  "review_status",
  "explanation",
] as const;

/** Unknown measurements export as empty cells, never as zero. */
export function clashesToCsv(
  clashes: readonly ClashResult[],
  dataset: Pick<ProjectDataset, "assets" | "excavations">,
  reviewStatusOf: (clashId: string) => ReviewStatus = () => "open",
): string {
  const assets = new Map(dataset.assets.map((a) => [a.id, a]));
  const excavations = new Map<string, ExcavationWork>(dataset.excavations.map((e) => [e.id, e]));
  const rows = clashes.map((c) => {
    const exc = excavations.get(c.excavationId);
    const affected = c.affectedAssetIds.map((id) => assets.get(id));
    const window = c.scheduleOverlap.overlapWindow;
    return [
      "synthetic-demo",
      c.id,
      c.severity,
      c.confidence,
      c.excavationId,
      exc?.name,
      exc?.status,
      c.affectedAssetIds.join("; "),
      affected.map((a) => a?.name ?? "").join("; "),
      affected.map((a) => a?.type ?? "").join("; "),
      c.horizontalDistanceM,
      c.verticalClearanceM,
      c.scheduleOverlap.hasOverlap ? "yes" : "no",
      c.scheduleOverlap.overlappingExcavationIds.join("; "),
      window ? `${window.startDate} to ${window.endDate}` : undefined,
      c.reasonCodes.join("; "),
      c.recommendedAction.action,
      c.recommendedAction.summary,
      reviewStatusOf(c.id),
      c.explanation,
    ].map(csvCell);
  });
  return [CSV_COLUMNS.join(","), ...rows.map((r) => r.join(","))].join("\r\n") + "\r\n";
}
