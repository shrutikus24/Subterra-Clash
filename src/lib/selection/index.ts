/**
 * Shared-selection rule: which engine result accompanies a clicked asset or excavation. Only a
 * conflict that involves the clicked feature itself is ever chosen; otherwise nothing is.
 */
import { rankClashes } from "@/lib/reports";
import type { ClashResult } from "@/types";

export type FeatureRef = { kind: "asset" | "excavation"; id: string };

/** Highest-priority engine result involving `feature`, or null when it has none. */
export function clashForFeature(feature: FeatureRef, clashes: readonly ClashResult[]): ClashResult | null {
  const involved = clashes.filter((c) =>
    feature.kind === "asset" ? c.affectedAssetIds.includes(feature.id) : c.excavationId === feature.id,
  );
  return rankClashes(involved)[0] ?? null;
}
