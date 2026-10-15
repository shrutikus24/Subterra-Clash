import { describe, expect, it } from "vitest";
import { detectClashes } from "@/lib/clash-engine";
import { createLocalProjection } from "@/lib/clash-engine/geometry";
import { SYNTHETIC_ORIGIN, syntheticAssets, syntheticExcavations } from "@/lib/data/synthetic-data";
import { buildSceneModel, selectionTargets } from "@/lib/scene3d/model";
import { conflictMarkers } from "./markers";

const clashes = detectClashes(syntheticAssets, syntheticExcavations, { referenceDate: "2026-10-15" });
const markers = conflictMarkers(clashes, syntheticAssets, syntheticExcavations);
const local = createLocalProjection(SYNTHETIC_ORIGIN);
const markerFor = (id: string) => markers.find((m) => m.clashId === id);

describe("conflictMarkers", () => {
  it("creates exactly one marker per engine result, carrying its severity", () => {
    expect(markers).toHaveLength(clashes.length);
    for (const c of clashes) expect(markerFor(c.id)?.severity).toBe(c.severity);
  });

  it("places a crossing marker at the centreline intersection", () => {
    // SYN-AST-S-01 (x = −30 m) crosses SYN-EXC-01 (y = 0) in the synthetic local frame.
    const m = markerFor("CLASH:SYN-EXC-01:SYN-AST-S-01");
    expect(m?.centrelinesCross).toBe(true);
    const [x, y] = local(m?.position ?? [0, 0]);
    expect(x).toBeCloseTo(-30, 0);
    expect(y).toBeCloseTo(0, 0);
  });

  it("uses a closest-approach point (flagged as not crossing) for near conflicts", () => {
    // SYN-AST-T-01 runs parallel to SYN-EXC-01 at y = 1.3 m; the marker stays on the asset.
    const m = markerFor("CLASH:SYN-EXC-01:SYN-AST-T-01");
    expect(m?.centrelinesCross).toBe(false);
    const [, y] = local(m?.position ?? [0, 0]);
    expect(y).toBeCloseTo(1.3, 1);
  });

  it("never creates markers for cancelled works", () => {
    expect(markers.some((m) => m.clashId.includes("SYN-EXC-04"))).toBe(false);
  });
});

describe("2D/3D selection agreement", () => {
  const model = buildSceneModel({ assets: syntheticAssets, excavations: syntheticExcavations, clashes });

  it("resolves every 2D marker to the same engine clash, asset and trench in the 3D scene", () => {
    for (const m of markers) {
      const clash = clashes.find((c) => c.id === m.clashId);
      expect(clash).toBeDefined();
      if (!clash) continue;
      const targets = selectionTargets(clash, null);
      expect([...targets.excavationIds]).toEqual([clash.excavationId]);
      expect([...targets.assetIds]).toEqual(clash.affectedAssetIds);
      for (const id of targets.assetIds) expect(model.utilities.find((u) => u.id === id)?.clashIds).toContain(clash.id);
      expect(model.trenches.find((t) => t.id === clash.excavationId)?.clashIds).toContain(clash.id);
    }
  });
});
