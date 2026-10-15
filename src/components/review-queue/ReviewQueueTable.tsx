"use client";

import { Inbox } from "lucide-react";
import { ConfidenceBadge, ReviewStatusLabel, SeverityBadge, UtilitySwatch } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { ACTION_LABEL } from "@/components/dashboard/meta";
import { EmptyState } from "@/components/dashboard/Panel";
import { shortClashId } from "@/lib/format";
import type { ClashResult } from "@/types";

interface ReviewQueueTableProps {
  clashes: readonly ClashResult[];
  emptyMessage?: string;
}

/** Conflict queue: dense table on md+, stacked cards on small screens. Selection is shared app-wide. */
export function ReviewQueueTable({ clashes, emptyMessage = "No conflicts match the current filters." }: ReviewQueueTableProps) {
  const { assetById, excavationById, selectedClash, selectClash, reviewStatusOf } = useDashboard();

  if (clashes.length === 0) {
    return (
      <EmptyState icon={Inbox} title="No conflicts">
        {emptyMessage} An empty list is not proof that the ground is clear.
      </EmptyState>
    );
  }

  const rows = clashes.map((c) => ({
    clash: c,
    asset: assetById.get(c.affectedAssetIds[0] ?? ""),
    excavation: excavationById.get(c.excavationId),
    selected: selectedClash?.id === c.id,
    review: reviewStatusOf(c.id),
  }));

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-line md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <caption className="sr-only">Detected conflicts. Select a row to show it on the map and cross-section.</caption>
          <thead className="bg-sunken text-xs text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Conflict ID</th>
              <th scope="col" className="px-3 py-3 font-medium">Utility / Asset</th>
              <th scope="col" className="px-3 py-3 font-medium">Excavation</th>
              <th scope="col" className="px-3 py-3 font-medium">Severity</th>
              <th scope="col" className="px-3 py-3 font-medium">Confidence</th>
              <th scope="col" className="px-3 py-3 font-medium">Recommended action</th>
              <th scope="col" className="px-3 py-3 font-medium">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ clash, asset, excavation, selected, review }) => (
              <tr
                key={clash.id}
                aria-selected={selected}
                onClick={() => selectClash(clash.id)}
                className={`cursor-pointer transition-colors ${selected ? "bg-accent-soft" : "hover:bg-sunken"}`}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectClash(clash.id);
                    }}
                    aria-pressed={selected}
                    className="flex items-center gap-2 rounded font-mono text-xs whitespace-nowrap text-ink"
                  >
                    <span
                      className={`size-4 shrink-0 rounded border ${selected ? "border-accent bg-accent" : "border-line bg-card"}`}
                      aria-hidden
                    />
                    {shortClashId(clash.id)}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium text-ink">{asset?.name ?? clash.affectedAssetIds.join(", ")}</div>
                  {asset && <UtilitySwatch type={asset.type} />}
                </td>
                <td className="px-3 py-3 text-ink-2">{excavation?.name ?? clash.excavationId}</td>
                <td className="px-3 py-3">
                  <SeverityBadge severity={clash.severity} />
                </td>
                <td className="px-3 py-3">
                  <ConfidenceBadge confidence={clash.confidence} />
                </td>
                <td className="px-3 py-3 text-ink-2">{ACTION_LABEL[clash.recommendedAction.action]}</td>
                <td className="px-3 py-3">
                  <ReviewStatusLabel status={review} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-2 md:hidden" aria-label="Detected conflicts">
        {rows.map(({ clash, asset, excavation, selected, review }) => (
          <li key={clash.id}>
            <button
              type="button"
              onClick={() => selectClash(clash.id)}
              aria-pressed={selected}
              className={`w-full rounded-2xl border p-3 text-left ${
                selected ? "border-accent bg-accent-soft" : "border-line bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{shortClashId(clash.id)}</span>
                <SeverityBadge severity={clash.severity} />
              </div>
              <p className="mt-1.5 text-sm font-medium">{asset?.name}</p>
              <p className="text-xs text-ink-2">{excavation?.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <ConfidenceBadge confidence={clash.confidence} />
                <span className="text-xs text-ink-2">{ACTION_LABEL[clash.recommendedAction.action]}</span>
                <ReviewStatusLabel status={review} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
