import type { IsoDate } from "@/types";

/** All thresholds used by the clash engine. Every length is in metres. */
export interface ClashEngineConfig {
  /** Required plan clearance between an asset's outer surface and the excavation corridor edge. */
  horizontalBufferM: number;
  /** Required vertical gap between the excavation base and the asset top. */
  verticalBufferM: number;
  /** Substituted when an asset has no recorded horizontal uncertainty (never treated as zero). */
  assumedAssetHorizontalUncertaintyM: number;
  /** Substituted when an asset has a depth but no recorded depth uncertainty. */
  assumedAssetDepthUncertaintyM: number;
  /** Substituted when an asset has no recorded diameter. */
  assumedAssetDiameterM: number;
  /** Substituted when an excavation has no recorded horizontal tolerance. */
  assumedExcavationHorizontalUncertaintyM: number;
  /** Substituted when an excavation has no recorded depth tolerance. */
  assumedExcavationDepthUncertaintyM: number;
  /** Recorded asset horizontal uncertainty at or above this is flagged as high. */
  highHorizontalUncertaintyM: number;
  /** Surveys older than this (relative to `referenceDate`) are flagged as outdated. */
  outdatedSurveyYears: number;
  /** "Today" for survey-age checks (YYYY-MM-DD). Defaults to the current UTC date. */
  referenceDate?: IsoDate;
}

export const DEFAULT_CLASH_CONFIG: Readonly<ClashEngineConfig> = {
  horizontalBufferM: 1.0,
  verticalBufferM: 0.3,
  assumedAssetHorizontalUncertaintyM: 1.0,
  assumedAssetDepthUncertaintyM: 0.3,
  assumedAssetDiameterM: 0.3,
  assumedExcavationHorizontalUncertaintyM: 0.25,
  assumedExcavationDepthUncertaintyM: 0.15,
  highHorizontalUncertaintyM: 1.0,
  outdatedSurveyYears: 20,
};

export type ResolvedClashEngineConfig = Required<ClashEngineConfig>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Merges overrides onto the defaults and validates the result. */
export function resolveConfig(overrides: Partial<ClashEngineConfig> = {}): ResolvedClashEngineConfig {
  const config: ResolvedClashEngineConfig = {
    ...DEFAULT_CLASH_CONFIG,
    referenceDate: new Date().toISOString().slice(0, 10),
    ...overrides,
  };
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "number" && !(Number.isFinite(value) && value >= 0)) {
      throw new RangeError(`Clash engine config "${key}" must be a finite, non-negative number`);
    }
  }
  if (!ISO_DATE.test(config.referenceDate)) {
    throw new RangeError(`Clash engine config "referenceDate" must be YYYY-MM-DD`);
  }
  return config;
}
