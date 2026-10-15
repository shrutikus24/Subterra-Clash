import { describe, expect, it } from "vitest";
import { SYNTHETIC_SCENARIOS, syntheticAssets, syntheticExcavations } from "@/lib/data/synthetic-data";
import { CLASH_REASON_CODES, type ClashResult, type ExcavationWork, type UtilityAsset } from "@/types";
import { clashId, detectClashes } from "./index";

const REFERENCE_DATE = "2026-10-15";
const results = detectClashes(syntheticAssets, syntheticExcavations, { referenceDate: REFERENCE_DATE });

function resultFor(scenario: keyof typeof SYNTHETIC_SCENARIOS, excavationIndex = 0): ClashResult {
  const { assetIds, excavationIds } = SYNTHETIC_SCENARIOS[scenario];
  const assetId = assetIds[0];
  const excavationId = excavationIds[excavationIndex];
  if (!assetId || !excavationId) throw new Error(`bad scenario ${scenario}`);
  const result = results.find((r) => r.id === clashId(excavationId, assetId));
  if (!result) throw new Error(`no result for ${scenario} (${excavationId} × ${assetId})`);
  return result;
}

describe("synthetic scenarios", () => {
  it("1. direct crossing: critical, confident depth intrusion", () => {
    const r = resultFor("directCrossing");
    expect(r.severity).toBe("critical");
    expect(r.confidence).toBe("high");
    expect(r.horizontalDistanceM).toBe(0);
    expect(r.verticalClearanceM).toBeCloseTo(-0.5, 6);
    expect(r.reasonCodes).toEqual(expect.arrayContaining(["horizontal-intersection", "depth-intrusion"]));
  });

  it("2. near-conflict: within buffer, not a crossing", () => {
    const r = resultFor("nearConflictWithinBuffer");
    expect(r.reasonCodes).toContain("within-horizontal-buffer");
    expect(r.reasonCodes).not.toContain("horizontal-intersection");
    expect(r.horizontalDistanceM).toBeGreaterThan(0.6);
    expect(r.horizontalDistanceM).toBeLessThan(1.0);
    expect(r.severity).toBe("high");
    expect(r.recommendedAction.action).toBe("redesign-alignment");
  });

  it("3. likely safe separation: reported low, with clearance, not dismissed", () => {
    const r = resultFor("likelySafeSeparation");
    expect(r.severity).toBe("low");
    expect(r.confidence).toBe("high");
    expect(r.verticalClearanceM).toBeCloseTo(1.3, 6);
    expect(r.reasonCodes).not.toContain("depth-intrusion");
    expect(r.reasonCodes).not.toContain("insufficient-vertical-clearance");
    expect(r.recommendedAction.action).toBe("verify-records");
    expect(r.explanation).toMatch(/provided the recorded depth is correct/);
  });

  it("4. missing depth: needs-data, clearance left undefined", () => {
    const r = resultFor("missingAssetDepth");
    expect(r.severity).toBe("needs-data");
    expect(r.confidence).toBe("low");
    expect(r.verticalClearanceM).toBeUndefined();
    expect(r.evidence[0]?.verticalClearanceM).toBeUndefined();
    expect(r.evidence[0]?.missingFields).toEqual(expect.arrayContaining(["depthM", "depthUncertaintyM"]));
    expect(r.reasonCodes).toContain("missing-asset-depth");
    expect(r.recommendedAction.action).toBe("trial-hole");
  });

  it("5. high horizontal uncertainty: flagged only because of uncertainty", () => {
    const r = resultFor("highHorizontalUncertainty");
    expect(r.horizontalDistanceM).toBeGreaterThan(1.0); // nominally outside the buffer
    expect(r.evidence[0]?.combinedHorizontalUncertaintyM).toBeCloseTo(3.2, 6);
    expect(r.reasonCodes).toContain("high-position-uncertainty");
    expect(r.reasonCodes).not.toContain("within-horizontal-buffer");
    expect(r.confidence).toBe("low");
    expect(r.recommendedAction.action).toBe("ground-penetrating-radar");
    expect(r.evidence[0]?.missingFields).toContain("surveyDate");
  });

  it("6. contradictory depth records: needs-data despite nominal intrusion", () => {
    const r = resultFor("contradictoryDepthRecords");
    expect(r.severity).toBe("needs-data");
    expect(r.verticalClearanceM).toBeCloseTo(-0.1, 6);
    expect(r.evidence[0]?.combinedDepthUncertaintyM).toBeCloseTo(1.0, 6);
    expect(r.reasonCodes).toEqual(expect.arrayContaining(["low-data-quality", "depth-intrusion"]));
    expect(r.explanation).toMatch(/Contradictory records/);
  });

  it("7. overlapping schedules: both works report each other with the shared window", () => {
    const a = resultFor("conflictWithOverlappingSchedules", 0);
    const b = resultFor("conflictWithOverlappingSchedules", 1);
    for (const r of [a, b]) {
      expect(r.severity).toBe("critical");
      expect(r.scheduleOverlap.hasOverlap).toBe(true);
      expect(r.scheduleOverlap.overlapWindow).toEqual({ startDate: "2026-11-02", endDate: "2026-11-20" });
      expect(r.reasonCodes).toContain("schedule-overlap");
    }
    expect(a.scheduleOverlap.overlappingExcavationIds).toEqual([b.excavationId]);
    expect(b.scheduleOverlap.overlappingExcavationIds).toEqual([a.excavationId]);
  });

  it("8. physical conflict without schedule overlap", () => {
    for (const index of [0, 1]) {
      const r = resultFor("conflictWithoutScheduleOverlap", index);
      expect(r.severity).toBe("critical");
      expect(r.scheduleOverlap).toEqual({ hasOverlap: false, overlappingExcavationIds: [] });
      expect(r.reasonCodes).not.toContain("schedule-overlap");
    }
  });

  it("9. cancelled excavation produces no results and no schedule overlaps", () => {
    const [cancelledId] = SYNTHETIC_SCENARIOS.cancelledExcavation.excavationIds;
    expect(results.some((r) => r.excavationId === cancelledId)).toBe(false);
    expect(results.some((r) => r.scheduleOverlap.overlappingExcavationIds.includes(cancelledId))).toBe(false);
  });

  it("10. uncertainty prevents a safety conclusion despite nominal clearance", () => {
    const r = resultFor("uncertaintyPreventsConclusion");
    expect(r.verticalClearanceM).toBeCloseTo(0.4, 6); // nominally passes the 0.3 m buffer
    expect(r.severity).toBe("needs-data");
    expect(r.confidence).toBe("low");
    expect(r.explanation).toMatch(/does not rule out intrusion/);
  });
});

