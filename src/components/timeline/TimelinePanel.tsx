"use client";

import { CalendarRange } from "lucide-react";
import Link from "next/link";
import { WorkStatusPill } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { EmptyState, Panel } from "@/components/dashboard/Panel";
import { dayToIso, formatDate, formatDateRange, isoToDay } from "@/lib/format";
import type { WorkStatus } from "@/types";

const BAR_CLASS: Record<WorkStatus, string> = {
  planned: "bg-accent/80",
  active: "bg-ink",
  delayed: "bg-sev-medium",
  cancelled: "border border-dashed border-ink-3 bg-transparent",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Gantt-style schedule of all excavations, with engine-reported overlap windows marked. */
export function ScheduleTimeline({ compact = false }: { compact?: boolean }) {
  const { dataset, scheduleOverlaps, analysisDate, selectFeature, selectedClash, selectedFeature } = useDashboard();
  const works = [...dataset.excavations].sort((a, b) => a.schedule.startDate.localeCompare(b.schedule.startDate));

  if (works.length === 0) {
    return <EmptyState icon={CalendarRange} title="No excavation projects" />;
  }

  // Range padded to whole months so ticks line up.
  const first = works[0]?.schedule.startDate ?? analysisDate;
  const last = works.reduce((m, w) => (w.schedule.endDate > m ? w.schedule.endDate : m), first);
  const startIso = `${first.slice(0, 7)}-01`;
  const [ly, lm] = last.split("-").map(Number);
  const endIso = dayToIso(Date.UTC(lm === 12 ? (ly ?? 0) + 1 : (ly ?? 0), lm === 12 ? 0 : (lm ?? 1), 1) / 86_400_000);
  const start = isoToDay(startIso);
  const span = isoToDay(endIso) - start;
  const pct = (iso: string) => ((isoToDay(iso) - start) / span) * 100;
  const widthPct = (a: string, b: string) => ((isoToDay(b) - isoToDay(a) + 1) / span) * 100;

  const months: { iso: string; label: string }[] = [];
  for (let d = start; d < start + span; ) {
    const iso = dayToIso(d);
    const [y, m] = iso.split("-").map(Number);
    months.push({ iso, label: `${MONTHS[(m ?? 1) - 1]}${m === 1 || months.length === 0 ? ` ${y}` : ""}` });
    d = Date.UTC(m === 12 ? (y ?? 0) + 1 : (y ?? 0), m === 12 ? 0 : (m ?? 1), 1) / 86_400_000;
  }
  const todayInRange = analysisDate >= startIso && analysisDate < endIso;
  const activeId = selectedClash?.excavationId ?? (selectedFeature?.kind === "excavation" ? selectedFeature.id : null);

  return (
    <div>
      <div className="relative ml-0 sm:ml-48">
        <div className="relative flex h-6 text-[11px] text-ink-3" aria-hidden>
          {months.map((m) => (
            <span key={m.iso} className="absolute border-l border-line pl-1" style={{ left: `${pct(m.iso)}%` }}>
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <ul className="relative space-y-2">
        {works.map((w) => {
          const overlaps = scheduleOverlaps.filter((o) => o.excavationIds.includes(w.id));
          const selected = activeId === w.id;
          return (
            <li key={w.id} className="sm:flex sm:items-center">
              <button
                type="button"
                onClick={() => selectFeature({ kind: "excavation", id: w.id })}
                aria-pressed={selected}
                className={`mb-1 flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1 text-left sm:mb-0 sm:w-48 sm:shrink-0 sm:pr-3 ${
                  selected ? "bg-accent-soft" : "hover:bg-sunken"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{w.name}</span>
                  {!compact && <span className="block text-[11px] text-ink-3">{formatDateRange(w.schedule.startDate, w.schedule.endDate)}</span>}
                </span>
                <WorkStatusPill status={w.status} />
              </button>
              <div className={`relative flex-1 rounded-full bg-sunken ${compact ? "h-6" : "h-8"}`}>
                <div
                  className={`absolute top-1 bottom-1 rounded-full ${BAR_CLASS[w.status]}`}
                  style={{ left: `${pct(w.schedule.startDate)}%`, width: `${widthPct(w.schedule.startDate, w.schedule.endDate)}%` }}
                  title={`${w.name}: ${formatDateRange(w.schedule.startDate, w.schedule.endDate)} (${w.status})`}
                />
                {overlaps.map((o) => (
                  <div
                    key={o.excavationIds.join()}
                    className="absolute top-0 bottom-0 rounded-full border-2 border-sev-high"
                    style={{
                      left: `${pct(o.window.startDate)}%`,
                      width: `${widthPct(o.window.startDate, o.window.endDate)}%`,
                      backgroundImage: "repeating-linear-gradient(45deg, rgb(236 131 90 / .45) 0 3px, transparent 3px 7px)",
                    }}
                    title={`Overlap on shared assets: ${formatDateRange(o.window.startDate, o.window.endDate)}`}
                  />
                ))}
                {todayInRange && (
                  <div className="absolute -top-1 -bottom-1 w-px bg-accent" style={{ left: `${pct(analysisDate)}%` }} aria-hidden />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3 sm:ml-48">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full border-2 border-sev-high" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgb(236 131 90 / .45) 0 3px, transparent 3px 7px)" }} aria-hidden />
          Overlap on a shared asset
        </span>
        {todayInRange && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px bg-accent" aria-hidden /> Analysis date ({formatDate(analysisDate)})
          </span>
        )}
      </div>
    </div>
  );
}

export function TimelinePanel({ className = "" }: { className?: string }) {
  const { summary } = useDashboard();
  return (
    <Panel
      title="Excavation Schedule"
      subtitle={`${summary.totalExcavations} projects · ${summary.activeExcavations} active`}
      icon={CalendarRange}
      className={className}
      actions={
        <Link href="/schedule" className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-sunken">
          Full schedule
        </Link>
      }
    >
      <ScheduleTimeline compact />
    </Panel>
  );
}
