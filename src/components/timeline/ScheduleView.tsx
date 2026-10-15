"use client";

import { CalendarRange, GitMerge } from "lucide-react";
import { WorkStatusPill } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState, Panel } from "@/components/dashboard/Panel";
import { formatDate, formatDateRange, formatMetres } from "@/lib/format";
import { ScheduleTimeline } from "./TimelinePanel";

export function ScheduleView() {
  const { dataset, scheduleOverlaps, excavationById, assetById, rankedClashes, selectFeature } = useDashboard();
  const works = [...dataset.excavations].sort((a, b) => a.schedule.startDate.localeCompare(b.schedule.startDate));

  return (
    <>
      <PageHeader
        title="Excavation Schedule"
        subtitle="Planned, active, delayed and cancelled works. Overlaps are shown only where two works may physically affect the same asset at the same time."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Timeline" icon={CalendarRange} className="xl:col-span-12">
          <ScheduleTimeline />
        </Panel>

        <Panel title="Schedule Overlaps" subtitle="From clash-engine results" icon={GitMerge} className="xl:col-span-5">
          {scheduleOverlaps.length === 0 ? (
            <EmptyState title="No overlapping works on shared assets" />
          ) : (
            <ul className="space-y-3">
              {scheduleOverlaps.map((o) => (
                <li key={o.excavationIds.join()} className="rounded-2xl border border-line p-3">
                  <p className="text-sm font-medium">
                    {o.excavationIds.map((id) => excavationById.get(id)?.name ?? id).join(" + ")}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-2">{formatDateRange(o.window.startDate, o.window.endDate)}</p>
                  <p className="mt-2 text-xs text-ink-3">
                    Shared assets: {o.assetIds.map((id) => assetById.get(id)?.name ?? id).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Projects" className="xl:col-span-7">
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-sunken text-xs text-ink-3">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Project</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  <th scope="col" className="px-3 py-3 font-medium">Start</th>
                  <th scope="col" className="px-3 py-3 font-medium">End</th>
                  <th scope="col" className="px-3 py-3 font-medium">Depth · width</th>
                  <th scope="col" className="px-3 py-3 font-medium">Conflicts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {works.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => selectFeature({ kind: "excavation", id: w.id })}
                        className="text-left font-medium hover:underline"
                      >
                        {w.name}
                      </button>
                      <div className="font-mono text-[11px] text-ink-3">{w.id}</div>
                    </td>
                    <td className="px-3 py-3">
                      <WorkStatusPill status={w.status} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-2">{formatDate(w.schedule.startDate)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-2">{formatDate(w.schedule.endDate)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-2">
                      {formatMetres(w.plannedDepthM)} · {formatMetres(w.widthM)}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {w.status === "cancelled" ? (
                        <span className="text-xs text-ink-3">Excluded</span>
                      ) : (
                        rankedClashes.filter((c) => c.excavationId === w.id).length
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
