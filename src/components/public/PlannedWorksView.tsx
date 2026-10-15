"use client";

import { MapPin, SearchX } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/Panel";
import { usePublicData } from "./PublicDataProvider";
import { TimingNote, WorkFacts, WorkFilterBar, WorkHeading } from "./ui";

export function PlannedWorksView() {
  const { filteredWorks, resetFilters } = usePublicData();
  return (
    <>
      <PageHeader
        title="Planned works"
        subtitle="Every excavation in the records, including cancelled and delayed works. Details the records do not include are shown as “Not recorded”."
      />
      <WorkFilterBar />

      {filteredWorks.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={SearchX} title="No works match these filters">
            <button type="button" onClick={resetFilters} className="text-accent underline-offset-2 hover:underline">
              Clear filters
            </button>
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredWorks.map((w) => (
            <li key={w.id}>
              <article
                aria-labelledby={`work-${w.id}`}
                className="flex h-full flex-col rounded-3xl border border-line bg-card p-5"
              >
                <div id={`work-${w.id}`}>
                  <WorkHeading work={w} as="h2" />
                </div>
                <TimingNote work={w} />
                <div className="mt-4 flex-1">
                  <WorkFacts work={w} />
                </div>
                <Link
                  href={`/public/map?work=${encodeURIComponent(w.id)}`}
                  className="mt-4 inline-flex h-10 items-center gap-2 self-start rounded-full border border-line px-4 text-sm font-medium hover:bg-sunken"
                >
                  <MapPin className="size-4" aria-hidden /> View on map
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
