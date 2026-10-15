/**
 * End-to-end pipeline checks: synthetic dataset → clash engine → dashboard data → reporting helpers.
 * These use the exact data the app renders (getDashboardData), not a separately built fixture.
 */
import { describe, expect, it } from "vitest";
import { detectClashes } from "@/lib/clash-engine";
import { getDashboardData } from "@/lib/data";
import {
  CSV_COLUMNS,
  assessDataQuality,
  clashesToCsv,
  collectScheduleOverlaps,
  rankClashes,
  summarizeDataset,
} from "@/lib/reports";

const { dataset, analysisDate, config } = getDashboardData();
const { assets, excavations, clashes } = dataset;
const assetById = new Map(assets.map((a) => [a.id, a]));
const excavationById = new Map(excavations.map((e) => [e.id, e]));

describe("dashboard data comes straight from the engine", () => {
  it("matches a fresh engine run with the same config", () => {
    expect(clashes).toEqual(detectClashes(assets, excavations, config));
    expect(config.referenceDate).toBe(analysisDate);
  });

  it("is cached so every surface sees the same object", () => {
    expect(getDashboardData().dataset).toBe(dataset);
  });

  it("labels every record as synthetic", () => {
    for (const r of [...assets, ...excavations]) expect(r.id.startsWith("SYN-")).toBe(true);
  });

  it("references only existing, non-cancelled records", () => {
    for (const c of clashes) {
      expect(excavationById.get(c.excavationId)?.status).not.toBe("cancelled");
      for (const id of c.affectedAssetIds) expect(assetById.has(id)).toBe(true);
    }
  });
});

describe("summary, queue and report agree", () => {
  const summary = summarizeDataset(dataset);
  const ranked = rankClashes(clashes);
  const csvRows = clashesToCsv(ranked, dataset).trimEnd().split("\r\n").slice(1);

  it("queue, CSV and summary cards count the same clashes", () => {
    expect(ranked).toHaveLength(summary.totalClashes);
    expect(csvRows).toHaveLength(summary.totalClashes);
    expect(new Set(ranked.map((c) => c.id))).toEqual(new Set(clashes.map((c) => c.id)));
  });

  it("severity and utility breakdowns add up to the totals", () => {
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    expect(sum(summary.bySeverity)).toBe(summary.totalClashes);
    expect(sum(summary.byAction)).toBe(summary.totalClashes);
    expect(sum(summary.byUtilityType)).toBe(clashes.reduce((n, c) => n + c.affectedAssetIds.length, 0));
  });

  it("uses the engine thresholds for data-quality flags", () => {
    const report = assessDataQuality(assets, analysisDate, config);
    const highUnc = assets.filter(
      (a) => a.horizontalUncertaintyM !== undefined && a.horizontalUncertaintyM >= config.highHorizontalUncertaintyM,
    );
    expect(report.counts["high-horizontal-uncertainty"]).toBe(highUnc.length);
  });
});

describe("edge cases survive the full pipeline", () => {
  it("missing depth stays unknown in results and CSV, never zero", () => {
    const noDepth = assets.filter((a) => a.depthM === undefined).map((a) => a.id);
    expect(noDepth.length).toBeGreaterThan(0);
    const affected = clashes.filter((c) => c.affectedAssetIds.some((id) => noDepth.includes(id)));
    expect(affected.length).toBeGreaterThan(0);
    const col = CSV_COLUMNS.indexOf("vertical_clearance_m");
    for (const c of affected) {
      expect(c.severity).toBe("needs-data");
      expect(c.verticalClearanceM).toBeUndefined();
      const row = clashesToCsv([c], dataset).trimEnd().split("\r\n")[1] ?? "";
      expect(row.split(",")[col]).toBe("");
    }
  });

  it("uncertainty-limited results are never reported with high confidence", () => {
    for (const c of clashes) {
      if (c.severity === "needs-data" || c.reasonCodes.includes("high-position-uncertainty")) {
        expect(c.confidence).toBe("low");
      }
    }
  });

  it("cancelled excavations produce no clashes and no overlaps", () => {
    const cancelled = excavations.filter((e) => e.status === "cancelled").map((e) => e.id);
    expect(cancelled.length).toBeGreaterThan(0);
    for (const c of clashes) {
      expect(cancelled).not.toContain(c.excavationId);
      for (const id of c.scheduleOverlap.overlappingExcavationIds) expect(cancelled).not.toContain(id);
    }
  });

  it("schedule overlaps are symmetric and fall inside both schedules", () => {
    for (const c of clashes) {
      for (const otherId of c.scheduleOverlap.overlappingExcavationIds) {
        const mirror = clashes.find(
          (o) => o.excavationId === otherId && o.affectedAssetIds.some((id) => c.affectedAssetIds.includes(id)),
        );
        expect(mirror?.scheduleOverlap.overlappingExcavationIds).toContain(c.excavationId);
      }
    }
    for (const group of collectScheduleOverlaps(dataset)) {
      for (const id of group.excavationIds) {
        const s = excavationById.get(id)?.schedule;
        expect(s && s.startDate <= group.window.startDate && group.window.endDate <= s.endDate).toBe(true);
      }
    }
  });
});
