/**
 * Map marker placement for clash results. This is display geometry only: the clash engine does not
 * output a location, so each marker sits where the recorded centrelines cross, or else at their
 * closest approach on the asset. Severity and every other attribute come from the engine result.
 */
import { lineIntersect, lineString, nearestPointOnLine, point } from "@turf/turf";
import type { Position } from "geojson";
import type { ClashResult, ConflictSeverity, ExcavationWork, UtilityAsset } from "@/types";

export interface ConflictMarker {
  clashId: string;
  severity: ConflictSeverity;
  /** [longitude, latitude]. */
  position: [number, number];
  /** True when the recorded centrelines intersect at this point; false for a closest-approach point. */
  centrelinesCross: boolean;
}

function closestApproachOnAsset(asset: UtilityAsset, excavation: ExcavationWork): [number, number] | null {
  const assetLine = lineString(asset.geometry.coordinates);
  const excLine = lineString(excavation.geometry.coordinates);
  let best: { position: Position; dist: number } | null = null;
  const consider = (position: Position | undefined, dist: number | undefined) => {
    if (position && dist !== undefined && (!best || dist < best.dist)) best = { position, dist };
  };
  // Excavation vertices projected onto the asset line.
  for (const v of excavation.geometry.coordinates) {
    const p = nearestPointOnLine(assetLine, point(v), { units: "meters" });
    consider(p.geometry.coordinates, p.properties.dist);
  }
  // Asset vertices measured against the excavation line (marker stays on the asset).
  for (const v of asset.geometry.coordinates) {
    const p = nearestPointOnLine(excLine, point(v), { units: "meters" });
    consider(v, p.properties.dist);
  }
  const found = best as { position: Position; dist: number } | null;
  const [lng, lat] = found?.position ?? [];
  return lng === undefined || lat === undefined ? null : [lng, lat];
}

export function conflictMarkers(
  clashes: readonly ClashResult[],
  assets: readonly UtilityAsset[],
  excavations: readonly ExcavationWork[],
): ConflictMarker[] {
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const excavationById = new Map(excavations.map((e) => [e.id, e]));
  const markers: ConflictMarker[] = [];

  for (const clash of clashes) {
    const asset = assetById.get(clash.affectedAssetIds[0] ?? "");
    const excavation = excavationById.get(clash.excavationId);
    if (!asset || !excavation) continue;
    const crossing = lineIntersect(lineString(asset.geometry.coordinates), lineString(excavation.geometry.coordinates));
    const first = crossing.features[0]?.geometry.coordinates;
    const position =
      first && first[0] !== undefined && first[1] !== undefined
        ? ([first[0], first[1]] as [number, number])
        : closestApproachOnAsset(asset, excavation);
    if (!position) continue;
    markers.push({ clashId: clash.id, severity: clash.severity, position, centrelinesCross: Boolean(first) });
  }
  return markers;
}
