"use client";

import { ChevronDown, FileSearch } from "lucide-react";
import { useId, useState } from "react";
import { CrossSectionPanel } from "@/components/cross-section/CrossSectionPanel";
import { SeverityBadge } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { SelectedFeatureDetails } from "@/components/map/SelectedFeatureDetails";
import { shortClashId } from "@/lib/format";
import { ConflictDetail } from "./ConflictDetail";

/**
 * Collapsible evidence area for the mapping workspace. Reuses the existing detail, cross-section and
 * record panels, so the same engine evidence appears here as on the Conflicts page.
 */
export function EvidencePanel({ className = "" }: { className?: string }) {
  const { selectedClash, excavationById } = useDashboard();
  const [open, setOpen] = useState(true);
  const bodyId = useId();

  return (
    <section className={className} aria-label="Conflict evidence and engineering decision">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 rounded-3xl border border-line bg-card px-5 py-3.5 text-left shadow-[0_1px_2px_rgb(0_0_0/0.03)] hover:bg-sunken"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-ink-2" aria-hidden>
          <FileSearch className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-tight">Conflict evidence &amp; engineering decision</span>
          <span className="block truncate text-xs text-ink-3">
            {selectedClash
              ? `${shortClashId(selectedClash.id)} · ${excavationById.get(selectedClash.excavationId)?.name ?? ""} · human review required`
              : "Select a conflict to see its evidence"}
          </span>
        </span>
        {selectedClash && <SeverityBadge severity={selectedClash.severity} />}
        <ChevronDown className={`size-5 shrink-0 text-ink-2 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div id={bodyId} className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <ConflictDetail className="xl:col-span-5" />
          <div className="grid content-start gap-4 xl:col-span-7">
            <CrossSectionPanel />
            <div className="rounded-3xl border border-line bg-card p-5">
              <h3 className="mb-3 text-[15px] font-semibold tracking-tight">Recorded measurements</h3>
              <SelectedFeatureDetails />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
