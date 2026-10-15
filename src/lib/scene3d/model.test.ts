import { describe, expect, it } from "vitest";
import { detectClashes } from "@/lib/clash-engine";
import { lineStringDistanceM } from "@/lib/clash-engine/geometry";
import { syntheticAssets, syntheticExcavations } from "@/lib/data/synthetic-data";
import type { ProjectDataset, UtilityAsset } from "@/types";
import {
  buildSceneModel,
  ILLUSTRATIVE_DEPTH_RANGES_M,
  choosePick,
  createSceneProjection,
  depthToSceneY,
  pickToFeature,
  rulerTicks,
  sceneOrigin,
  selectionTargets,
  utilityBottomDepthM,
  utilityDepthBand,
  utilityDepthModel,
} from "./model";

const dataset: ProjectDataset = {
  assets: syntheticAssets,
  excavations: syntheticExcavations,
  clashes: detectClashes(syntheticAssets, syntheticExcavations, { referenceDate: "2026-10-15" }),
};
const model = buildSceneModel(dataset);
const asset = (id: string) => syntheticAssets.find((a) => a.id === id) as UtilityAsset;

describe("coordinate transformation", () => {
  const project = createSceneProjection([77.597, 12.9745]);

  it("maps the origin to (0, 0)", () => {
    const p = project([77.597, 12.9745]);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.z).toBeCloseTo(0, 9);
  });

  it("maps east to +x and north to −z, in metres not degrees", () => {
    const east = project([77.598, 12.9745]);
    const north = project([77.597, 12.9755]);
    expect(east.x).toBeGreaterThan(100); // 0.001° of longitude ≈ 108 m here
    expect(east.x).toBeLessThan(115);
    expect(north.z).toBeLessThan(-100); // 0.001° of latitude ≈ 110.6 m, northwards is −z
    expect(north.z).toBeGreaterThan(-115);
  });

  it("preserves the clash engine's horizontal distances", () => {
    const a = asset("SYN-AST-T-01");
    const e = syntheticExcavations.find((x) => x.id === "SYN-EXC-01");
    if (!e) throw new Error("missing excavation");
    const toScene = createSceneProjection(model.origin);
    const [p] = a.geometry.coordinates.map(toScene);
    const [e1, e2] = e.geometry.coordinates.map(toScene);
    if (!p || !e1 || !e2) throw new Error("missing points");
    // Perpendicular distance from the asset start to the east–west trench centreline.
    const sceneDistance = Math.abs(p.z - e1.z);
    expect(e1.z).toBeCloseTo(e2.z, 3);
    expect(sceneDistance).toBeCloseTo(lineStringDistanceM(a.geometry, e.geometry), 2);
  });

  it("centres the origin on the data", () => {
    const [lng, lat] = sceneOrigin([
      [0, 0],
      [2, 4],
    ]);
    expect([lng, lat]).toEqual([1, 2]);
    expect(model.bounds.minX).toBeLessThan(0);
    expect(model.bounds.maxX).toBeGreaterThan(0);
  });
});

describe("depth conversion", () => {
  it("places positive depths below ground, scaled only by exaggeration", () => {
    expect(depthToSceneY(0)).toBe(0);
    expect(depthToSceneY(2)).toBe(-2);
    expect(depthToSceneY(2, 10)).toBe(-20);
  });

  it("puts a known pipe's centreline at top depth + radius", () => {
    expect(utilityDepthModel(asset("SYN-AST-S-01"))).toEqual({
      kind: "known",
      topDepthM: 2.0,
      diameterM: 0.45,
      centreDepthM: 2.225,
    });
  });

  it("uses planned depth for trenches", () => {
    for (const e of syntheticExcavations) {
      expect(model.trenches.find((t) => t.id === e.id)?.depthM).toBe(e.plannedDepthM);
    }
  });

  it("makes the scene deep enough for every recorded depth", () => {
    for (const e of syntheticExcavations) expect(model.maxDepthM).toBeGreaterThanOrEqual(e.plannedDepthM);
    expect(model.rulerTicks[0]).toBe(0);
    expect(model.rulerTicks.at(-1)).toBeCloseTo(model.maxDepthM, 6);
    expect(rulerTicks(1.5)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5]);
  });
});

