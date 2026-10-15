/**
 * Public view model for the transparency portal.
 *
 * The portal never receives the engineering dataset. `buildPublicData` runs on the server and keeps
 * only what is safe to publish: excavation works (already public by nature), and plain-language
 * summaries of clash-engine results. Utility asset names, IDs, owners, depths, sizes, coordinates and
 * record notes are deliberately dropped.
 *
 * Framework-free and deterministic: every value is derived from the dataset and the analysis date.
 */
import { length, lineString } from "@turf/turf";
import type { LineString } from "geojson";
import { formatDate, isoToDay } from "@/lib/format";
import { SEVERITY_PRIORITY } from "@/lib/reports";
import type {
  ClashReasonCode,
  ClashResult,
  ConflictSeverity,
  InspectionAction,
  IsoDate,
  ProjectDataset,
  UtilityType,
  WorkSchedule,
  WorkStatus,
} from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Where a work sits relative to the "as of" date, independent of its recorded status. */
export type WorkTiming = "in-progress" | "upcoming" | "past" | "cancelled";

export const FINDING_CATEGORIES = ["spatial", "clearance", "schedule", "insufficient-data"] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export interface PublicWork {
  id: string;
  name: string;
  status: WorkStatus;
  schedule: WorkSchedule;
  timing: WorkTiming;
  /** Plain-language caveat when the recorded status and the dates disagree, or dates may change. */
  timingNote?: string;
  /** Contractor named in the record; omitted when not recorded. */
  organisation?: string;
  /** Excavation corridor centreline. Public works locations are not sensitive. */
  geometry: LineString;
  widthM: number;
  lengthM: number;
  /** False when the clash engine did not assess the work (cancelled works are skipped). */
  assessed: boolean;
  findingCount: number;
  /** Highest-priority finding on this work; omitted when the engine reported none. */
  topPriority?: ConflictSeverity;
}

export interface PublicFinding {
  /** Public reference, e.g. "SYN-EXC-01-F1". Does not contain internal asset IDs. */
  id: string;
  workId: string;
  workName: string;
  /** Main category used for grouping. */
  category: FindingCategory;
  /** Every category that applies (a spatial clash may also overlap in time). */
  categories: FindingCategory[];
  priority: ConflictSeverity;
  utilityType: UtilityType;
  /** One-sentence plain-language summary. */
  summary: string;
  /** Plain-language reasons the finding needs attention. */
  reasons: string[];
  nextStep: string;
  overlap?: { works: { id: string; name: string }[]; window: WorkSchedule };
}

export type NoticeKind = "cancelled" | "delayed" | "in-progress" | "starting-soon" | "dates-passed" | "upcoming";

export interface PublicNotice {
  id: string;
  workId: string;
  workName: string;
  kind: NoticeKind;
  title: string;
  body: string;
  /** The schedule date the notice refers to. */
  date: IsoDate;
}

export interface PublicMetrics {
  totalWorks: number;
  inProgress: number;
  upcoming: number;
  delayed: number;
  cancelled: number;
  /** Excavation corridors that are not cancelled. The dataset records corridors, not named areas. */
  workSites: number;
  /** Total length of non-cancelled corridors. */
  workLengthM: number;
  findings: number;
  worksWithFindings: number;
  byCategory: Record<FindingCategory, number>;
}

export interface PublicData {
  asOf: IsoDate;
  works: PublicWork[];
  findings: PublicFinding[];
  notices: PublicNotice[];
  metrics: PublicMetrics;
}

// ---------------------------------------------------------------------------
// Plain-language text
// ---------------------------------------------------------------------------

export const UTILITY_PHRASE: Record<UtilityType, string> = {
  water: "a water pipe",
  sewer: "a sewer pipe",
  electric: "an electricity cable",
  gas: "a gas pipe",
  telecom: "a telecoms cable",
};

