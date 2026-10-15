"use client";

import { ChevronDown, Inbox, Search } from "lucide-react";
import { useId, useState } from "react";
import { SeverityBadge, UtilitySwatch } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { SEVERITY_META } from "@/components/dashboard/meta";
import { EmptyState } from "@/components/dashboard/Panel";
import { formatMetres, formatSignedMetres, shortClashId } from "@/lib/format";
import { SEVERITY_PRIORITY } from "@/lib/reports";
import type { ClashResult } from "@/types";

/** Vertical clearance from the engine, compared with the engine's buffer. Unknown stays unknown. */
function clearanceLine(clash: ClashResult, bufferM: number): { text: string; short: boolean } {
  if (clash.verticalClearanceM === undefined) return { text: "Vertical clearance not recorded", short: false };
  const shortfall = Math.round((bufferM - clash.verticalClearanceM) * 100) / 100;
  return shortfall > 0
    ? { text: `${formatSignedMetres(clash.verticalClearanceM)} · ${formatMetres(shortfall)} short of ${formatMetres(bufferM)} buffer`, short: true }
    : { text: `${formatSignedMetres(clash.verticalClearanceM)} · meets ${formatMetres(bufferM)} buffer`, short: false };
}

/** Searchable, scrollable conflict list for the mapping workspace. Shares filters and selection app-wide. */
export function ConflictListPanel({ className = "" }: { className?: string }) {
  const { filteredClashes, filters, setFilters, summary, selectedClash, selectClash, assetById, excavationById, config } =
    useDashboard();
  const [mobileOpen, setMobileOpen] = useState(false);
  const listId = useId();
  const searchId = useId();

  return (
    <section
      aria-labelledby={`${listId}-title`}
      className={`flex min-w-0 flex-col rounded-3xl border border-line bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)] lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] ${className}`}
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h2 id={`${listId}-title`} className="text-[17px] font-semibold tracking-tight">
            Conflicts
          </h2>
          <p className="mt-0.5 truncate text-[13px] text-ink-3">
            {filteredClashes.length} of {summary.totalClashes} engine results
            {selectedClash && <span className="lg:hidden"> · selected {shortClashId(selectedClash.id)}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-controls={listId}
          className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm hover:bg-sunken lg:hidden"
        >
          {mobileOpen ? "Hide" : "Show"} list
          <ChevronDown className={`size-4 transition-transform ${mobileOpen ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </header>

      <div id={listId} className={`${mobileOpen ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>
        <div className="px-5 pb-3">
          <div className="flex h-10 items-center gap-2 rounded-full border border-line px-4 focus-within:border-accent">
            <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
            <label htmlFor={searchId} className="sr-only">
              Search by conflict ID, street, excavation or utility asset
            </label>
            <input
              id={searchId}
              type="search"
              value={filters.query}
              onChange={(e) => setFilters({ query: e.target.value })}
              placeholder="Conflict ID, street or asset…"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ink-3"
            />
          </div>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-3" aria-label="Detected conflicts">
          {filteredClashes.length === 0 && (
            <li>
              <EmptyState icon={Inbox} title="No conflicts match">
                Not proof that the ground is clear.
              </EmptyState>
            </li>
          )}
          {filteredClashes.map((c) => {
            const asset = assetById.get(c.affectedAssetIds[0] ?? "");
            const excavation = excavationById.get(c.excavationId);
            const selected = selectedClash?.id === c.id;
            const clearance = clearanceLine(c, config.verticalBufferM);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => selectClash(c.id)}
                  aria-pressed={selected}
                  className={`w-full rounded-2xl border p-3.5 text-left transition-colors ${
                    selected ? "border-accent bg-accent-soft" : "border-line bg-card hover:bg-sunken"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-ink-2">{shortClashId(c.id)}</span>
                    <SeverityBadge severity={c.severity} />
                  </span>
                  <span className="mt-1.5 block text-sm font-semibold text-ink">{excavation?.name ?? c.excavationId}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-2">
                    {asset && <UtilitySwatch type={asset.type} withLabel={false} />}
                    {asset?.name ?? c.affectedAssetIds.join(", ")}
                  </span>
                  <span
                    className={`mt-2 block border-t border-line pt-2 text-xs ${
                      c.verticalClearanceM === undefined ? "text-ink-3 italic" : clearance.short ? "font-medium text-ink" : "text-ink-2"
                    }`}
                  >
                    {clearance.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="border-t border-line px-5 py-3">
          <p className="mb-1.5 text-[11px] text-ink-3">Categories · select to filter</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by severity">
            {SEVERITY_PRIORITY.filter((s) => summary.bySeverity[s] > 0).map((sev) => {
              const meta = SEVERITY_META[sev];
              const Icon = meta.icon;
              const active = filters.severities.includes(sev);
              return (
                <button
                  key={sev}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setFilters({
                      severities: active ? filters.severities.filter((s) => s !== sev) : [...filters.severities, sev],
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                    active ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:bg-sunken"
                  }`}
                >
                  <Icon className="size-3.5" style={{ color: active ? undefined : meta.color }} aria-hidden />
                  <span className="tabular-nums">{summary.bySeverity[sev]}</span> {meta.label}
                </button>
              );
            })}
          </div>
        </footer>
      </div>
    </section>
  );
}
