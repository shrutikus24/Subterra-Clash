/**
 * Inspection report model: assembles the printable report from clash-engine results and recorded
 * data only. Nothing here detects, scores or decides; every value is copied from the engine output
 * or the source records, and an unknown measurement stays undefined.
 */
import type { ClashEngineConfig } from "@/lib/clash-engine/config";
import type {
  ClashResult,
  ConflictSeverity,
  ExcavationWork,
  IsoDate,
  ProjectDataset,
  ReviewStatus,
  UtilityAsset,
} from "@/types";
import { assessDataQuality, rankClashes, summarizeDataset, type DataQualityReport, type DatasetSummary } from ".";

export const REPORT_DISCLAIMERS = [
  "Synthetic demonstration data. These are not verified underground utility survey records.",
  "Decision support only. This report does not approve or reject any excavation permit; every conflict needs engineering review.",
  "Always confirm utility locations on site before excavating. Unknown measurements are shown as not recorded, never as zero.",
] as const;

export interface InspectionReportItem {
  /** 1-based position in review-priority order. */
  rank: number;
  clash: ClashResult;
  asset?: UtilityAsset;
  excavation?: ExcavationWork;
  reviewStatus: ReviewStatus;
  /** Names of other works the engine reported as overlapping in time on the same assets. */
  overlappingWorkNames: string[];
}

export interface InspectionReport {
  analysisDate: IsoDate;
  summary: DatasetSummary;
  bySeverity: Record<ConflictSeverity, number>;
  buffers: { horizontalM: number; verticalM: number };
  items: InspectionReportItem[];
  /** Cancelled works: shown for completeness, excluded from detection by the engine. */
  excludedWorks: ExcavationWork[];
  dataQuality: DataQualityReport;
  disclaimers: readonly string[];
}

export function buildInspectionReport(
  dataset: ProjectDataset,
  config: Pick<ClashEngineConfig, "horizontalBufferM" | "verticalBufferM" | "highHorizontalUncertaintyM" | "outdatedSurveyYears">,
  analysisDate: IsoDate,
  reviewStatusOf: (clashId: string) => ReviewStatus,
): InspectionReport {
  const assetById = new Map(dataset.assets.map((a) => [a.id, a]));
  const excavationById = new Map(dataset.excavations.map((e) => [e.id, e]));
  const summary = summarizeDataset(dataset);

  const items = rankClashes(dataset.clashes).map((clash, i): InspectionReportItem => {
    const asset = assetById.get(clash.affectedAssetIds[0] ?? "");
    const excavation = excavationById.get(clash.excavationId);
    return {
      rank: i + 1,
      clash,
      ...(asset ? { asset } : {}),
      ...(excavation ? { excavation } : {}),
      reviewStatus: reviewStatusOf(clash.id),
      overlappingWorkNames: clash.scheduleOverlap.overlappingExcavationIds.map((id) => excavationById.get(id)?.name ?? id),
    };
  });

  return {
    analysisDate,
    summary,
    bySeverity: summary.bySeverity,
    buffers: { horizontalM: config.horizontalBufferM, verticalM: config.verticalBufferM },
    items,
    excludedWorks: dataset.excavations.filter((e) => e.status === "cancelled"),
    dataQuality: assessDataQuality(dataset.assets, analysisDate, config),
    disclaimers: REPORT_DISCLAIMERS,
  };
}
