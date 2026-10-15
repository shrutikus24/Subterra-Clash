"use client";

import { CircleCheckBig, EyeOff, ListChecks, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { WorkStatusPill } from "@/components/dashboard/badges";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { formatDate, formatDateRange } from "@/lib/format";
import { CATEGORY_META, FINDING_CATEGORIES, type FindingCategory, type PublicFinding } from "@/lib/public";
import { usePublicData } from "./PublicDataProvider";
import { Callout, CategoryBadge, PriorityBadge, TimingNote } from "./ui";

function FindingCard({ finding }: { finding: PublicFinding }) {
  return (
    <article className="rounded-2xl border border-line p-4" aria-labelledby={`${finding.id}-title`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={finding.priority} />
        {finding.categories.map((c) => (
          <CategoryBadge key={c} category={c} />
        ))}
        <span className="ml-auto font-mono text-[11px] text-ink-3">{finding.id}</span>
      </div>
      <h3 id={`${finding.id}-title`} className="mt-3 text-sm font-medium">
        {finding.summary}
      </h3>

      {finding.reasons.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-3">Why this needs attention</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
            {finding.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {finding.overlap && (
        <p className="mt-3 text-sm text-ink-2">
          <span className="font-medium text-ink">Overlapping work: </span>
          {finding.overlap.works.map((w, i) => (
            <span key={w.id}>
              {i > 0 && ", "}
              <a href={`#${w.id}`} className="text-accent underline-offset-2 hover:underline">
                {w.name}
              </a>
            </span>
          ))}{" "}
          during {formatDateRange(finding.overlap.window.startDate, finding.overlap.window.endDate)}.
        </p>
      )}

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-3">Recommended next step</dt>
          <dd className="mt-0.5">{finding.nextStep}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Finding status</dt>
          <dd className="mt-0.5">Automated screening result, not verified by an engineer</dd>
        </div>
      </dl>
    </article>
  );
}

export function PublicConflictsView() {
  const { works, findings, metrics, asOf } = usePublicData();
  const [category, setCategory] = useState<FindingCategory | null>(null);
  const visible = category ? findings.filter((f) => f.categories.includes(category)) : findings;

  return (
    <>
      <PageHeader
        title="Conflict findings"
        subtitle={`Plain-language summaries of an automated check that compares planned digging with underground utility records. Results as of ${formatDate(asOf)}, from fictional demonstration data.`}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Callout icon={ShieldQuestion} title="A work with no finding is not confirmed safe">
          The check can only use the records it has. Lines may be missing from the records, or recorded in the wrong
          place. On-site checks are always needed before digging.
        </Callout>
        <Callout icon={EyeOff} title="What is not shown">
          To protect critical infrastructure and private information, this page does not publish exact locations,
          depths, names or owners of underground lines. Only the general type of line is given.
        </Callout>
      </div>

      <section aria-labelledby="types-heading" className="mt-4 rounded-3xl border border-line bg-card p-5">
        <h2 id="types-heading" className="text-[17px] font-semibold tracking-tight">
          Types of finding
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-3">Select a type to show only those findings. One finding can have more than one type.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FINDING_CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setCategory(on ? null : c)}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  on ? "border-ink bg-ink text-white" : "border-line hover:bg-sunken"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{CATEGORY_META[c].label}</span>
                  <span className="text-xl font-semibold tabular-nums">{metrics.byCategory[c]}</span>
                </span>
                <span className={`mt-1 block text-xs ${on ? "text-white/80" : "text-ink-3"}`}>
                  {CATEGORY_META[c].description}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-3" role="status">
          {category
            ? `Showing ${visible.length} ${CATEGORY_META[category].label.toLowerCase()} findings of ${findings.length}.`
            : `Showing all ${findings.length} findings across ${metrics.worksWithFindings} works.`}
        </p>
      </section>

      <div className="mt-4 grid gap-4">
        {works.map((w) => {
          const own = visible.filter((f) => f.workId === w.id);
          if (category && own.length === 0) return null;
          return (
            <section
              key={w.id}
              id={w.id}
              aria-labelledby={`${w.id}-heading`}
              className="scroll-mt-6 rounded-3xl border border-line bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 id={`${w.id}-heading`} className="text-base font-semibold tracking-tight">
                    {w.name}
                  </h2>
                  <p className="text-sm text-ink-2">
                    {formatDateRange(w.schedule.startDate, w.schedule.endDate)}
                    {w.organisation && <span className="text-ink-3"> · {w.organisation}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <WorkStatusPill status={w.status} />
                  <Link
                    href={`/public/map?work=${encodeURIComponent(w.id)}`}
                    className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-sunken"
                  >
                    Map
                  </Link>
                </div>
              </div>
              <TimingNote work={w} />

              {!w.assessed ? (
                <p className="mt-3 flex items-start gap-2 rounded-2xl bg-sunken px-3 py-2.5 text-sm text-ink-2">
                  <ListChecks className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                  Not assessed: this work is cancelled, so the automated check did not review it. If it is
                  restarted it would need to be checked again.
                </p>
              ) : own.length === 0 ? (
                <p className="mt-3 flex items-start gap-2 rounded-2xl bg-sunken px-3 py-2.5 text-sm text-ink-2">
                  <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                  No potential conflicts were detected in the records checked. This does not mean the area is safe:
                  records may be incomplete, and on-site checks are still required.
                </p>
              ) : (
                <div className="mt-3 grid gap-3">
                  {own.map((f) => (
                    <FindingCard key={f.id} finding={f} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