describe("detectClashes behaviour", () => {
  it("is deterministic and free of duplicates", () => {
    const again = detectClashes(syntheticAssets, syntheticExcavations, { referenceDate: REFERENCE_DATE });
    expect(again).toEqual(results);
    expect(new Set(results.map((r) => r.id)).size).toBe(results.length);
  });

  it("does not flag background assets far from any excavation", () => {
    for (const id of ["SYN-AST-W-01", "SYN-AST-G-01", "SYN-AST-T-03"]) {
      expect(results.some((r) => r.affectedAssetIds.includes(id))).toBe(false);
    }
  });

  it("reports schedule overlap only as context, never creating a physical clash", () => {
    const farAsset = syntheticAssets.find((a) => a.id === "SYN-AST-W-01") as UtilityAsset;
    const sameDates = syntheticExcavations.map((e): ExcavationWork => ({
      ...e,
      status: "active",
      schedule: { startDate: "2026-11-01", endDate: "2026-11-30" },
    }));
    expect(detectClashes([farAsset], sameDates, { referenceDate: REFERENCE_DATE })).toEqual([]);
  });

  it("substitutes conservative values for missing uncertainty and records the assumption", () => {
    const { horizontalUncertaintyM: _h, depthUncertaintyM: _d, ...rest } = syntheticAssets.find(
      (a) => a.id === "SYN-AST-S-01",
    ) as UtilityAsset;
    const r = detectClashes([rest], syntheticExcavations, { referenceDate: REFERENCE_DATE })[0];
    expect(r?.assumptions.some((a) => a.includes("Asset horizontal position uncertainty not recorded"))).toBe(true);
    expect(r?.assumptions.some((a) => a.includes("Asset depth uncertainty not recorded"))).toBe(true);
    expect(r?.confidence).not.toBe("high");
  });

  it("respects configurable buffers", () => {
    const strict = detectClashes(syntheticAssets, syntheticExcavations, {
      referenceDate: REFERENCE_DATE,
      verticalBufferM: 1.5,
    });
    const safe = strict.find((r) => r.id === clashId("SYN-EXC-02", "SYN-AST-S-02"));
    expect(safe?.severity).not.toBe("low");
  });

  it("rejects invalid config and duplicate ids", () => {
    expect(() => detectClashes([], [], { horizontalBufferM: -1 })).toThrow(RangeError);
    const [asset] = syntheticAssets;
    if (!asset) throw new Error("no assets");
    expect(() => detectClashes([asset, asset], [])).toThrow(/Duplicate asset id/);
  });

  it("returns only valid reason codes, in canonical order, with explanations and assumptions", () => {
    for (const r of results) {
      const order = r.reasonCodes.map((code) => CLASH_REASON_CODES.indexOf(code));
      expect(order.every((i) => i >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(r.explanation.length).toBeGreaterThan(0);
      expect(r.assumptions.length).toBeGreaterThan(0);
      expect(r.affectedAssetIds).toEqual(r.evidence.map((e) => e.assetId));
    }
  });
});
