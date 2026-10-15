import type { WorkSchedule } from "@/types";

// ISO YYYY-MM-DD strings sort chronologically, so plain string comparison is exact and timezone-free.

/** Inclusive overlap: works that share even a single day overlap. */
export function schedulesOverlap(a: WorkSchedule, b: WorkSchedule): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function scheduleIntersection(a: WorkSchedule, b: WorkSchedule): WorkSchedule | undefined {
  if (!schedulesOverlap(a, b)) return undefined;
  return {
    startDate: a.startDate > b.startDate ? a.startDate : b.startDate,
    endDate: a.endDate < b.endDate ? a.endDate : b.endDate,
  };
}

/** Smallest window covering all given windows. */
export function envelope(windows: readonly WorkSchedule[]): WorkSchedule | undefined {
  const [first, ...rest] = windows;
  if (!first) return undefined;
  return rest.reduce<WorkSchedule>(
    (acc, w) => ({
      startDate: w.startDate < acc.startDate ? w.startDate : acc.startDate,
      endDate: w.endDate > acc.endDate ? w.endDate : acc.endDate,
    }),
    first,
  );
}

/** True when `surveyDate` is at least `years` before `referenceDate`. */
export function isOlderThan(surveyDate: string, years: number, referenceDate: string): boolean {
  const [y, m, d] = surveyDate.split("-");
  if (!y || !m || !d) return false;
  return `${String(Number(y) + years).padStart(4, "0")}-${m}-${d}` <= referenceDate;
}
