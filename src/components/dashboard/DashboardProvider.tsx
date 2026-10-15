"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DashboardData } from "@/lib/data";
import { clashForFeature, type FeatureRef } from "@/lib/selection";
import {
  assessDataQuality,
  collectScheduleOverlaps,
  rankClashes,
  summarizeDataset,
  type DataQualityReport,
  type DatasetSummary,
  type ScheduleOverlapGroup,
} from "@/lib/reports";
import type {
  ClashResult,
  ConflictSeverity,
  ExcavationWork,
  ProjectDataset,
  ReviewRecord,
  ReviewStatus,
  UtilityAsset,
  UtilityType,
} from "@/types";

export type { FeatureRef };
export type SortMode = "priority" | "distance" | "excavation";

export interface ConflictFilters {
  query: string;
  severities: ConflictSeverity[];
  utilityTypes: UtilityType[];
  sort: SortMode;
}

const EMPTY_FILTERS: ConflictFilters = { query: "", severities: [], utilityTypes: [], sort: "priority" };
const REVIEW_STORAGE_KEY = "subterra-clash.reviews.v1";

interface DashboardContextValue {
  dataset: ProjectDataset;
  analysisDate: string;
  config: DashboardData["config"];
  summary: DatasetSummary;
  dataQuality: DataQualityReport;
  scheduleOverlaps: ScheduleOverlapGroup[];
  /** All clashes in review-priority order. */
  rankedClashes: ClashResult[];
  assetById: ReadonlyMap<string, UtilityAsset>;
  excavationById: ReadonlyMap<string, ExcavationWork>;
  clashesByAsset: ReadonlyMap<string, ClashResult[]>;

  selectedClash: ClashResult | null;
  selectedFeature: FeatureRef | null;
  selectClash: (id: string | null) => void;
  selectFeature: (feature: FeatureRef | null) => void;

  filters: ConflictFilters;
  setFilters: (update: Partial<ConflictFilters>) => void;
  resetFilters: () => void;
  filteredClashes: ClashResult[];

  reviewStatusOf: (clashId: string) => ReviewStatus;
  setReviewStatus: (clashId: string, status: ReviewStatus) => void;

  /** Spatial view mode, shared so the choice persists across pages. */
  spatialView: SpatialView;
  setSpatialView: (view: SpatialView) => void;
}

export type SpatialView = "2d" | "3d";

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return ctx;
}

function groupBy<T>(items: readonly T[], keys: (item: T) => readonly string[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    for (const key of keys(item)) map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

export function DashboardProvider({ data, children }: { data: DashboardData; children: ReactNode }) {
  const { dataset, analysisDate, config } = data;

  const derived = useMemo(() => {
    const rankedClashes = rankClashes(dataset.clashes);
    return {
      summary: summarizeDataset(dataset),
      dataQuality: assessDataQuality(dataset.assets, analysisDate, config),
      scheduleOverlaps: collectScheduleOverlaps(dataset),
      rankedClashes,
      assetById: new Map(dataset.assets.map((a) => [a.id, a])),
      excavationById: new Map(dataset.excavations.map((e) => [e.id, e])),
      clashesByAsset: groupBy(rankedClashes, (c) => c.affectedAssetIds),
      clashesByExcavation: groupBy(rankedClashes, (c) => [c.excavationId]),
    };
  }, [dataset, analysisDate, config]);

  // --- Selection (shared by queue, map, cross-section and detail panel) -------------------------
  const [selectedClashId, setSelectedClashId] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<FeatureRef | null>(null);

  const selectClash = useCallback(
    (id: string | null) => {
      setSelectedClashId(id);
      const clash = id ? derived.rankedClashes.find((c) => c.id === id) : undefined;
      const assetId = clash?.affectedAssetIds[0];
      setSelectedFeature(assetId ? { kind: "asset", id: assetId } : null);
    },
    [derived.rankedClashes],
  );

  const selectFeature = useCallback(
    (feature: FeatureRef | null) => {
      setSelectedFeature(feature);
      if (!feature) return setSelectedClashId(null);
      // Only a conflict involving this feature; never another feature's top-ranked conflict.
      setSelectedClashId(clashForFeature(feature, derived.rankedClashes)?.id ?? null);
    },
    [derived.rankedClashes],
  );

  // --- Filters -----------------------------------------------------------------------------------
  const [filters, setFilterState] = useState<ConflictFilters>(EMPTY_FILTERS);
  const setFilters = useCallback((update: Partial<ConflictFilters>) => {
    setFilterState((prev) => ({ ...prev, ...update }));
  }, []);
  const resetFilters = useCallback(() => setFilterState(EMPTY_FILTERS), []);

  const filteredClashes = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const list = derived.rankedClashes.filter((c) => {
      if (filters.severities.length && !filters.severities.includes(c.severity)) return false;
      const assets = c.affectedAssetIds.map((id) => derived.assetById.get(id));
      if (filters.utilityTypes.length && !assets.some((a) => a && filters.utilityTypes.includes(a.type))) {
        return false;
      }
      if (!q) return true;
      const exc = derived.excavationById.get(c.excavationId);
      const haystack = [c.id, c.excavationId, exc?.name, ...c.affectedAssetIds, ...assets.map((a) => a?.name)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    if (filters.sort === "distance") {
      list.sort((a, b) => (a.horizontalDistanceM ?? Infinity) - (b.horizontalDistanceM ?? Infinity));
    } else if (filters.sort === "excavation") {
      list.sort((a, b) => a.excavationId.localeCompare(b.excavationId));
    }
    return list;
  }, [derived, filters]);

  // --- Manual review records (browser-local; never set automatically) ----------------------------
  const [reviews, setReviews] = useState<Record<string, ReviewRecord>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY);
      if (raw) setReviews(JSON.parse(raw) as Record<string, ReviewRecord>);
    } catch {
      // Storage unavailable or corrupt: start with every clash open.
    }
  }, []);

  const setReviewStatus = useCallback((clashId: string, status: ReviewStatus) => {
    setReviews((prev) => {
      const next = { ...prev, [clashId]: { clashId, status, updatedAt: new Date().toISOString() } };
      try {
        window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Non-persistent session: state still applies in memory.
      }
      return next;
    });
  }, []);

  const reviewStatusOf = useCallback((clashId: string) => reviews[clashId]?.status ?? "open", [reviews]);

  const [spatialView, setSpatialView] = useState<SpatialView>("2d");

  const selectedClash = useMemo(
    () => derived.rankedClashes.find((c) => c.id === selectedClashId) ?? null,
    [derived.rankedClashes, selectedClashId],
  );

  const value: DashboardContextValue = {
    dataset,
    analysisDate,
    config,
    ...derived,
    selectedClash,
    selectedFeature,
    selectClash,
    selectFeature,
    filters,
    setFilters,
    resetFilters,
    filteredClashes,
    reviewStatusOf,
    setReviewStatus,
    spatialView,
    setSpatialView,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
