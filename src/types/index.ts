/**
 * Shared domain types for Subterra Clash.
 *
 * Conventions:
 * - Geometry is GeoJSON (RFC 7946) with positions in [longitude, latitude] order (WGS84).
 * - All linear measurements are in metres; depths are positive values below the ground surface.
 * - A measurement that is not known is omitted (`undefined`). Missing values never mean zero.
 * - Dates are ISO 8601 calendar dates (YYYY-MM-DD), inclusive.
 *
 * This module is framework-free: no React, UI, or I/O imports.
 */
import type { LineString } from "geojson";

/** ISO 8601 calendar date, e.g. "2026-11-02". */
export type IsoDate = string;

// ---------------------------------------------------------------------------
// Enumerations (const arrays allow runtime validation and UI iteration)
// ---------------------------------------------------------------------------

export const UTILITY_TYPES = ["water", "sewer", "electric", "gas", "telecom"] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

export const WORK_STATUSES = ["planned", "active", "delayed", "cancelled"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

/** `needs-data` means a clash cannot be ruled out because required measurements are missing. */
export const CONFLICT_SEVERITIES = ["critical", "high", "medium", "low", "needs-data"] as const;
export type ConflictSeverity = (typeof CONFLICT_SEVERITIES)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const REVIEW_STATUSES = ["open", "under-review", "inspected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// ---------------------------------------------------------------------------
// Utility assets
// ---------------------------------------------------------------------------

/** How an asset's position was originally captured. */
export type PositionCaptureMethod = "surveyed" | "as-built" | "digitised" | "estimated";

export interface AssetDataQuality {
  /** Overall trust in this record. */
  confidence: ConfidenceLevel;
  captureMethod?: PositionCaptureMethod;
  notes?: string;
}

/** An existing buried utility, modelled as a centreline. */
export interface UtilityAsset {
  id: string;
  name: string;
  type: UtilityType;
  /** Asset centreline. */
  geometry: LineString;
  /** Recorded depth from ground surface to the top of the asset. Omitted when unknown. */
  depthM?: number;
  /** ± tolerance on `depthM`. */
  depthUncertaintyM?: number;
  /** Outside diameter (pipes) or overall width (ducts, cable banks). */
  diameterM?: number;
  /** ± tolerance on the plan position of the centreline. */
  horizontalUncertaintyM?: number;
  /** Where the record came from, e.g. "Water Board GIS export". */
  source: string;
  surveyDate?: IsoDate;
  owner?: string;
  dataQuality?: AssetDataQuality;
}

// ---------------------------------------------------------------------------
// Excavation works
// ---------------------------------------------------------------------------

export interface WorkSchedule {
  startDate: IsoDate;
  /** Inclusive; must not be before `startDate`. */
  endDate: IsoDate;
}

/** A proposed excavation, modelled as a corridor of `widthM` centred on a line. */
export interface ExcavationWork {
  id: string;
  name: string;
  /** Corridor centreline. */
  geometry: LineString;
  /** Maximum planned depth below ground surface. */
  plannedDepthM: number;
  /** Full corridor width (half on each side of the centreline). */
  widthM: number;
  /** ± tolerance on `plannedDepthM` (e.g. over-dig allowance). */
  depthUncertaintyM?: number;
  /** ± tolerance on the corridor's plan position. */
  horizontalUncertaintyM?: number;
  schedule: WorkSchedule;
  status: WorkStatus;
  contractor?: string;
}

// ---------------------------------------------------------------------------
// Clash detection results
// ---------------------------------------------------------------------------

export const CLASH_REASON_CODES = [
  /** Asset centreline crosses the excavation corridor in plan. */
  "horizontal-intersection",
  /** Asset lies outside the corridor but within the horizontal safety buffer. */
  "within-horizontal-buffer",
  /** Excavation base reaches the asset's recorded depth. */
  "depth-intrusion",
  /** Excavation base is above the asset but within the vertical safety buffer. */
  "insufficient-vertical-clearance",
  "missing-asset-depth",
  "missing-asset-diameter",
  "high-position-uncertainty",
  "low-data-quality",
  "outdated-survey",
  /** Gas or electric: higher consequence of strike. */
  "high-consequence-utility",
  /** Another excavation affects the same asset during an overlapping period. */
  "schedule-overlap",
] as const;
export type ClashReasonCode = (typeof CLASH_REASON_CODES)[number];

export const INSPECTION_ACTIONS = [
  "no-action",
  "verify-records",
  "ground-penetrating-radar",
  "trial-hole",
  "owner-standby",
  "redesign-alignment",
] as const;
export type InspectionAction = (typeof INSPECTION_ACTIONS)[number];

export interface RecommendedAction {
  action: InspectionAction;
  /** Human-readable instruction for site teams. */
  summary: string;
}

/** Measurement fields whose absence can affect a clash assessment. */
export type AssetMeasurementField =
  | "depthM"
  | "depthUncertaintyM"
  | "diameterM"
  | "horizontalUncertaintyM"
  | "surveyDate";

/** Per-asset measurements behind a clash result. */
export interface AssetClashEvidence {
  assetId: string;
  /** Plan distance from asset centreline to the corridor edge; 0 when they intersect. Omitted if not computed. */
  horizontalDistanceM?: number;
  /** Asset top depth minus excavation base depth; negative means the dig reaches the asset. Omitted when asset depth is unknown. */
  verticalClearanceM?: number;
  /** Combined asset + excavation horizontal tolerance applied. */
  combinedHorizontalUncertaintyM?: number;
  /** Combined asset + excavation depth tolerance applied. */
  combinedDepthUncertaintyM?: number;
  /** Fields that were missing and therefore treated as unknown. */
  missingFields: AssetMeasurementField[];
}

export interface ScheduleOverlap {
  /** True when other excavations affecting the same assets run during an overlapping period. */
  hasOverlap: boolean;
  overlappingExcavationIds: string[];
  /** Intersection of the overlapping periods; omitted when `hasOverlap` is false. */
  overlapWindow?: WorkSchedule;
}

/**
 * One clash between an excavation and one or more assets.
 * Produced by the clash engine; does not carry review state (see `ReviewRecord`).
 */
export interface ClashResult {
  /** Deterministic for a given excavation/asset set, so review records survive re-runs. */
  id: string;
  excavationId: string;
  affectedAssetIds: string[];
  severity: ConflictSeverity;
  confidence: ConfidenceLevel;
  /** Governing (smallest) horizontal distance across affected assets. Omitted if unknown. */
  horizontalDistanceM?: number;
  /** Governing (smallest) vertical clearance across affected assets. Omitted if unknown. */
  verticalClearanceM?: number;
  scheduleOverlap: ScheduleOverlap;
  reasonCodes: ClashReasonCode[];
  explanation: string;
  recommendedAction: RecommendedAction;
  evidence: AssetClashEvidence[];
  /** Assumptions the engine made, e.g. default buffers or substituted values. */
  assumptions: string[];
}

// ---------------------------------------------------------------------------
// Review workflow
// ---------------------------------------------------------------------------

/** Human review state for a clash, stored separately from engine output and keyed by `clashId`. */
export interface ReviewRecord {
  clashId: string;
  status: ReviewStatus;
  /** ISO 8601 timestamp of the last status change. */
  updatedAt?: string;
  reviewer?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Aggregate dataset
// ---------------------------------------------------------------------------

/** The single shared dataset consumed by every UI surface. */
export interface ProjectDataset {
  assets: UtilityAsset[];
  excavations: ExcavationWork[];
  clashes: ClashResult[];
}
