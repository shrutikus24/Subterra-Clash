"use client";

import { Ban, CalendarClock, CalendarX2, Clock, Hammer, Hourglass, Megaphone, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { WorkStatusPill } from "@/components/dashboard/badges";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState, Panel } from "@/components/dashboard/Panel";
import { dayToIso, formatDate, formatDateRange, isoToDay } from "@/lib/format";
import type { NoticeKind, PublicNotice, PublicWork, WorkTiming } from "@/lib/public";
import type { WorkStatus } from "@/types";
import { usePublicData } from "./PublicDataProvider";
import { TimingNote } from "./ui";

const NOTICE_ICON: Record<NoticeKind, LucideIcon> = {
  "in-progress": Hammer,
  "starting-soon": Clock,
  upcoming: CalendarClock,
  delayed: Hourglass,
  cancelled: Ban,
  "dates-passed": CalendarX2,
};

export function NoticeList({ notices }: { notices: readonly PublicNotice[] }) {
  if (notices.length === 0) return <EmptyState icon={Megaphone} title="No notices" />;
  return (
    <ul className="grid gap-2">
      {notices.map((n) => {
        const Icon = NOTICE_ICON[n.kind];
        const muted = n.kind === "cancelled" || n.kind === "dates-passed";
        return (
          <li key={n.id} className="flex gap-3 rounded-2xl border border-line p-3">
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-full ${muted ? "bg-sunken text-ink-3" : "bg-accent-soft text-accent"}`}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium">{n.title}</p>
              <p className="mt-0.5 text-ink-2">{n.body}</p>
              <Link
                href={`/public/map?work=${encodeURIComponent(n.workId)}`}
                className="mt-1 inline-block text-xs text-accent underline-offset-2 hover:underline"
              >
                Show on map
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const BAR_CLASS: Record<WorkStatus, string> = {
  planned: "bg-accent/80",
  active: "bg-ink",
  delayed: "bg-sev-medium",
  cancelled: "border border-dashed border-ink-3 bg-transparent",
};

const GROUPS: { timing: WorkTiming; title: string; empty: string }[] = [
  { timing: "in-progress", title: "Scheduled now", empty: "No works are scheduled for today." },
  { timing: "upcoming", title: "Upcoming", empty: "No upcoming works in the records." },
  { timing: "past", title: "Dates passed", empty: "No works with past dates." },
  { timing: "cancelled", title: "Cancelled", empty: "No cancelled works." },
];

/** Month-scaled bars for every work, with today marked. Bars only; the grouped lists carry the detail. */
function ScheduleBars({ works, asOf }: { works: readonly PublicWork[]; asOf: string }) {
  if (works.length === 0) return null;
  const first = works.reduce((m, w) => (w.schedule.startDate < m ? w.schedule.startDate : m), asOf);
  const last = works.reduce((m, w) => (w.schedule.endDate > m ? w.schedule.endDate : m), asOf);
  const start = isoToDay(`${first.slice(0, 7)}-01`);
  const [ly, lm] = last.split("-").map(Number);
  const end = Date.UTC(lm === 12 ? (ly ?? 0) + 1 : (ly ?? 0), lm === 12 ? 0 : (lm ?? 1), 1) / 86_400_000;
  const span = end - start;
  const pct = (iso: string) => ((isoToDay(iso) - start) / span) * 100;

  const months: string[] = [];
  for (let d = start; d < end; ) {
    const iso = dayToIso(d);
    months.push(iso);
    const [y, m] = iso.split("-").map(Number);
    d = Date.UTC(m === 12 ? (y ?? 0) + 1 : (y ?? 0), m === 12 ? 0 : (m ?? 1), 1) / 86_400_000;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="relative ml-44 h-6 text-[11px] text-ink-3" aria-hidden>
          {months.map((m) => (
            <span key={m} className="absolute border-l border-line pl-1" style={{ left: `${pct(m)}%` }}>
              {formatDate(m).slice(2)}
            </span>
          ))}
        </div>
        <ul className="space-y-2">
          {works.map((w) => (
            <li key={w.id} className="flex items-center">
              <span className="w-44 shrink-0 truncate pr-3 text-sm" title={w.name}>
                {w.name}
              </span>
              <div className="relative h-7 flex-1 rounded-full bg-sunken">
                <div
                  className={`absolute top-1 bottom-1 rounded-full ${BAR_CLASS[w.status]}`}
                  style={{
                    left: `${pct(w.schedule.startDate)}%`,
                    width: `${((isoToDay(w.schedule.endDate) - isoToDay(w.schedule.startDate) + 1) / span) * 100}%`,
                  }}
                  title={`${w.name}: ${formatDateRange(w.schedule.startDate, w.schedule.endDate)} (${w.status})`}
                />
                <div className="absolute -top-1 -bottom-1 w-px bg-accent" style={{ left: `${pct(asOf)}%` }} aria-hidden />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 ml-44 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3" aria-hidden>
          {(["planned", "active", "delayed", "cancelled"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-5 rounded-full ${BAR_CLASS[s]}`} />
              <WorkStatusPill status={s} />
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px bg-accent" /> Information date ({formatDate(asOf)})
          </span>
        </div>
      </div>
    </div>
  );
}

export function PublicTimelineView() {
  const { works, notices, asOf } = usePublicData();
  return (
    <>
      <PageHeader
        title="Timeline and notices"
        subtitle={`Work dates from the schedule records as of ${formatDate(asOf)}. Planned dates are not confirmation that work is happening; check notices for delays and cancellations.`}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel title="Schedule" subtitle="Each bar spans the recorded start and end dates" icon={CalendarClock} className="lg:col-span-12">
          <ScheduleBars works={works} asOf={asOf} />
          <p className="sr-only">The same dates are listed in the sections below.</p>
        </Panel>

        <div className="grid content-start gap-4 lg:col-span-7">
          {GROUPS.map((g) => {
            const list = works.filter((w) => w.timing === g.timing);
            return (
              <Panel key={g.timing} title={g.title} subtitle={`${list.length} ${list.length === 1 ? "work" : "works"}`}>
                {list.length === 0 ? (
                  <p className="text-sm text-ink-3">{g.empty}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {list.map((w) => (
                      <li key={w.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className={`font-medium ${w.status === "cancelled" ? "text-ink-2 line-through decoration-ink-3" : ""}`}>
                            {w.name}
                          </p>
                          <WorkStatusPill status={w.status} />
                        </div>
                        <p className="mt-0.5 text-sm text-ink-2">
                          {formatDateRange(w.schedule.startDate, w.schedule.endDate)}
                        </p>
                        <TimingNote work={w} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>

        <Panel title="Notices" subtitle="Generated from the schedule records; no other source" icon={Megaphone} className="h-fit lg:col-span-5">
          <NoticeList notices={notices} />
        </Panel>
      </div>
    </>
  );
}
