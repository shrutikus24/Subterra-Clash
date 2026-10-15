"use client";

import { Info, RotateCcw, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode } from "react";
import { WorkStatusPill } from "@/components/dashboard/badges";
import { SEVERITY_META, WORK_STATUS_META } from "@/components/dashboard/meta";
import { formatDateRange } from "@/lib/format";
import {
  CATEGORY_META,
  DATE_WINDOWS,
  DATE_WINDOW_LABEL,
  PRIORITY_LABEL,
  type FindingCategory,
  type PublicWork,
} from "@/lib/public";
import { WORK_STATUSES, type ConflictSeverity } from "@/types";
import { usePublicData } from "./PublicDataProvider";

/** Priority pill in plain language; reuses the dashboard's severity colours and icons. */
export function PriorityBadge({ priority }: { priority: ConflictSeverity }) {
  const meta = SEVERITY_META[priority];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-ink"
      style={{ backgroundColor: meta.tint }}
    >
      <Icon className="size-3.5" style={{ color: meta.color }} aria-hidden />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: FindingCategory }) {
  return (
    <span className="inline-flex rounded-full border border-line px-2.5 py-0.5 text-xs whitespace-nowrap text-ink-2">
      {CATEGORY_META[category].label}
    </span>
  );
}

export function StatTile({ label, value, note, href }: { label: string; value: number | string; note?: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-3">{note}</p>}
    </>
  );
  const cls = "block rounded-3xl border border-line bg-card p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-shadow hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Callout({ icon: Icon = Info, title, children }: { icon?: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-3xl border border-accent/25 bg-accent-soft px-4 py-3 text-sm">
      <Icon className="mt-0.5 size-4.5 shrink-0 text-accent" aria-hidden />
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <div className="mt-0.5 text-ink-2">{children}</div>
      </div>
    </div>
  );
}

const NOT_RECORDED = <span className="text-ink-3">Not recorded</span>;

/** Public facts for one work. Fields the record lacks are shown as "Not recorded", never guessed. */
export function WorkFacts({ work, compact = false }: { work: PublicWork; compact?: boolean }) {
  return (
    <dl className={`grid gap-x-4 gap-y-2 text-sm ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
      <Fact label="Dates">{formatDateRange(work.schedule.startDate, work.schedule.endDate)}</Fact>
      <Fact label="Responsible organisation">{work.organisation ?? NOT_RECORDED}</Fact>
      <Fact label="Area / road">
        {NOT_RECORDED}
        <span className="text-ink-3"> · see map</span>
      </Fact>
      <Fact label="Purpose">{NOT_RECORDED}</Fact>
      <Fact label="Dig route">
        {work.lengthM} m long, {work.widthM} m wide
      </Fact>
      <Fact label="Conflict findings">
        {!work.assessed ? (
          <span className="text-ink-3">Not assessed (cancelled)</span>
        ) : work.findingCount === 0 ? (
          <span>None detected (not a safety confirmation)</span>
        ) : (
          <Link href={`/public/conflicts#${work.id}`} className="font-medium text-accent underline-offset-2 hover:underline">
            {work.findingCount} potential {work.findingCount === 1 ? "conflict" : "conflicts"}
          </Link>
        )}
      </Fact>
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export function WorkHeading({ work, as: Heading = "h3" }: { work: PublicWork; as?: "h2" | "h3" }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <Heading className={`text-base font-semibold tracking-tight ${work.status === "cancelled" ? "text-ink-2" : ""}`}>
          {work.name}
        </Heading>
        <p className="font-mono text-[11px] text-ink-3">{work.id}</p>
      </div>
      <WorkStatusPill status={work.status} />
    </div>
  );
}

export function TimingNote({ work }: { work: PublicWork }) {
  if (!work.timingNote) return null;
  return (
    <p className="mt-2 rounded-2xl bg-sunken px-3 py-2 text-xs text-ink-2">
      <Info className="mr-1 inline size-3.5 -translate-y-px text-ink-3" aria-hidden />
      {work.timingNote}
    </p>
  );
}

/** Search, status and date filters shared by the works list and the map. */
export function WorkFilterBar({ resultLabel }: { resultLabel?: string }) {
  const { filters, setFilters, resetFilters, filteredWorks, works } = usePublicData();
  const searchId = useId();
  const windowId = useId();
  const dirty = filters.query !== "" || filters.statuses.length > 0 || filters.window !== "any";

  return (
    <div className="rounded-3xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor={searchId} className="text-xs text-ink-3">
            Search works
          </label>
          <div className="mt-1 flex h-11 items-center gap-2 rounded-full border border-line bg-card px-4 focus-within:border-accent">
            <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
            <input
              id={searchId}
              type="search"
              value={filters.query}
              onChange={(e) => setFilters({ query: e.target.value })}
              placeholder="Name, reference or organisation"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ink-3"
            />
          </div>
        </div>
        <div className="basis-40">
          <label htmlFor={windowId} className="text-xs text-ink-3">
            When
          </label>
          <select
            id={windowId}
            value={filters.window}
            onChange={(e) => setFilters({ window: e.target.value as (typeof DATE_WINDOWS)[number] })}
            className="mt-1 h-11 w-full rounded-full border border-line bg-card px-4 text-sm"
          >
            {DATE_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {DATE_WINDOW_LABEL[w]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="mt-3">
        <legend className="text-xs text-ink-3">Status</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {WORK_STATUSES.map((s) => {
            const on = filters.statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setFilters({ statuses: on ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s] })
                }
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  on ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:bg-sunken"
                }`}
              >
                {WORK_STATUS_META[s].label}
              </button>
            );
          })}
          {dirty && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-accent hover:bg-sunken"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Clear filters
            </button>
          )}
        </div>
      </fieldset>
      <p className="mt-3 text-xs text-ink-3" role="status">
        {resultLabel ?? `Showing ${filteredWorks.length} of ${works.length} works`}
        <span className="block sm:inline">
          <span className="hidden sm:inline"> · </span>
          Filtering by work category is not available: the records do not include one.
        </span>
      </p>
    </div>
  );
}
