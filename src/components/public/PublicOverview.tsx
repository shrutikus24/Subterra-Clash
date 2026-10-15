"use client";

import { ArrowRight, CalendarClock, Megaphone, ShieldAlert, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState, Panel } from "@/components/dashboard/Panel";
import { formatDate, formatDateRange } from "@/lib/format";
import { CATEGORY_META, FINDING_CATEGORIES } from "@/lib/public";
import { usePublicData } from "./PublicDataProvider";
import { NoticeList } from "./PublicTimelineView";
import { Callout, StatTile, TimingNote, WorkHeading } from "./ui";

export function PublicOverview() {
  const { asOf, works, metrics, notices } = usePublicData();
  const upcoming = works.filter((w) => w.timing === "in-progress" || w.timing === "upcoming").slice(0, 4);

  return (
    <>
      <PageHeader
        title="Planned and active street works"
        subtitle={`Where digging is planned, when it is scheduled, and what an automated check of the records found. Information as of ${formatDate(asOf)}, from fictional demonstration data.`}
        actions={
          <Link
            href="/public/map"
            className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/90"
          >
            View works map <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Scheduled now"
          value={metrics.inProgress}
          note="Works whose dates include today"
          href="/public/timeline"
        />
        <StatTile label="Upcoming" value={metrics.upcoming} note="Planned to start later" href="/public/works" />
        <StatTile
          label="Affected work sites"
          value={metrics.workSites}
          note={`${metrics.workLengthM} m of dig routes, excluding cancelled`}
          href="/public/map"
        />
        <StatTile
          label="Potential conflicts"
          value={metrics.findings}
          note={`On ${metrics.worksWithFindings} of ${metrics.totalWorks} works`}
          href="/public/conflicts"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Upcoming and current works"
          subtitle="Sorted by start date"
          icon={CalendarClock}
          className="lg:col-span-7"
          actions={
            <Link href="/public/works" className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-sunken">
              All works
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <EmptyState title="No current or upcoming works in the records" />
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((w) => (
                <li key={w.id} className="py-3 first:pt-0 last:pb-0">
                  <WorkHeading work={w} />
                  <p className="mt-1 text-sm text-ink-2">
                    {formatDateRange(w.schedule.startDate, w.schedule.endDate)}
                    {w.organisation && <span className="text-ink-3"> · {w.organisation}</span>}
                  </p>
                  <TimingNote work={w} />
                  <Link
                    href={`/public/map?work=${encodeURIComponent(w.id)}`}
                    className="mt-1.5 inline-block text-sm text-accent underline-offset-2 hover:underline"
                  >
                    Show on map
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Notices"
          subtitle="Generated from schedule records"
          icon={Megaphone}
          className="lg:col-span-5"
          actions={
            <Link href="/public/timeline" className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-sunken">
              Timeline
            </Link>
          }
        >
          <NoticeList notices={notices.slice(0, 4)} />
        </Panel>

        <Panel
          title="What the automated check found"
          subtitle="Potential conflicts between planned digging and underground lines"
          icon={ShieldAlert}
          className="lg:col-span-12"
          actions={
            <Link href="/public/conflicts" className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-sunken">
              Read the findings
            </Link>
          }
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FINDING_CATEGORIES.map((c) => (
              <li key={c} className="rounded-2xl border border-line p-4">
                <p className="text-2xl font-semibold tabular-nums">{metrics.byCategory[c]}</p>
                <p className="mt-1 text-sm font-medium">{CATEGORY_META[c].label}</p>
                <p className="mt-0.5 text-xs text-ink-3">{CATEGORY_META[c].description}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Callout icon={ShieldQuestion} title="No finding does not mean safe">
              The check only knows what the utility records say, and records can be missing, old or wrong. Every
              dig still needs on-site checks.
            </Callout>
          </div>
        </Panel>
      </div>
    </>
  );
}