const REASON_TEXT: Partial<Record<ClashReasonCode, string>> = {
  "horizontal-intersection": "The planned dig route crosses the recorded route of the line.",
  "within-horizontal-buffer": "The line runs closer to the dig than the minimum safe distance.",
  "depth-intrusion": "The planned dig depth reaches the depth at which the line is recorded.",
  "insufficient-vertical-clearance": "The gap between the bottom of the dig and the line may be less than the safety margin.",
  "missing-asset-depth": "The depth of the line is not recorded.",
  "missing-asset-diameter": "The size of the line is not recorded.",
  "high-position-uncertainty": "The exact position of the line is uncertain in the records.",
  "low-data-quality": "The record for this line is of low quality.",
  "outdated-survey": "The line was last surveyed a long time ago, so records may be out of date.",
  "high-consequence-utility": "Damage to gas or electricity lines can be especially serious.",
  "schedule-overlap": "Another planned work affects the same line at the same time.",
};

const NEXT_STEP: Record<InspectionAction, string> = {
  "no-action": "No extra step recommended by the automated check.",
  "verify-records": "Check the utility records before digging.",
  "ground-penetrating-radar": "Scan the ground with radar to locate the line before digging.",
  "trial-hole": "Dig a small trial hole by hand to confirm where the line is before main works.",
  "owner-standby": "Have the line's owner on site while digging near it.",
  "redesign-alignment": "Consider moving the dig route away from the line.",
};

export const CATEGORY_META: Record<FindingCategory, { label: string; description: string }> = {
  spatial: {
    label: "Physical clash",
    description: "Records suggest the planned dig reaches an underground line.",
  },
  clearance: {
    label: "Clearance concern",
    description: "The dig passes close to an underground line, and a safe gap is not confirmed.",
  },
  schedule: {
    label: "Schedule overlap",
    description: "More than one work affects the same underground line at the same time.",
  },
  "insufficient-data": {
    label: "Not enough information",
    description: "Records are missing or unreliable, so the risk cannot be assessed.",
  },
};

export const PRIORITY_LABEL: Record<ConflictSeverity, string> = {
  critical: "Highest priority",
  high: "High priority",
  medium: "Moderate priority",
  low: "Lower priority",
  "needs-data": "Cannot be assessed yet",
};

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Primary category first, then any secondary ones. */
export function categorizeFinding(clash: Pick<ClashResult, "severity" | "reasonCodes" | "scheduleOverlap">): FindingCategory[] {
  const primary: FindingCategory =
    clash.severity === "needs-data"
      ? "insufficient-data"
      : clash.reasonCodes.includes("depth-intrusion")
        ? "spatial"
        : "clearance";
  return clash.scheduleOverlap.hasOverlap ? [primary, "schedule"] : [primary];
}

export function workTiming(status: WorkStatus, schedule: WorkSchedule, asOf: IsoDate): WorkTiming {
  if (status === "cancelled") return "cancelled";
  if (schedule.endDate < asOf) return "past";
  if (schedule.startDate <= asOf) return "in-progress";
  return "upcoming";
}

function timingNote(status: WorkStatus, timing: WorkTiming): string | undefined {
  if (status === "cancelled") return "Cancelled. This work is not expected to go ahead on these dates.";
  if (status === "delayed") return "Delayed. The dates shown are the latest recorded and may change.";
  if (timing === "past") return "The recorded end date has passed. Completion has not been confirmed in the records.";
  if (timing === "in-progress" && status === "planned") {
    return "Scheduled to have started, but the records do not yet confirm work is under way.";
  }
  if (timing === "upcoming" && status === "active") return "Recorded as active although the start date is still ahead.";
  return undefined;
}

