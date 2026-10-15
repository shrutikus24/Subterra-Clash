/**
 * Classification rules: horizontal and vertical states, severity, confidence and recommended action.
 * Pure functions over numbers and enums so each rule can be tested in isolation.
 */
import type { ConfidenceLevel, ConflictSeverity, InspectionAction } from "@/types";

/** Rounds to micrometres so tolerance comparisons are not tripped by floating-point noise. */
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

// ---------------------------------------------------------------------------
// Horizontal
// ---------------------------------------------------------------------------

export type HorizontalState =
  /** Asset's outer surface touches or lies inside the excavation corridor. */
  | "intersecting"
  /** Nominally outside the corridor but within the horizontal buffer. */
  | "within-buffer"
  /** Nominally beyond the buffer, but within it once position uncertainty is applied. */
  | "within-uncertainty"
  | "clear";

export interface HorizontalAssessment {
  state: HorizontalState;
  /** Asset outer surface to corridor edge; negative when overlapping the corridor. */
  outerDistanceM: number;
}

export function assessHorizontal(input: {
  edgeDistanceM: number;
  assetRadiusM: number;
  combinedUncertaintyM: number;
  bufferM: number;
}): HorizontalAssessment {
  const outerDistanceM = r6(input.edgeDistanceM - input.assetRadiusM);
  const state: HorizontalState =
    outerDistanceM <= 0
      ? "intersecting"
      : outerDistanceM <= input.bufferM
        ? "within-buffer"
        : outerDistanceM <= r6(input.bufferM + input.combinedUncertaintyM)
          ? "within-uncertainty"
          : "clear";
  return { state, outerDistanceM };
}

// ---------------------------------------------------------------------------
// Vertical
// ---------------------------------------------------------------------------

export type VerticalState =
  /** No asset depth: relationship cannot be assessed. */
  | "unknown"
  /** Clearance is below the buffer across the whole tolerance range. */
  | "violation-confirmed"
  /** Nominal clearance is below the buffer, but the tolerance range also allows adequate clearance. */
  | "violation-likely"
  /** Nominal clearance meets the buffer, but the tolerance range allows a violation. */
  | "clearance-uncertain"
  /** Clearance meets the buffer across the whole tolerance range. */
  | "clear";

export interface VerticalAssessment {
  state: VerticalState;
  /** Asset top depth minus excavation depth; negative means the dig reaches below the asset top. */
  clearanceM?: number;
  combinedUncertaintyM?: number;
  worstCaseClearanceM?: number;
  bestCaseClearanceM?: number;
}

export function assessVertical(input: {
  assetTopDepthM: number | undefined;
  assetDepthUncertaintyM: number;
  excavationDepthM: number;
  excavationDepthUncertaintyM: number;
  bufferM: number;
}): VerticalAssessment {
  if (input.assetTopDepthM === undefined) return { state: "unknown" };
  const clearanceM = r6(input.assetTopDepthM - input.excavationDepthM);
  const combinedUncertaintyM = r6(input.assetDepthUncertaintyM + input.excavationDepthUncertaintyM);
  const worstCaseClearanceM = r6(clearanceM - combinedUncertaintyM);
  const bestCaseClearanceM = r6(clearanceM + combinedUncertaintyM);
  const state: VerticalState =
    bestCaseClearanceM < input.bufferM
      ? "violation-confirmed"
      : clearanceM < input.bufferM
        ? "violation-likely"
        : worstCaseClearanceM < input.bufferM
          ? "clearance-uncertain"
          : "clear";
  return { state, clearanceM, combinedUncertaintyM, worstCaseClearanceM, bestCaseClearanceM };
}

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

const ESCALATE: Partial<Record<ConflictSeverity, ConflictSeverity>> = { medium: "high", high: "critical" };

export function determineSeverity(input: {
  horizontal: Exclude<HorizontalState, "clear">;
  vertical: VerticalAssessment;
  /** Asset record is low-quality or contradictory, so nominal values cannot be relied upon. */
  unreliableRecord: boolean;
  /** Gas or electric: higher consequence of a strike. */
  highConsequence: boolean;
}): ConflictSeverity {
  const { horizontal, vertical } = input;

  if (vertical.state === "unknown" || vertical.state === "clearance-uncertain") return "needs-data";
  if (vertical.state === "violation-likely" && input.unreliableRecord) return "needs-data";
  if (vertical.state === "clear") return "low";

  const confirmed = vertical.state === "violation-confirmed";
  const intrusion = (vertical.clearanceM ?? 0) < 0;
  let base: ConflictSeverity;
  if (horizontal === "intersecting") {
    base = intrusion ? (confirmed ? "critical" : "high") : confirmed ? "high" : "medium";
  } else if (horizontal === "within-buffer") {
    base = confirmed ? "high" : "medium";
  } else {
    base = "medium";
  }
  return input.highConsequence ? (ESCALATE[base] ?? base) : base;
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export function determineConfidence(input: {
  horizontal: HorizontalState;
  vertical: VerticalState;
  recordQuality: ConfidenceLevel | undefined;
  usedAssumedValues: boolean;
  outdatedSurvey: boolean;
  surveyDateMissing: boolean;
}): ConfidenceLevel {
  if (
    input.vertical === "unknown" ||
    input.vertical === "violation-likely" ||
    input.vertical === "clearance-uncertain" ||
    input.horizontal === "within-uncertainty" ||
    input.recordQuality === "low"
  ) {
    return "low";
  }
  if (
    input.recordQuality !== "high" ||
    input.usedAssumedValues ||
    input.outdatedSurvey ||
    input.surveyDateMissing
  ) {
    return "medium";
  }
  return "high";
}

// ---------------------------------------------------------------------------
// Recommended action
// ---------------------------------------------------------------------------

export function recommendAction(input: {
  severity: ConflictSeverity;
  horizontal: HorizontalState;
  highConsequence: boolean;
}): InspectionAction {
  const { severity, horizontal } = input;
  if (severity === "needs-data") return "trial-hole";
  if (severity === "low") return "verify-records";
  if (horizontal === "within-uncertainty") return "ground-penetrating-radar";
  if (severity === "critical") return input.highConsequence ? "owner-standby" : "trial-hole";
  if (horizontal === "within-buffer") return "redesign-alignment";
  return "trial-hole";
}