describe("missing measurements", () => {
  it("never invents a depth for an asset without one", () => {
    const m = utilityDepthModel(asset("SYN-AST-G-02"));
    expect(m.kind).toBe("depth-unknown");
    expect("topDepthM" in m).toBe(false);
    expect("centreDepthM" in m).toBe(false);
  });

  it("keeps a known depth but no assumed size when diameter is missing", () => {
    const { diameterM: _d, ...noDiameter } = asset("SYN-AST-S-01");
    expect(utilityDepthModel(noDiameter)).toEqual({ kind: "diameter-unknown", topDepthM: 2.0 });
  });

  it("keeps uncertainty only when recorded", () => {
    expect(model.utilities.find((u) => u.id === "SYN-AST-G-02")?.depthUncertaintyM).toBeUndefined();
    expect(model.utilities.find((u) => u.id === "SYN-AST-W-03")?.depthUncertaintyM).toBe(0.9);
  });

  it("draws an uncertainty band only when depth and uncertainty are both recorded", () => {
    expect(utilityDepthBand({ depthM: 1.2, diameterM: 0.3, depthUncertaintyM: 0.2 })).toEqual({ topM: 1, bottomM: 1.7 });
    expect(utilityDepthBand({ depthM: 1.2, depthUncertaintyM: 0.2 })).toEqual({ topM: 1, bottomM: 1.4 });
    expect(utilityDepthBand({ depthM: 1.2, diameterM: 0.3 })).toBeUndefined();
    expect(utilityDepthBand({ depthUncertaintyM: 0.5 })).toBeUndefined();
    expect(model.utilities.find((u) => u.id === "SYN-AST-G-02")?.depthBand).toBeUndefined();
  });

  it("never lets an uncertainty band rise above ground level", () => {
    expect(utilityDepthBand({ depthM: 0.4, depthUncertaintyM: 0.9 })?.topM).toBe(0);
  });

  it("gives a bottom depth only when the diameter is recorded", () => {
    expect(utilityBottomDepthM({ depthM: 0.7, diameterM: 0.15 })).toBe(0.85);
    expect(utilityBottomDepthM({ depthM: 0.7 })).toBeUndefined();
    expect(utilityBottomDepthM({ diameterM: 0.063 })).toBeUndefined();
  });

  it("never fills a depth from the illustrative type ranges", () => {
    expect(ILLUSTRATIVE_DEPTH_RANGES_M.gas).toEqual([0.6, 1.0]);
    for (const a of syntheticAssets) {
      const depth = model.utilities.find((u) => u.id === a.id)?.depth;
      if (a.depthM === undefined) expect(depth?.kind).toBe("depth-unknown");
      else expect(depth && "topDepthM" in depth ? depth.topDepthM : undefined).toBe(a.depthM);
    }
    // SYN-AST-G-03 is recorded at 1.3 m, outside the illustrative gas range, and must stay there.
    expect(model.utilities.find((u) => u.id === "SYN-AST-G-03")?.depth).toMatchObject({ topDepthM: 1.3 });
  });

  it("puts deeper recorded utilities lower in the scene", () => {
    const y = (id: string) => {
      const d = model.utilities.find((u) => u.id === id)?.depth;
      return d && "topDepthM" in d ? depthToSceneY(d.topDepthM, 10) : NaN;
    };
    // Telecom at 0.6 m sits above water at 1.1 m, which sits above sewer at 2.0 m.
    expect(y("SYN-AST-T-01")).toBeGreaterThan(y("SYN-AST-W-01"));
    expect(y("SYN-AST-W-01")).toBeGreaterThan(y("SYN-AST-S-01"));
    expect(depthToSceneY(0, 10)).toBe(0);
  });

  it("carries the recorded trench depth tolerance without inventing one", () => {
    for (const e of syntheticExcavations) {
      expect(model.trenches.find((t) => t.id === e.id)?.depthUncertaintyM).toBe(e.depthUncertaintyM);
    }
  });
});

describe("engine results drive highlighting", () => {
  it("uses the worst engine severity per asset and nothing for unaffected assets", () => {
    expect(model.utilities.find((u) => u.id === "SYN-AST-S-01")?.worstSeverity).toBe("critical");
    expect(model.utilities.find((u) => u.id === "SYN-AST-G-02")?.worstSeverity).toBe("needs-data");
    expect(model.utilities.find((u) => u.id === "SYN-AST-W-01")?.worstSeverity).toBeNull();
  });

  it("marks cancelled trenches as excluded with no clashes", () => {
    const cancelled = model.trenches.find((t) => t.status === "cancelled");
    expect(cancelled?.excluded).toBe(true);
    expect(cancelled?.clashIds).toEqual([]);
  });

  it("links every clash to its asset and trench", () => {
    for (const c of dataset.clashes) {
      expect(model.trenches.find((t) => t.id === c.excavationId)?.clashIds).toContain(c.id);
      for (const id of c.affectedAssetIds) expect(model.utilities.find((u) => u.id === id)?.clashIds).toContain(c.id);
    }
  });
});

describe("selection mapping", () => {
  it("highlights the selected clash's asset and excavation", () => {
    const t = selectionTargets({ excavationId: "SYN-EXC-01", affectedAssetIds: ["SYN-AST-S-01"] }, {
      kind: "asset",
      id: "SYN-AST-S-01",
    });
    expect([...t.assetIds]).toEqual(["SYN-AST-S-01"]);
    expect([...t.excavationIds]).toEqual(["SYN-EXC-01"]);
  });

  it("highlights a selected feature that has no clash", () => {
    const t = selectionTargets(null, { kind: "excavation", id: "SYN-EXC-04" });
    expect([...t.excavationIds]).toEqual(["SYN-EXC-04"]);
    expect(t.assetIds.size).toBe(0);
  });

  it("returns nothing when nothing is selected", () => {
    const t = selectionTargets(null, null);
    expect(t.assetIds.size + t.excavationIds.size).toBe(0);
  });

  it("converts picks back to feature references, preferring utilities inside the clicked trench", () => {
    const exc = { kind: "excavation", id: "SYN-EXC-01" };
    const pipe = { kind: "asset", id: "SYN-AST-S-01" };
    expect(pickToFeature(pipe)).toEqual(pipe);
    expect(pickToFeature({ kind: "ground" })).toBeNull();
    expect(pickToFeature(null)).toBeNull();
    // Ray enters the trench, hits a pipe inside it, then exits: the pipe wins.
    expect(choosePick([exc, {}, pipe, exc])).toEqual(pipe);
    expect(choosePick([pipe, exc, exc])).toEqual(pipe);
    expect(choosePick([exc])).toEqual(exc);
    expect(choosePick([])).toBeNull();
  });

  it("selects the clicked trench, not a utility that is merely behind it", () => {
    const exc = { kind: "excavation", id: "SYN-EXC-02" };
    expect(choosePick([exc, exc, { kind: "asset", id: "SYN-AST-E-01" }])).toEqual(exc);
    expect(choosePick([exc, { kind: "asset", id: "SYN-AST-E-01" }])).toEqual(exc);
  });
});