const PRIORITY_RANK = new Map(SEVERITY_PRIORITY.map((s, i) => [s, i]));
const byPriority = (a: ConflictSeverity, b: ConflictSeverity) =>
  (PRIORITY_RANK.get(a) ?? 99) - (PRIORITY_RANK.get(b) ?? 99);

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildPublicData(dataset: ProjectDataset, asOf: IsoDate): PublicData {
  const assetType = new Map(dataset.assets.map((a) => [a.id, a.type]));
  const workById = new Map(dataset.excavations.map((e) => [e.id, e]));

  // Findings: numbered per work in priority order, so references are stable for a given dataset.
  const findings: PublicFinding[] = [];
  const perWork = new Map<string, ClashResult[]>();
  for (const c of dataset.clashes) perWork.set(c.excavationId, [...(perWork.get(c.excavationId) ?? []), c]);

  for (const work of dataset.excavations) {
    const clashes = [...(perWork.get(work.id) ?? [])].sort((a, b) => byPriority(a.severity, b.severity));
    clashes.forEach((clash, i) => {
      const utilityType = assetType.get(clash.affectedAssetIds[0] ?? "");
      if (!utilityType) return;
      const categories = categorizeFinding(clash);
      const category = categories[0] ?? "clearance";
      const reasons = [...new Set(clash.reasonCodes.map((r) => REASON_TEXT[r]).filter((t): t is string => !!t))];
      const overlapWorks = clash.scheduleOverlap.overlappingExcavationIds
        .map((id) => workById.get(id))
        .filter((w) => w !== undefined)
        .map((w) => ({ id: w.id, name: w.name }));
      findings.push({
        id: `${work.id}-F${i + 1}`,
        workId: work.id,
        workName: work.name,
        category,
        categories,
        priority: clash.severity,
        utilityType,
        summary: findingSummary(category, work.name, utilityType),
        reasons,
        nextStep: NEXT_STEP[clash.recommendedAction.action],
        ...(clash.scheduleOverlap.hasOverlap && clash.scheduleOverlap.overlapWindow && overlapWorks.length
          ? { overlap: { works: overlapWorks, window: clash.scheduleOverlap.overlapWindow } }
          : {}),
      });
    });
  }
  findings.sort((a, b) => byPriority(a.priority, b.priority) || a.id.localeCompare(b.id));

  const works: PublicWork[] = dataset.excavations
    .map((e) => {
      const timing = workTiming(e.status, e.schedule, asOf);
      const own = findings.filter((f) => f.workId === e.id);
      const note = timingNote(e.status, timing);
      return {
        id: e.id,
        name: e.name,
        status: e.status,
        schedule: e.schedule,
        timing,
        ...(note ? { timingNote: note } : {}),
        ...(e.contractor ? { organisation: e.contractor } : {}),
        geometry: e.geometry,
        widthM: e.widthM,
        lengthM: Math.round(length(lineString(e.geometry.coordinates), { units: "meters" })),
        assessed: e.status !== "cancelled",
        findingCount: own.length,
        ...(own[0] ? { topPriority: own[0].priority } : {}),
      };
    })
    .sort((a, b) => a.schedule.startDate.localeCompare(b.schedule.startDate) || a.id.localeCompare(b.id));

  const live = works.filter((w) => w.status !== "cancelled");
  const byCategory = Object.fromEntries(FINDING_CATEGORIES.map((c) => [c, 0])) as Record<FindingCategory, number>;
  for (const f of findings) for (const c of f.categories) byCategory[c] += 1;

  return {
    asOf,
    works,
    findings,
    notices: buildNotices(works, asOf),
    metrics: {
      totalWorks: works.length,
      inProgress: works.filter((w) => w.timing === "in-progress").length,
      upcoming: works.filter((w) => w.timing === "upcoming").length,
      delayed: works.filter((w) => w.status === "delayed").length,
      cancelled: works.filter((w) => w.status === "cancelled").length,
      workSites: live.length,
      workLengthM: live.reduce((sum, w) => sum + w.lengthM, 0),
      findings: findings.length,
      worksWithFindings: works.filter((w) => w.findingCount > 0).length,
      byCategory,
    },
  };
}

function findingSummary(category: FindingCategory, workName: string, utility: UtilityType): string {
  const line = UTILITY_PHRASE[utility];
  switch (category) {
    case "spatial":
      return `${workName} is planned to dig deep enough to reach ${line}, according to the records.`;
    case "clearance":
      return `${workName} passes close to ${line}, and a safe gap is not confirmed.`;
    case "insufficient-data":
      return `${workName} passes near ${line}, but the records are not complete enough to assess the risk.`;
    case "schedule":
      return `${workName} affects ${line} that another work affects at the same time.`;
  }
}

