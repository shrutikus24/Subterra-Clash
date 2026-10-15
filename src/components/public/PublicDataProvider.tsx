"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { EMPTY_WORK_FILTERS, filterWorks, type PublicData, type PublicWork, type WorkFilters } from "@/lib/public";

interface PublicContextValue extends PublicData {
  workById: ReadonlyMap<string, PublicWork>;
  /** Filters are shared by the works list and the map, so a choice carries across pages. */
  filters: WorkFilters;
  setFilters: (update: Partial<WorkFilters>) => void;
  resetFilters: () => void;
  filteredWorks: PublicWork[];
}

const PublicContext = createContext<PublicContextValue | null>(null);

export function usePublicData(): PublicContextValue {
  const ctx = useContext(PublicContext);
  if (!ctx) throw new Error("usePublicData must be used inside <PublicDataProvider>");
  return ctx;
}

/** Holds only the public view model; the engineering dataset is never passed to the portal. */
export function PublicDataProvider({ data, children }: { data: PublicData; children: ReactNode }) {
  const [filters, setFilterState] = useState<WorkFilters>(EMPTY_WORK_FILTERS);
  const setFilters = useCallback((update: Partial<WorkFilters>) => setFilterState((prev) => ({ ...prev, ...update })), []);
  const resetFilters = useCallback(() => setFilterState(EMPTY_WORK_FILTERS), []);

  const workById = useMemo(() => new Map(data.works.map((w) => [w.id, w])), [data.works]);
  const filteredWorks = useMemo(() => filterWorks(data.works, filters, data.asOf), [data.works, data.asOf, filters]);

  const value: PublicContextValue = { ...data, workById, filters, setFilters, resetFilters, filteredWorks };
  return <PublicContext.Provider value={value}>{children}</PublicContext.Provider>;
}
