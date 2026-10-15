"use client";

import { RotateCcw, Search } from "lucide-react";
import { useId } from "react";
import { useDashboard, type SortMode } from "@/components/dashboard/DashboardProvider";
import { SEVERITY_META, UTILITY_META } from "@/components/dashboard/meta";
import { SEVERITY_PRIORITY } from "@/lib/reports";
import { UTILITY_TYPES } from "@/types";

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const chip = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
    active ? "border-ink bg-ink text-white" : "border-line bg-card text-ink-2 hover:bg-sunken"
  }`;

export function ConflictFilters() {
  const { filters, setFilters, resetFilters, summary, filteredClashes } = useDashboard();
  const searchId = useId();
  const sortId = useId();
  const dirty =
    filters.query !== "" || filters.severities.length > 0 || filters.utilityTypes.length > 0 || filters.sort !== "priority";

  return (
    <div className="space-y-3 rounded-3xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-line px-4 focus-within:border-accent sm:max-w-sm">
          <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
          <label htmlFor={searchId} className="sr-only">
            Search conflicts
          </label>
          <input
            id={searchId}
            type="search"
            value={filters.query}
            onChange={(e) => setFilters({ query: e.target.value })}
            placeholder="Search by ID, asset or excavation"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
        </div>
        <label htmlFor={sortId} className="ml-auto text-xs text-ink-3">
          Sort
        </label>
        <select
          id={sortId}
          value={filters.sort}
          onChange={(e) => setFilters({ sort: e.target.value as SortMode })}
          className="h-10 rounded-full border border-line bg-card px-3 text-sm"
        >
          <option value="priority">Priority</option>
          <option value="distance">Horizontal distance</option>
          <option value="excavation">Excavation</option>
        </select>
        <button
          type="button"
          onClick={resetFilters}
          disabled={!dirty}
          className="flex h-10 items-center gap-1.5 rounded-full border border-line px-3 text-sm hover:bg-sunken disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" aria-hidden /> Reset
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by severity">
        <span className="mr-1 text-xs text-ink-3">Severity</span>
        {SEVERITY_PRIORITY.map((sev) => {
          const meta = SEVERITY_META[sev];
          const Icon = meta.icon;
          const active = filters.severities.includes(sev);
          return (
            <button
              key={sev}
              type="button"
              aria-pressed={active}
              onClick={() => setFilters({ severities: toggle(filters.severities, sev) })}
              className={chip(active)}
            >
              <Icon className="size-3.5" style={{ color: active ? undefined : meta.color }} aria-hidden />
              {meta.label}
              <span className="tabular-nums opacity-70">{summary.bySeverity[sev]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by utility type">
        <span className="mr-1 text-xs text-ink-3">Utility</span>
        {UTILITY_TYPES.map((type) => {
          const active = filters.utilityTypes.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => setFilters({ utilityTypes: toggle(filters.utilityTypes, type) })}
              className={chip(active)}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: UTILITY_META[type].color }} aria-hidden />
              {UTILITY_META[type].label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink-3" aria-live="polite">
        Showing {filteredClashes.length} of {summary.totalClashes} detected conflicts
      </p>
    </div>
  );
}
