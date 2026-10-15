"use client";

import { FileText, FileWarning } from "lucide-react";
import Link from "next/link";
import { SeverityBadge, UtilitySwatch } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { ACTION_LABEL, DATA_QUALITY_LABEL } from "@/components/dashboard/meta";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState, Panel } from "@/components/dashboard/Panel";
import { formatDate } from "@/lib/format";
import { SEVERITY_PRIORITY } from "@/lib/reports";
import { INSPECTION_ACTIONS, UTILITY_TYPES } from "@/types";

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-4">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");

export function ReportsView() {
  const { dataset, summary, dataQuality, assetById, analysisDate } = useDashboard();
  const actions = INSPECTION_ACTIONS.filter((a) => summary.byAction[a] > 0);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Summary of clash-engine results for the synthetic dataset, analysed ${formatDate(analysisDate)}.`}
        actions={
          <Link
            href="/reports/inspection"
            className="flex h-11 items-center gap-2 rounded-full border border-line bg-card px-5 text-sm font-medium hover:bg-sunken"
          >
            <FileText className="size-4" aria-hidden /> Inspection report (PDF)
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Potential conflicts" value={summary.totalClashes} />
        <Tile label="Critical & high" value={summary.criticalOrHigh} />
        <Tile label="Need more data" value={summary.needsData} />
        <Tile label="Assets affected" value={summary.affectedAssets} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="By severity" as="h2">
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">Count</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SEVERITY_PRIORITY.map((s) => (
                <tr key={s}>
                  <td className="py-2">
                    <SeverityBadge severity={s} />
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{summary.bySeverity[s]}</td>
                  <td className="py-2 text-right text-ink-3 tabular-nums">{pct(summary.bySeverity[s], summary.totalClashes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="By utility type">
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th scope="col">Utility type</th>
                <th scope="col">Conflicts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {UTILITY_TYPES.map((t) => (
                <tr key={t}>
                  <td className="py-2.5">
                    <UtilitySwatch type={t} />
                  </td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">{summary.byUtilityType[t]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Recommended actions">
          {actions.length === 0 ? (
            <EmptyState title="No actions" />
          ) : (
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Conflicts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {actions.map((a) => (
                  <tr key={a}>
                    <td className="py-2.5 text-ink-2">{ACTION_LABEL[a]}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{summary.byAction[a]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <section id="data-quality" className="mt-4 scroll-mt-6">
        <Panel
          title="Data-quality issues"
          subtitle={`${dataQuality.assets.length} of ${dataset.assets.length} asset records · these gaps drive the “needs data” results`}
          icon={FileWarning}
        >
          {dataQuality.assets.length === 0 ? (
            <EmptyState title="No gaps in recorded fields" />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-sunken text-xs text-ink-3">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Asset</th>
                    <th scope="col" className="px-3 py-3 font-medium">Type</th>
                    <th scope="col" className="px-3 py-3 font-medium">Source</th>
                    <th scope="col" className="px-3 py-3 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dataQuality.assets.map(({ assetId, issues }) => {
                    const asset = assetById.get(assetId);
                    return (
                      <tr key={assetId}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{asset?.name ?? assetId}</div>
                          <div className="font-mono text-[11px] text-ink-3">{assetId}</div>
                        </td>
                        <td className="px-3 py-3">{asset && <UtilitySwatch type={asset.type} />}</td>
                        <td className="px-3 py-3 text-xs text-ink-2">{asset?.source}</td>
                        <td className="px-3 py-3">
                          <ul className="flex flex-wrap gap-1">
                            {issues.map((i) => (
                              <li key={i} className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">
                                {DATA_QUALITY_LABEL[i]}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </section>
    </>
  );
}
