import {
  CLASH_REASON_CODES,
  type AssetClashEvidence,
  type AssetMeasurementField,
  type ClashReasonCode,
  type ClashResult,
  type ConfidenceLevel,
  type ConflictSeverity,
  type ExcavationWork,
  type InspectionAction,
  type RecommendedAction,
  type ScheduleOverlap,
  type UtilityAsset,
} from "@/types";
import { resolveConfig, type ClashEngineConfig, type ResolvedClashEngineConfig } from "./config";
import { measureCorridorDistance } from "./geometry";
import { envelope, isOlderThan, scheduleIntersection } from "./schedule";
import {
  assessHorizontal,
  assessVertical,
  determineConfidence,
  determineSeverity,
  recommendAction,
  type HorizontalAssessment,
  type HorizontalState,
  type VerticalAssessment,
} from "./severity";

/** Physical assessment of one excavation/asset pair, before schedule context is added. */
interface PairAssessment {
  asset: UtilityAsset;
  excavation: ExcavationWork;
  edgeDistanceM: number;
  combinedHorizontalUncertaintyM: number;
  horizontal: HorizontalAssessment & { state: Exclude<HorizontalState, "clear"> };
  vertical: VerticalAssessment;
  severity: ConflictSeverity;
  confidence: ConfidenceLevel;
  reasonCodes: Set<ClashReasonCode>;
  missingFields: AssetMeasurementField[];
  assumptions: string[];
  highConsequence: boolean;
}

const HIGH_CONSEQUENCE_TYPES: ReadonlySet<UtilityAsset["type"]> = new Set(["gas", "electric"]);

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const m = (v: number) => `${round3(v)} m`;
const pm = (v: number) => `±${round3(v)} m`;

export function clashId(excavationId: string, assetId: string): string {
  return `CLASH:${excavationId}:${assetId}`;
}

