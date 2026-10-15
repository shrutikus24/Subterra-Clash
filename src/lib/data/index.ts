import { detectClashes, resolveConfig, type ResolvedClashEngineConfig } from "@/lib/clash-engine";
import type { IsoDate, ProjectDataset } from "@/types";
import { syntheticAssets, syntheticExcavations } from "./synthetic-data";

export interface DashboardData {
  dataset: ProjectDataset;
  /** Reference date the clash engine used for survey-age checks (UTC, YYYY-MM-DD). */
  analysisDate: IsoDate;
  /** Exact thresholds the engine ran with, so the UI can display them without drifting. */
  config: ResolvedClashEngineConfig;
}

let cached: DashboardData | null = null;

/**
 * Single source of truth: raw assets and excavations, plus clashes derived from them by the clash engine.
 * Every UI surface reads from this data rather than loading or computing it independently.
 */
export function getDashboardData(): DashboardData {
  if (!cached) {
    const analysisDate = new Date().toISOString().slice(0, 10);
    const config = resolveConfig({ referenceDate: analysisDate });
    cached = {
      analysisDate,
      config,
      dataset: {
        assets: syntheticAssets,
        excavations: syntheticExcavations,
        clashes: detectClashes(syntheticAssets, syntheticExcavations, config),
      },
    };
  }
  return cached;
}

export function getProjectDataset(): ProjectDataset {
  return getDashboardData().dataset;
}
