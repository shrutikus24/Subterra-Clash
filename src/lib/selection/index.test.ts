import { describe, expect, it } from "vitest";
import { getDashboardData } from "@/lib/data";
import { rankClashes } from "@/lib/reports";
import { clashForFeature } from ".";

const { dataset } = getDashboardData();
const ranked = rankClashes(dataset.clashes);

describe("clashForFeature", () => {
  it("selects only a conflict belonging to the clicked excavation", () => {
    for (const e of dataset.excavations) {
      const clash = clashForFeature({ kind: "excavation", id: e.id }, dataset.clashes);
      const own = ranked.filter((c) => c.excavationId === e.id);
      expect(clash?.id ?? null).toBe(own[0]?.id ?? null);
      if (clash) expect(clash.excavationId).toBe(e.id);
    }
  });

  it("never falls back to the globally top-ranked conflict", () => {
    const cancelled = dataset.excavations.find((e) => e.status === "cancelled");
    expect(cancelled).toBeDefined();
    expect(clashForFeature({ kind: "excavation", id: cancelled?.id ?? "" }, dataset.clashes)).toBeNull();
    expect(clashForFeature({ kind: "excavation", id: "NOT-A-WORK" }, dataset.clashes)).toBeNull();
  });

  it("selects only a conflict involving the clicked asset", () => {
    for (const a of dataset.assets) {
      const clash = clashForFeature({ kind: "asset", id: a.id }, dataset.clashes);
      if (clash) expect(clash.affectedAssetIds).toContain(a.id);
      else expect(dataset.clashes.some((c) => c.affectedAssetIds.includes(a.id))).toBe(false);
    }
  });
});