const SOON_DAYS = 30;

/** Status notices derived from schedule records. No notice claims an event the records do not show. */
export function buildNotices(works: readonly PublicWork[], asOf: IsoDate): PublicNotice[] {
  const today = isoToDay(asOf);
  const notices: PublicNotice[] = [];
  for (const w of works) {
    const base = { workId: w.id, workName: w.name };
    const { startDate, endDate } = w.schedule;
    if (w.status === "cancelled") {
      notices.push({ ...base, id: `${w.id}-cancelled`, kind: "cancelled", date: startDate,
        title: `${w.name} is cancelled`,
        body: `This work was planned for ${formatDate(startDate)} to ${formatDate(endDate)}. It is recorded as cancelled.` });
    } else if (w.status === "delayed") {
      notices.push({ ...base, id: `${w.id}-delayed`, kind: "delayed", date: startDate,
        title: `${w.name} is delayed`,
        body: `The latest recorded dates are ${formatDate(startDate)} to ${formatDate(endDate)}. These may change.` });
    } else if (w.timing === "past") {
      notices.push({ ...base, id: `${w.id}-dates-passed`, kind: "dates-passed", date: endDate,
        title: `${w.name}: planned dates have passed`,
        body: `The recorded end date was ${formatDate(endDate)}. The records do not confirm whether the work is finished.` });
    } else if (w.timing === "in-progress") {
      notices.push({ ...base, id: `${w.id}-in-progress`, kind: "in-progress", date: startDate,
        title: w.status === "active" ? `${w.name} is under way` : `${w.name} is scheduled to be under way`,
        body: w.status === "active"
          ? `Recorded as active, scheduled to finish on ${formatDate(endDate)}.`
          : `Scheduled from ${formatDate(startDate)} to ${formatDate(endDate)}. The records do not yet confirm that work has started.` });
    } else {
      const soon = isoToDay(startDate) - today <= SOON_DAYS;
      notices.push({ ...base, id: `${w.id}-${soon ? "starting-soon" : "upcoming"}`, kind: soon ? "starting-soon" : "upcoming",
        date: startDate,
        title: soon ? `${w.name} is planned to start soon` : `${w.name} is planned`,
        body: `Planned from ${formatDate(startDate)} to ${formatDate(endDate)}.` });
    }
  }
  const order: Record<NoticeKind, number> = { "in-progress": 0, "starting-soon": 1, delayed: 2, cancelled: 3, "dates-passed": 4, upcoming: 5 };
  return notices.sort((a, b) => order[a.kind] - order[b.kind] || a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Filtering (shared by the works list and the map)
// ---------------------------------------------------------------------------

export const DATE_WINDOWS = ["any", "now", "next-30", "next-90"] as const;
export type DateWindow = (typeof DATE_WINDOWS)[number];

export const DATE_WINDOW_LABEL: Record<DateWindow, string> = {
  any: "Any date",
  now: "Scheduled today",
  "next-30": "Next 30 days",
  "next-90": "Next 90 days",
};

export interface WorkFilters {
  query: string;
  statuses: WorkStatus[];
  window: DateWindow;
}

export const EMPTY_WORK_FILTERS: WorkFilters = { query: "", statuses: [], window: "any" };

export function filterWorks(works: readonly PublicWork[], filters: WorkFilters, asOf: IsoDate): PublicWork[] {
  const q = filters.query.trim().toLowerCase();
  const today = isoToDay(asOf);
  const horizon = filters.window === "next-30" ? 30 : filters.window === "next-90" ? 90 : 0;
  return works.filter((w) => {
    if (filters.statuses.length && !filters.statuses.includes(w.status)) return false;
    if (filters.window !== "any") {
      const start = isoToDay(w.schedule.startDate);
      const end = isoToDay(w.schedule.endDate);
      if (end < today || start > today + horizon) return false;
    }
    if (!q) return true;
    return [w.id, w.name, w.organisation ?? ""].join(" ").toLowerCase().includes(q);
  });
}