function assertUniqueIds(records: readonly { id: string }[], label: string): void {
  const seen = new Set<string>();
  for (const { id } of records) {
    if (seen.has(id)) throw new Error(`Duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

function missingFieldsOf(asset: UtilityAsset): AssetMeasurementField[] {
  const fields: AssetMeasurementField[] = [
    "depthM",
    "depthUncertaintyM",
    "diameterM",
    "horizontalUncertaintyM",
    "surveyDate",
  ];
  return fields.filter((f) => asset[f] === undefined);
}

function assessPair(
  asset: UtilityAsset,
  excavation: ExcavationWork,
  config: ResolvedClashEngineConfig,
): PairAssessment | null {
  const assumptions: string[] = [];
  const valueOr = (value: number | undefined, fallback: number, description: string): number => {
    if (value !== undefined) return value;
    assumptions.push(`${description} not recorded; assumed ${pm(fallback)}.`);
    return fallback;
  };

  // --- Horizontal ---------------------------------------------------------
  const assetHUnc = valueOr(
    asset.horizontalUncertaintyM,
    config.assumedAssetHorizontalUncertaintyM,
    "Asset horizontal position uncertainty",
  );
  const excHUnc = valueOr(
    excavation.horizontalUncertaintyM,
    config.assumedExcavationHorizontalUncertaintyM,
    "Excavation horizontal tolerance",
  );
  let diameterM = asset.diameterM;
  if (diameterM === undefined) {
    diameterM = config.assumedAssetDiameterM;
    assumptions.push(`Asset diameter not recorded; assumed ${m(diameterM)}.`);
  }
  const { edgeDistanceM } = measureCorridorDistance(asset.geometry, excavation.geometry, excavation.widthM);
  const combinedHorizontalUncertaintyM = round3(assetHUnc + excHUnc);
  const horizontal = assessHorizontal({
    edgeDistanceM,
    assetRadiusM: diameterM / 2,
    combinedUncertaintyM: combinedHorizontalUncertaintyM,
    bufferM: config.horizontalBufferM,
  });
  if (horizontal.state === "clear") return null;
  const horizontalInRange = { ...horizontal, state: horizontal.state };

  // --- Vertical -----------------------------------------------------------
  const vertical = assessVertical({
    assetTopDepthM: asset.depthM,
    assetDepthUncertaintyM:
      asset.depthM === undefined
        ? 0
        : valueOr(asset.depthUncertaintyM, config.assumedAssetDepthUncertaintyM, "Asset depth uncertainty"),
    excavationDepthM: excavation.plannedDepthM,
    excavationDepthUncertaintyM: valueOr(
      excavation.depthUncertaintyM,
      config.assumedExcavationDepthUncertaintyM,
      "Excavation depth tolerance",
    ),
    bufferM: config.verticalBufferM,
  });

  // --- Record quality -----------------------------------------------------
  const quality = asset.dataQuality;
  const lowQuality = quality?.confidence === "low" || quality?.captureMethod === "estimated";
  const outdatedSurvey =
    asset.surveyDate !== undefined &&
    isOlderThan(asset.surveyDate, config.outdatedSurveyYears, config.referenceDate);
  const highConsequence = HIGH_CONSEQUENCE_TYPES.has(asset.type);
  const missingFields = missingFieldsOf(asset);

  // --- Classification -----------------------------------------------------
  const severity = determineSeverity({
    horizontal: horizontalInRange.state,
    vertical,
    unreliableRecord: lowQuality,
    highConsequence,
  });
  const confidence = determineConfidence({
    horizontal: horizontal.state,
    vertical: vertical.state,
    recordQuality: quality?.confidence,
    usedAssumedValues: assumptions.length > 0,
    outdatedSurvey,
    surveyDateMissing: asset.surveyDate === undefined,
  });

  const reasonCodes = new Set<ClashReasonCode>();
  if (horizontal.state === "intersecting") reasonCodes.add("horizontal-intersection");
  if (horizontal.state === "within-buffer") reasonCodes.add("within-horizontal-buffer");
  if (horizontal.state === "within-uncertainty") reasonCodes.add("high-position-uncertainty");
  if (asset.horizontalUncertaintyM !== undefined && asset.horizontalUncertaintyM >= config.highHorizontalUncertaintyM) {
    reasonCodes.add("high-position-uncertainty");
  }
  if (vertical.state === "unknown") {
    reasonCodes.add("missing-asset-depth");
  } else if (vertical.state !== "clear") {
    reasonCodes.add((vertical.clearanceM ?? 0) < 0 ? "depth-intrusion" : "insufficient-vertical-clearance");
  }
  if (asset.diameterM === undefined) reasonCodes.add("missing-asset-diameter");
  if (lowQuality) reasonCodes.add("low-data-quality");
  if (outdatedSurvey) reasonCodes.add("outdated-survey");
  if (highConsequence) reasonCodes.add("high-consequence-utility");

  return {
    asset,
    excavation,
    edgeDistanceM,
    combinedHorizontalUncertaintyM,
    horizontal: horizontalInRange,
    vertical,
    severity,
    confidence,
    reasonCodes,
    missingFields,
    assumptions,
    highConsequence,
  };
}

/** Other works that may physically affect the same asset (not merely nearby) during an overlapping period. */
function findScheduleOverlap(pair: PairAssessment, sameAssetPairs: readonly PairAssessment[]): ScheduleOverlap {
  const overlaps = sameAssetPairs
    .filter((other) => other.excavation.id !== pair.excavation.id && other.severity !== "low")
    .map((other) => ({
      id: other.excavation.id,
      window: scheduleIntersection(pair.excavation.schedule, other.excavation.schedule),
    }))
    .filter((o): o is { id: string; window: NonNullable<typeof o.window> } => o.window !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id));

  const overlapWindow = envelope(overlaps.map((o) => o.window));
  return {
    hasOverlap: overlaps.length > 0,
    overlappingExcavationIds: overlaps.map((o) => o.id),
    ...(overlapWindow ? { overlapWindow } : {}),
  };
}

function describeHorizontal(p: PairAssessment, config: ResolvedClashEngineConfig): string {
  const { asset, excavation } = p;
  const label = `${asset.name} (${asset.type})`;
  switch (p.horizontal.state) {
    case "intersecting":
      return `${excavation.name} crosses ${label}.`;
    case "within-buffer":
      return `${label} runs ${m(p.edgeDistanceM)} from the ${excavation.name} corridor edge, inside the ${m(config.horizontalBufferM)} horizontal safety buffer.`;
    case "within-uncertainty":
      return `${label} is recorded ${m(p.edgeDistanceM)} from the ${excavation.name} corridor edge, outside the ${m(config.horizontalBufferM)} buffer, but a combined position uncertainty of ${pm(p.combinedHorizontalUncertaintyM)} means it could lie within it.`;
  }
}

function describeVertical(p: PairAssessment, config: ResolvedClashEngineConfig): string {
  const v = p.vertical;
  const dig = m(p.excavation.plannedDepthM);
  const buffer = m(config.verticalBufferM);
  if (v.state === "unknown") {
    return `No depth is recorded for the asset, so its vertical relationship to the ${dig} excavation cannot be determined.`;
  }
  const top = p.asset.depthM ?? 0;
  const extent = p.asset.diameterM !== undefined ? ` (occupying ${m(top)}–${m(top + p.asset.diameterM)})` : "";
  const intrusion = (v.clearanceM ?? 0) < 0;
  const facts = `Asset top is recorded at ${m(top)}${extent} against a planned dig depth of ${dig}: nominal clearance ${m(v.clearanceM ?? 0)}, range ${m(v.worstCaseClearanceM ?? 0)} to ${m(v.bestCaseClearanceM ?? 0)} with ${pm(v.combinedUncertaintyM ?? 0)} combined depth tolerance.`;
  const verdict = {
    "violation-confirmed": intrusion
      ? "The excavation reaches the asset even at the most favourable tolerance."
      : `Clearance stays below the ${buffer} vertical buffer across the whole tolerance range.`,
    "violation-likely": `Nominal depths indicate ${intrusion ? "intrusion" : "insufficient clearance"}, but the tolerance range also allows adequate clearance.`,
    "clearance-uncertain": `Nominal clearance meets the ${buffer} buffer, but the tolerance range does not rule out ${(v.worstCaseClearanceM ?? 0) < 0 ? "intrusion" : "insufficient clearance"}.`,
    clear: `Clearance exceeds the ${buffer} buffer across the whole tolerance range, provided the recorded depth is correct.`,
  }[v.state];
  return `${facts} ${verdict}`;
}

function buildExplanation(p: PairAssessment, overlap: ScheduleOverlap, config: ResolvedClashEngineConfig): string {
  const parts = [describeHorizontal(p, config), describeVertical(p, config)];
  if (p.asset.dataQuality?.notes) parts.push(`Record note: ${p.asset.dataQuality.notes}`);
  if (overlap.hasOverlap && overlap.overlapWindow) {
    parts.push(
      `Schedule: ${overlap.overlappingExcavationIds.join(", ")} may also affect this asset between ${overlap.overlapWindow.startDate} and ${overlap.overlapWindow.endDate}.`,
    );
  }
  return parts.join(" ");
}

function buildAction(p: PairAssessment): RecommendedAction {
  const action = recommendAction({
    severity: p.severity,
    horizontal: p.horizontal.state,
    highConsequence: p.highConsequence,
  });
  const asset = p.asset.name;
  const owner = p.asset.owner ?? "the asset owner";
  const summaries: Record<InspectionAction, string> = {
    "no-action": "No action required.",
    "verify-records": `Confirm ${asset} records with ${owner} before work starts.`,
    "ground-penetrating-radar": `Locate ${asset} by ground-penetrating radar or electromagnetic survey before excavating nearby.`,
    "trial-hole": `Expose ${asset} by hand or vacuum trial hole to confirm its position and depth before machine digging.`,
    "owner-standby": `Notify ${owner}; hand-dig to expose and protect ${asset} with the owner on standby.`,
    "redesign-alignment": `Increase separation from ${asset} or provide trench support and protection along the parallel run.`,
  };
  return { action, summary: summaries[action] };
}

function buildEvidence(p: PairAssessment): AssetClashEvidence {
  return {
    assetId: p.asset.id,
    horizontalDistanceM: round3(p.edgeDistanceM),
    ...(p.vertical.clearanceM !== undefined ? { verticalClearanceM: round3(p.vertical.clearanceM) } : {}),
    combinedHorizontalUncertaintyM: p.combinedHorizontalUncertaintyM,
    ...(p.vertical.combinedUncertaintyM !== undefined
      ? { combinedDepthUncertaintyM: round3(p.vertical.combinedUncertaintyM) }
      : {}),
    missingFields: p.missingFields,
  };
}

function baseAssumptions(config: ResolvedClashEngineConfig): string[] {
  return [
    "Asset depth is to the top of the asset; excavation depth is the maximum planned dig depth.",
    `Safety buffers: ${m(config.horizontalBufferM)} horizontal beyond the corridor edge, ${m(config.verticalBufferM)} vertical below the excavation base.`,
    "Asset and excavation tolerances are combined by linear addition (conservative).",
    "Horizontal distances use a local tangent-plane projection of the WGS84 coordinates.",
  ];
}

/**
 * Detects clashes between excavation works and utility assets.
 *
 * Returns one result per non-cancelled excavation/asset pair within horizontal reach, sorted by ID.
 * An empty result means no clash was found in the supplied records under the configured assumptions;
 * it is not proof that the ground is clear.
 */
export function detectClashes(
  assets: readonly UtilityAsset[],
  excavations: readonly ExcavationWork[],
  overrides: Partial<ClashEngineConfig> = {},
): ClashResult[] {
  const config = resolveConfig(overrides);
  assertUniqueIds(assets, "asset");
  assertUniqueIds(excavations, "excavation");

  const activeExcavations = excavations.filter((e) => e.status !== "cancelled");
  const pairs: PairAssessment[] = [];
  for (const excavation of activeExcavations) {
    for (const asset of assets) {
      const pair = assessPair(asset, excavation, config);
      if (pair) pairs.push(pair);
    }
  }

  const pairsByAsset = new Map<string, PairAssessment[]>();
  for (const pair of pairs) {
    const list = pairsByAsset.get(pair.asset.id) ?? [];
    list.push(pair);
    pairsByAsset.set(pair.asset.id, list);
  }

  const shared = baseAssumptions(config);
  return pairs
    .map((pair): ClashResult => {
      const scheduleOverlap = findScheduleOverlap(pair, pairsByAsset.get(pair.asset.id) ?? []);
      const reasons = new Set(pair.reasonCodes);
      if (scheduleOverlap.hasOverlap) reasons.add("schedule-overlap");
      const evidence = buildEvidence(pair);
      return {
        id: clashId(pair.excavation.id, pair.asset.id),
        excavationId: pair.excavation.id,
        affectedAssetIds: [pair.asset.id],
        severity: pair.severity,
        confidence: pair.confidence,
        ...(evidence.horizontalDistanceM !== undefined ? { horizontalDistanceM: evidence.horizontalDistanceM } : {}),
        ...(evidence.verticalClearanceM !== undefined ? { verticalClearanceM: evidence.verticalClearanceM } : {}),
        scheduleOverlap,
        reasonCodes: CLASH_REASON_CODES.filter((code) => reasons.has(code)),
        explanation: buildExplanation(pair, scheduleOverlap, config),
        recommendedAction: buildAction(pair),
        evidence: [evidence],
        assumptions: [...shared, ...pair.assumptions],
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
