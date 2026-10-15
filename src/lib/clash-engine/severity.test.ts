import { describe, expect, it } from "vitest";
import { isOlderThan, scheduleIntersection, schedulesOverlap } from "./schedule";
import { assessHorizontal, assessVertical, determineSeverity, type VerticalAssessment } from "./severity";

const vertical = (assetTopDepthM: number | undefined, assetUnc = 0.1, excDepth = 1.0, excUnc = 0.1) =>
  assessVertical({
    assetTopDepthM,
    assetDepthUncertaintyM: assetUnc,
    excavationDepthM: excDepth,
    excavationDepthUncertaintyM: excUnc,
    bufferM: 0.3,
  });

describe("assessHorizontal", () => {
  const h = (edgeDistanceM: number, radius = 0.05, unc = 0.5) =>
    assessHorizontal({ edgeDistanceM, assetRadiusM: radius, combinedUncertaintyM: unc, bufferM: 1 }).state;

  it("classifies by outer-surface distance", () => {
    expect(h(0)).toBe("intersecting");
    expect(h(0.04)).toBe("intersecting"); // asset radius reaches the corridor
    expect(h(1.05)).toBe("within-buffer"); // exactly at the buffer counts as within
    expect(h(1.4)).toBe("within-uncertainty");
    expect(h(1.6)).toBe("clear");
  });
});

describe("assessVertical", () => {
  it("returns unknown when depth is missing, never assuming zero", () => {
    expect(vertical(undefined)).toEqual({ state: "unknown" });
  });

  it("computes nominal clearance as asset top minus dig depth", () => {
    expect(vertical(0.7).clearanceM).toBe(-0.3);
  });

  it("separates confirmed, likely, uncertain and clear outcomes", () => {
    expect(vertical(0.9).state).toBe("violation-confirmed"); // best case 0.1 < 0.3
    expect(vertical(1.1, 0.5).state).toBe("violation-likely"); // nominal 0.1, best 0.7
    expect(vertical(1.4, 0.3).state).toBe("clearance-uncertain"); // nominal 0.4, worst 0
    expect(vertical(1.5).state).toBe("clear"); // worst case 0.3 meets the buffer
  });
});

describe("determineSeverity", () => {
  const sev = (v: VerticalAssessment, horizontal: "intersecting" | "within-buffer" | "within-uncertainty", opts = {}) =>
    determineSeverity({ horizontal, vertical: v, unreliableRecord: false, highConsequence: false, ...opts });

  it("returns needs-data rather than safe when depth evidence is inconclusive", () => {
    expect(sev(vertical(undefined), "intersecting")).toBe("needs-data");
    expect(sev(vertical(1.4, 0.3), "intersecting")).toBe("needs-data");
    expect(sev(vertical(0.9, 0.5), "intersecting", { unreliableRecord: true })).toBe("needs-data");
  });

  it("grades crossings by intrusion certainty", () => {
    expect(sev(vertical(0.5), "intersecting")).toBe("critical");
    expect(sev(vertical(0.9, 0.5), "intersecting")).toBe("high"); // likely intrusion, reliable record
    expect(sev(vertical(1.5), "intersecting")).toBe("low");
  });

  it("escalates gas and electric by one level, but never past critical or from low", () => {
    expect(sev(vertical(0.5), "within-uncertainty", { highConsequence: true })).toBe("high");
    expect(sev(vertical(0.5), "intersecting", { highConsequence: true })).toBe("critical");
    expect(sev(vertical(1.5), "intersecting", { highConsequence: true })).toBe("low");
  });
});

describe("schedule helpers", () => {
  const a = { startDate: "2026-11-01", endDate: "2026-11-10" };

  it("treats a shared single day as overlap", () => {
    expect(schedulesOverlap(a, { startDate: "2026-11-10", endDate: "2026-11-20" })).toBe(true);
    expect(schedulesOverlap(a, { startDate: "2026-11-11", endDate: "2026-11-20" })).toBe(false);
  });

  it("returns the intersection window", () => {
    expect(scheduleIntersection(a, { startDate: "2026-11-05", endDate: "2026-12-01" })).toEqual({
      startDate: "2026-11-05",
      endDate: "2026-11-10",
    });
  });

  it("checks survey age against a reference date", () => {
    expect(isOlderThan("2006-10-15", 20, "2026-10-15")).toBe(true);
    expect(isOlderThan("2006-10-16", 20, "2026-10-15")).toBe(false);
  });
});
