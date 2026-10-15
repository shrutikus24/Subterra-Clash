"use client";

import { MapPinned, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { WorkStatusPill } from "@/components/dashboard/badges";
import { WORK_STATUS_META } from "@/components/dashboard/meta";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState, Panel } from "@/components/dashboard/Panel";
import { MapLoading } from "@/components/map/ClientMap";
import type { MapStatus } from "@/components/map/MapView";
import { formatDateRange } from "@/lib/format";
import { WORK_STATUSES } from "@/types";
import { usePublicData } from "./PublicDataProvider";
import { TimingNote, WorkFacts, WorkFilterBar, WorkHeading } from "./ui";

/** MapLibre touches `window` on import, so the map is only ever loaded in the browser (as in ClientMap). */
const ClientPublicMap = dynamic(() => import("./PublicMapView").then((m) => m.PublicMapView), {
  ssr: false,
  loading: () => <MapLoading />,
});

const LEGEND_SWATCH: Record<(typeof WORK_STATUSES)[number], string> = {
  planned: "bg-accent",
  active: "bg-ink",
  delayed: "bg-[#c98a00]",
  cancelled: "bg-sev-needs-data opacity-50",
};

export function PublicMapPage() {
  const { works, workById, filteredWorks } = usePublicData();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [status, setStatus] = useState<MapStatus>({ state: "loading" });

  const requested = params.get("work");
  const selected = requested ? (workById.get(requested) ?? null) : null;

  // Selection lives in the URL so the works list, notices and findings can link straight to a work.
  const select = useCallback(
    (id: string | null) => {
      router.replace(id ? `${pathname}?work=${encodeURIComponent(id)}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const hiddenSelected = selected && !filteredWorks.some((w) => w.id === selected.id);

  return (
    <>
      <PageHeader
        title="Works map"
        subtitle="Where excavation is planned or under way. Select a work on the map or in the list to see its details. Underground utility lines are not shown."
      />
      <WorkFilterBar />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Map" className="h-fit min-w-0 overflow-hidden rounded-3xl border border-line bg-card">
          <div className="relative h-[360px] sm:h-[460px] lg:h-[560px]">
            {status.state === "error" ? (
              <EmptyState icon={TriangleAlert} title="The map could not be shown">
                {status.message} The list of works beside the map still works.
              </EmptyState>
            ) : (
              <ClientPublicMap
                works={works}
                visibleIds={filteredWorks.map((w) => w.id)}
                selectedId={selected?.id ?? null}
                onSelect={select}
                onStatus={setStatus}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-3 text-xs text-ink-2">
            {WORK_STATUSES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-4 rounded-sm ${LEGEND_SWATCH[s]}`} aria-hidden />
                {WORK_STATUS_META[s].label}
              </span>
            ))}
            {status.state === "ready" && status.basemapError && (
              <span className="text-ink-3">Background map tiles unavailable; works are still drawn.</span>
            )}
            <span className="text-ink-3">Locations are from fictional demonstration records.</span>
          </div>
        </section>

        <div className="grid min-w-0 content-start gap-4">
          <Panel title="Selected work" icon={MapPinned}>
            {selected ? (
              <div>
                <WorkHeading work={selected} />
                <TimingNote work={selected} />
                {hiddenSelected && (
                  <p className="mt-2 text-xs text-ink-3">This work is hidden on the map by the current filters.</p>
                )}
                <div className="mt-4">
                  <WorkFacts work={selected} compact />
                </div>
                <button
                  type="button"
                  onClick={() => select(null)}
                  className="mt-4 rounded-full border border-line px-3 py-1.5 text-xs hover:bg-sunken"
                >
                  Clear selection
                </button>
              </div>
            ) : (
              <EmptyState title="No work selected">Select a work on the map or from the list below.</EmptyState>
            )}
          </Panel>

          <Panel title="Works" subtitle={`${filteredWorks.length} shown`}>
            {filteredWorks.length === 0 ? (
              <p className="text-sm text-ink-3">No works match the filters.</p>
            ) : (
              <ul className="grid gap-1">
                {filteredWorks.map((w) => {
                  const on = selected?.id === w.id;
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => select(on ? null : w.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left ${
                          on ? "bg-accent-soft" : "hover:bg-sunken"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{w.name}</span>
                          <span className="block text-xs text-ink-3">
                            {formatDateRange(w.schedule.startDate, w.schedule.endDate)}
                          </span>
                        </span>
                        <WorkStatusPill status={w.status} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
