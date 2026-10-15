import { lineString, point, pointToLineDistance } from "@turf/turf";
import { describe, expect, it } from "vitest";
import { UTILITY_TYPES, WORK_STATUSES } from "@/types";
import type { ExcavationWork, UtilityAsset } from "@/types";
import { getProjectDataset } from "./index";
import { SYNTHETIC_SCENARIOS } from "./synthetic-data";

const isNonNegative = (v: number | undefined) => v === undefined || v >= 0;

describe("project dataset", () => {
  const { assets, excavations } = getProjectDataset();
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const excavationById = new Map(excavations.map((w) => [w.id, w]));

  const getAsset = (id: string): UtilityAsset => {
    const a = assetById.get(id);
    if (!a) throw new Error(`missing asset ${id}`);
    return a;
  };
  const getExcavation = (id: string): ExcavationWork => {
    const w = excavationById.get(id);
    if (!w) throw new Error(`missing excavation ${id}`);
    return w;
  };

  /** Distance (m) from an asset's first vertex to an excavation centreline. */
  const startDistanceM = (assetId: string, excavationId: string) =>
    pointToLineDistance(
      point(getAsset(assetId).geometry.coordinates[0] ?? []),
      lineString(getExcavation(excavationId).geometry.coordinates),
      { units: "meters" },
    );

  it("has 12–15 assets covering every utility type and 4 excavations", () => {
    expect(assets.length).toBeGreaterThanOrEqual(12);
    expect(assets.length).toBeLessThanOrEqual(15);
    expect(new Set(assets.map((a) => a.type))).toEqual(new Set(UTILITY_TYPES));
    expect(excavations).toHaveLength(4);
  });

  it("has unique ids, all labelled synthetic", () => {
    const ids = [...assets, ...excavations].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("SYN-")).toBe(true);
    for (const a of assets) expect(a.source.startsWith("SYNTHETIC")).toBe(true);
  });

  it("has valid assets", () => {
    for (const a of assets) {
      expect(UTILITY_TYPES).toContain(a.type);
      expect(a.geometry.type).toBe("LineString");
      expect(a.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      if (a.depthM !== undefined) expect(a.depthM).toBeGreaterThan(0);
      expect(isNonNegative(a.depthUncertaintyM)).toBe(true);
      expect(isNonNegative(a.horizontalUncertaintyM)).toBe(true);
      expect(isNonNegative(a.diameterM)).toBe(true);
    }
  });

  it("has valid excavations", () => {
    for (const w of excavations) {
      expect(WORK_STATUSES).toContain(w.status);
      expect(w.geometry.type).toBe("LineString");
      expect(w.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(w.plannedDepthM).toBeGreaterThan(0);
      expect(w.widthM).toBeGreaterThan(0);
      expect(w.schedule.startDate <= w.schedule.endDate).toBe(true);
    }
  });

  it("uses [longitude, latitude] order", () => {
    const positions = [...assets, ...excavations].flatMap((x) => x.geometry.coordinates);
    for (const [lng, lat] of positions) {
      expect(Math.abs(lng ?? NaN)).toBeLessThanOrEqual(180);
      expect(Math.abs(lat ?? NaN)).toBeLessThanOrEqual(90);
    }
  });

  it("references only existing records in scenario mappings", () => {
    for (const { assetIds, excavationIds } of Object.values(SYNTHETIC_SCENARIOS)) {
      for (const id of assetIds) expect(assetById.has(id)).toBe(true);
      for (const id of excavationIds) expect(excavationById.has(id)).toBe(true);
    }
  });

  it("leaves the missing-depth scenario's depth undefined", () => {
    const a = getAsset(SYNTHETIC_SCENARIOS.missingAssetDepth.assetIds[0]);
    expect(a.depthM).toBeUndefined();
    expect(a.depthUncertaintyM).toBeUndefined();
  });

  it("places geometry-sensitive scenarios at their documented distances", () => {
    // Scenario 2: centreline 1.3 m from EXC-01 centreline (0.7 m from edge, inside the 1.0 m buffer).
    expect(startDistanceM("SYN-AST-T-01", "SYN-EXC-01")).toBeCloseTo(1.3, 1);
    // Scenario 5: centreline 3.8 m from EXC-02 centreline (3.5 m from edge).
    expect(startDistanceM("SYN-AST-T-02", "SYN-EXC-02")).toBeCloseTo(3.8, 1);
  });
});
