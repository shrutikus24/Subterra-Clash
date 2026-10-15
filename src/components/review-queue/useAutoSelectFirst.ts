"use client";

import { useEffect, useRef } from "react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

/**
 * Selects the top-priority conflict once on arrival, so detail panels are populated. Running only once
 * keeps a later deliberate selection (e.g. a cancelled excavation on the map) from being overridden.
 */
export function useAutoSelectFirst() {
  const { filteredClashes, selectedClash, selectedFeature, selectClash } = useDashboard();
  const first = filteredClashes[0]?.id;
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (!selectedClash && !selectedFeature && first) selectClash(first);
  }, [first, selectedClash, selectedFeature, selectClash]);
}
