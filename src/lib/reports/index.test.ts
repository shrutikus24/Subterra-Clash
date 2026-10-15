import { describe, expect, it } from "vitest";
import { detectClashes } from "@/lib/clash-engine";
import { syntheticAssets, syntheticExcavations } from "@/lib/data/synthetic-data";
import { formatDate, formatMetres, formatSignedMetres, shortClashId } from "@/lib/format";
import type { ProjectDataset } from "@/types";
import {
  CSV_COLUMNS,
  SEVERITY_PRIORITY,
  assessDataQuality,
  clashesToCsv,
  collectScheduleOverlaps,
  rankClashes,
  summarizeDataset,
} from "./index";

const REFERENCE_DATE = "2026-10-15";
const dataset: ProjectDataset = {
  assets: syntheticAssets,
  excavations: syntheticExcavations,
  clashes: detectClashes(syntheticAssets, syntheticExcavations, { referenceDate: REFERENCE_DATE }),
};

describe("summarizeDataset", () => {
  const s = summarizeDataset(dataset);

  it("derives every count from engine output", () => {
    expect(s.totalClashes).toBe(dataset.clashes.length);
    expect(Object.values(s.bySeverity).reduce((a, b) => a + b, 0)).toBe(s.totalClashes);
    expect(s.criticalOrHigh).toBe(dataset.clashes.filter((c) => ["critical", "high"].includes(c.severity)).length);
    expect(s.needsData).toBe(dataset.clashes.filter((c) => c.severity === "needs-data").length);
    expect(s.clashesWithScheduleOverlap).toBe(dataset.clashes.filter((c) => c.scheduleOverlap.hasOverlap).length);
  });

  it("counts excavation statuses", () => {
    expect(s.activeExcavations).toBe(1);
    expect(s.cancelledExcavations).toBe(1);
  });
});

describe("rankClashes", () => {
  it("orders by review priority without mutating the input", () => {
    const ranked = rankClashes(dataset.clashes);
    const ranks = ranked.map((c) => SEVERITY_PRIORITY.indexOf(c.severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranked).not.toBe(dataset.clashes);
    expect(ranked[0]?.severity).toBe("critical");
  });
});

describe("collectScheduleOverlaps", () => {
  it("groups the overlapping excavation pair once, with its shared window", () => {
    expect(collectScheduleOverlaps(dataset)).toEqual([
      {
        excavationIds: ["SYN-EXC-01", "SYN-EXC-02"],
        assetIds: ["SYN-AST-E-01"],
        window: { startDate: "2026-11-02", endDate: "2026-11-20" },
      },
    ]);
  });
});

describe("assessDataQuality", () => {
  const report = assessDataQuality(syntheticAssets, REFERENCE_DATE);
  const issuesOf = (id: string) => report.assets.find((a) => a.assetId === id)?.issues ?? [];

  it("flags missing depth without also flagging its uncertainty", () => {
    expect(issuesOf("SYN-AST-G-02")).toContain("missing-depth");
    expect(issuesOf("SYN-AST-G-02")).not.toContain("missing-depth-uncertainty");
  });

  it("flags high uncertainty, low quality and missing survey dates", () => {
    expect(issuesOf("SYN-AST-T-02")).toEqual(
      expect.arrayContaining(["high-horizontal-uncertainty", "low-quality-record", "missing-survey-date"]),
    );
    expect(issuesOf("SYN-AST-W-03")).toEqual(expect.arrayContaining(["outdated-survey", "low-quality-record"]));
  });

  it("omits clean records", () => {
    expect(issuesOf("SYN-AST-S-01")).toEqual([]);
  });
});

describe("clashesToCsv", () => {
  const csv = clashesToCsv(dataset.clashes, dataset, (id) => (id.includes("S-01") ? "inspected" : "open"));
  const lines = csv.trimEnd().split("\r\n");

  it("writes a header and one row per clash", () => {
    expect(lines[0]).toBe(CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(dataset.clashes.length + 1);
  });

  it("leaves unknown clearance empty rather than zero", () => {
    const row = lines.find((l) => l.includes("SYN-AST-G-02,"));
    const cells = row?.split(",") ?? [];
    expect(cells[CSV_COLUMNS.indexOf("vertical_clearance_m")]).toBe("");
  });

  it("quotes text containing commas and records review status", () => {
    expect(csv).toContain('"');
    expect(lines.find((l) => l.includes("CLASH:SYN-EXC-01:SYN-AST-S-01"))).toContain(",inspected,");
  });

  it("neutralises formula-like text", () => {
    const [first] = dataset.clashes;
    if (!first) throw new Error("no clashes");
    const out = clashesToCsv([{ ...first, explanation: "=HYPERLINK(1)" }], dataset);
    expect(out).toContain("'=HYPERLINK(1)");
  });
});

describe("format helpers", () => {
  it("formats dates and measurements deterministically", () => {
    expect(formatDate("2026-11-02")).toBe("2 Nov 2026");
    expect(formatMetres(undefined)).toBe("Not recorded");
    expect(formatMetres(0)).toBe("0 m");
    expect(formatSignedMetres(-0.5)).toBe("−0.5 m");
    expect(shortClashId("CLASH:SYN-EXC-01:SYN-AST-S-01")).toBe("EXC-01 × AST-S-01");
  });
});
