import { describe, expect, it } from "vitest";
import { getDashboardData } from "@/lib/data";
import type { ClashResult } from "@/types";
import { EMPTY_WORK_FILTERS, buildPublicData, categorizeFinding, filterWorks, workTiming } from "./index";

const { dataset } = getDashboardData();
// Fixed date so the expectations do not depend on when the tests run.
const AS_OF = "2026-10-16";
const data = buildPublicData(dataset, AS_OF);

const overlap = (hasOverlap: boolean): ClashResult["scheduleOverlap"] => ({ hasOverlap, overlappingExcavationIds: [] });

describe("categorizeFinding", () => {
  it("treats needs-data as insufficient information, never as a clash or clear", () => {
    expect(categorizeFinding({ severity: "needs-data", reasonCodes: ["depth-intrusion"], scheduleOverlap: overlap(false) })).toEqual([
      "insufficient-data",
    ]);
  });
  it("separates physical clashes from clearance concerns and tags schedule overlaps", () => {
    expect(categorizeFinding({ severity: "critical", reasonCodes: ["depth-intrusion"], scheduleOverlap: overlap(true) })).toEqual([
      "spatial",
      "schedule",
    ]);
    expect(categorizeFinding({ severity: "low", reasonCodes: ["horizontal-intersection"], scheduleOverlap: overlap(false) })).toEqual([
      "clearance",
    ]);
  });
});

describe("workTiming", () => {
  const s = { startDate: "2026-11-01", endDate: "2026-11-30" };
  it("derives timing from dates, not from the recorded status", () => {
    expect(workTiming("planned", s, "2026-10-01")).toBe("upcoming");
    expect(workTiming("planned", s, "2026-11-10")).toBe("in-progress");
    expect(workTiming("active", s, "2026-12-05")).toBe("past");
    expect(workTiming("cancelled", s, "2026-11-10")).toBe("cancelled");
  });
});

describe("buildPublicData", () => {
  it("publishes one finding per engine result and one work per excavation", () => {
    expect(data.findings).toHaveLength(dataset.clashes.length);
    expect(data.works).toHaveLength(dataset.excavations.length);
    expect(data.metrics.findings).toBe(dataset.clashes.length);
  });

  it("computes metrics from the data", () => {
    const live = dataset.excavations.filter((e) => e.status !== "cancelled");
    expect(data.metrics.workSites).toBe(live.length);
    expect(data.metrics.cancelled).toBe(dataset.excavations.length - live.length);
    expect(data.metrics.byCategory["insufficient-data"]).toBe(
      dataset.clashes.filter((c) => c.severity === "needs-data").length,
    );
    expect(data.metrics.byCategory.schedule).toBe(dataset.clashes.filter((c) => c.scheduleOverlap.hasOverlap).length);
  });

  it("never exposes internal asset details", () => {
    const json = JSON.stringify(data);
    for (const asset of dataset.assets) {
      expect(json).not.toContain(asset.id);
      expect(json).not.toContain(asset.name);
      if (asset.owner) expect(json).not.toContain(asset.owner);
      for (const [lng, lat] of asset.geometry.coordinates) expect(json).not.toContain(`${lng},${lat}`);
    }
    // Engine explanations quote names and depths; only the generated plain-language text is published.
    for (const clash of dataset.clashes) expect(json).not.toContain(clash.explanation);
  });

  it("does not invent fields that the record lacks", () => {
    for (const w of data.works) {
      const source = dataset.excavations.find((e) => e.id === w.id);
      expect(w.organisation).toBe(source?.contractor);
    }
  });

  it("flags cancelled and delayed works with a caveat and a notice", () => {
    for (const w of data.works.filter((x) => x.status === "cancelled" || x.status === "delayed")) {
      expect(w.timingNote).toBeTruthy();
      expect(data.notices.some((n) => n.workId === w.id && n.kind === w.status)).toBe(true);
    }
  });

  it("does not present a planned work whose dates have arrived as confirmed active", () => {
    const later = buildPublicData(dataset, "2026-11-10");
    const planned = later.works.find((w) => w.status === "planned" && w.timing === "in-progress");
    expect(planned?.timingNote).toMatch(/not yet confirm/);
    const notice = later.notices.find((n) => n.workId === planned?.id);
    expect(notice?.title).toMatch(/scheduled to be under way/);
  });
});

describe("filterWorks", () => {
  it("filters by status, date window and text", () => {
    expect(filterWorks(data.works, EMPTY_WORK_FILTERS, AS_OF)).toHaveLength(data.works.length);
    const cancelled = filterWorks(data.works, { ...EMPTY_WORK_FILTERS, statuses: ["cancelled"] }, AS_OF);
    expect(cancelled.every((w) => w.status === "cancelled")).toBe(true);
    const now = filterWorks(data.works, { ...EMPTY_WORK_FILTERS, window: "now" }, AS_OF);
    expect(now.every((w) => w.schedule.startDate <= AS_OF && w.schedule.endDate >= AS_OF)).toBe(true);
    const first = data.works[0];
    if (first) {
      expect(filterWorks(data.works, { ...EMPTY_WORK_FILTERS, query: first.name.toUpperCase() }, AS_OF)).toContain(first);
    }
  });
});
