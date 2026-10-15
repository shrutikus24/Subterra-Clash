import { describe, expect, it } from "vitest";
import { getDashboardData } from "@/lib/data";
import { rankClashes } from ".";
import { buildInspectionReport, REPORT_DISCLAIMERS } from "./inspection";

const { dataset, config, analysisDate } = getDashboardData();
const report = buildInspectionReport(dataset, config, analysisDate, (id) =>
  id === "CLASH:SYN-EXC-01:SYN-AST-E-01" ? "inspected" : "open",
);

describe("buildInspectionReport", () => {
  it("lists every engine result once, in review-priority order", () => {
    expect(report.items.map((i) => i.clash.id)).toEqual(rankClashes(dataset.clashes).map((c) => c.id));
    expect(report.items.map((i) => i.rank)).toEqual(report.items.map((_, i) => i + 1));
    expect(report.summary.totalClashes).toBe(dataset.clashes.length);
  });

  it("copies engine values unchanged and keeps unknown measurements unknown", () => {
    for (const item of report.items) {
      const original = dataset.clashes.find((c) => c.id === item.clash.id);
      expect(item.clash).toBe(original);
    }
    const noDepth = report.items.find((i) => i.asset?.id === "SYN-AST-G-02");
    expect(noDepth?.asset?.depthM).toBeUndefined();
    expect(noDepth?.clash.verticalClearanceM).toBeUndefined();
    expect(noDepth?.clash.severity).toBe("needs-data");
  });

  it("resolves each conflict's asset and excavation records", () => {
    for (const item of report.items) {
      expect(item.asset?.id).toBe(item.clash.affectedAssetIds[0]);
      expect(item.excavation?.id).toBe(item.clash.excavationId);
    }
  });

  it("carries the recorded review status without deciding anything", () => {
    expect(report.items.find((i) => i.clash.id === "CLASH:SYN-EXC-01:SYN-AST-E-01")?.reviewStatus).toBe("inspected");
    expect(report.items.filter((i) => i.reviewStatus === "open")).toHaveLength(report.items.length - 1);
  });

  it("names schedule-overlapping works from the engine result", () => {
    for (const item of report.items) {
      expect(item.overlappingWorkNames).toHaveLength(item.clash.scheduleOverlap.overlappingExcavationIds.length);
    }
    expect(report.items.some((i) => i.overlappingWorkNames.length > 0)).toBe(true);
  });

  it("lists cancelled works as excluded and gives them no conflicts", () => {
    expect(report.excludedWorks.length).toBeGreaterThan(0);
    for (const w of report.excludedWorks) {
      expect(w.status).toBe("cancelled");
      expect(report.items.some((i) => i.clash.excavationId === w.id)).toBe(false);
    }
  });

  it("states the synthetic-data and decision-support limits and the buffers used", () => {
    expect(report.disclaimers).toBe(REPORT_DISCLAIMERS);
    expect(report.disclaimers.join(" ")).toMatch(/synthetic/i);
    expect(report.disclaimers.join(" ")).toMatch(/does not approve or reject/i);
    expect(report.buffers).toEqual({ horizontalM: config.horizontalBufferM, verticalM: config.verticalBufferM });
  });
});
