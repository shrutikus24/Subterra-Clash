"use client";

import { ArrowRight, Construction, Database, FileWarning, Layers3, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { shortClashId } from "@/lib/format";
import { SEVERITY_PRIORITY } from "@/lib/reports";
import { SeverityBadge, UtilitySwatch } from "./badges";
import { useDashboard } from "./DashboardProvider";
import { ACTION_LABEL, DATA_QUALITY_LABEL, SEVERITY_META } from "./meta";
import { EmptyState, Panel } from "./Panel";

function StatCard({
  label,
  value,
  icon: Icon,
  note,
  accent = false,
  href,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  note: string;
  accent?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex min-h-36 flex-col justify-between rounded-3xl p-4 transition-shadow hover:shadow-md ${
        accent ? "bg-ink text-white" : "border border-line bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-sm ${accent ? "text-white/80" : "text-ink-2"}`}>{label}</span>
        <span
          className={`grid size-8 place-items-center rounded-full ${accent ? "bg-white/15" : "border border-line"}`}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div>
        <p className="text-4xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className={`mt-1 text-xs ${accent ? "text-white/75" : "text-ink-3"}`}>{note}</p>
      </div>
    </Link>
  );
}

/** Four headline counts, each with a supporting indicator. All numbers come from engine output. */
export function SummaryCards({ className = "" }: { className?: string }) {
  const { summary, dataQuality } = useDashboard();
  return (
    <div className={`grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 ${className}`}>
      <StatCard
        label="Utility assets"
        value={summary.totalAssets}
        icon={Layers3}
        note={`${dataQuality.assets.length} with data-quality issues`}
        href="/map"
      />
      <StatCard
        label="Excavation projects"
        value={summary.totalExcavations}
        icon={Construction}
        note={`${summary.activeExcavations} active · ${summary.cancelledExcavations} cancelled`}
        href="/schedule"
      />
      <StatCard
        label="Potential conflicts"
        value={summary.totalClashes}
        icon={TriangleAlert}
        note={`${summary.needsData} need more data · ${summary.affectedAssets} assets affected`}
        href="/conflicts"
      />
      <StatCard
        label="Critical & high priority"
        value={summary.criticalOrHigh}
        icon={ShieldAlert}
        note={`${summary.clashesWithScheduleOverlap} with schedule overlaps`}
        accent
        href="/conflicts"
      />
    </div>
  );
}

/** Horizontal bars, one per severity; each bar filters the conflict view. */
export function SeverityDistribution({ className = "" }: { className?: string }) {
  const { summary, resetFilters, setFilters } = useDashboard();
  const router = useRouter();
  const max = Math.max(1, ...SEVERITY_PRIORITY.map((s) => summary.bySeverity[s]));

  return (
    <Panel
      title="Conflict Severity"
      subtitle={`${summary.totalClashes} results from the clash engine · select a bar to filter`}
      className={className}
    >
      {summary.totalClashes === 0 ? (
        <EmptyState title="No conflicts detected">Not proof that the ground is clear.</EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {SEVERITY_PRIORITY.map((sev) => {
            const meta = SEVERITY_META[sev];
            const Icon = meta.icon;
            const n = summary.bySeverity[sev];
            const share = Math.round((n / summary.totalClashes) * 100);
            return (
              <li key={sev}>
                <button
                  type="button"
                  onClick={() => {
                    resetFilters();
                    setFilters({ severities: [sev] });
                    router.push("/conflicts");
                  }}
                  title={`${meta.label}: ${n} of ${summary.totalClashes} (${share}%)`}
                  className="group grid w-full grid-cols-[7.5rem_1fr_2rem] items-center gap-3 rounded-xl px-1 py-1 text-left hover:bg-sunken"
                >
                  <span className="flex items-center gap-1.5 text-sm text-ink-2">
                    <Icon className="size-4" style={{ color: meta.color }} aria-hidden />
                    {meta.label}
                  </span>
                  <span className="h-3 rounded-full bg-sunken" aria-hidden>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: n ? `${Math.max(4, (n / max) * 100)}%` : 0, backgroundColor: meta.color }}
                    />
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums">{n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** Highest-priority detected conflicts; selecting one syncs map and other panels. */
export function ConflictActivity({ className = "", limit = 5 }: { className?: string; limit?: number }) {
  const { rankedClashes, assetById, excavationById, selectClash, selectedClash } = useDashboard();
  const top = rankedClashes.slice(0, limit);
  return (
    <Panel
      title="Priority Conflicts"
      subtitle="Highest-priority results, ranked by severity then confidence"
      className={className}
      actions={
        <Link href="/conflicts" className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs hover:bg-sunken">
          All <ArrowRight className="size-3" aria-hidden />
        </Link>
      }
    >
      {top.length === 0 ? (
        <EmptyState title="No conflicts detected">Not proof that the ground is clear.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {top.map((c) => {
            const asset = assetById.get(c.affectedAssetIds[0] ?? "");
            const selected = selectedClash?.id === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => selectClash(c.id)}
                  aria-pressed={selected}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl px-2 py-2.5 text-left ${
                    selected ? "bg-accent-soft" : "hover:bg-sunken"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{asset?.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {excavationById.get(c.excavationId)?.name} · {ACTION_LABEL[c.recommendedAction.action]}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      {asset && <UtilitySwatch type={asset.type} />}
                      <span className="font-mono text-[11px] text-ink-3">{shortClashId(c.id)}</span>
                    </span>
                  </span>
                  <SeverityBadge severity={c.severity} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function DataQualityCard({ className = "" }: { className?: string }) {
  const { dataQuality, summary, dataset } = useDashboard();
  const rows = (Object.entries(dataQuality.counts) as [keyof typeof DATA_QUALITY_LABEL, number][]).filter(
    ([, n]) => n > 0,
  );
  return (
    <Panel
      title="Data Quality"
      subtitle={`${dataQuality.assets.length} of ${dataset.assets.length} asset records have gaps`}
      icon={FileWarning}
      className={className}
      actions={
        <Link href="/reports#data-quality" className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-sunken">
          Report
        </Link>
      }
    >
      <div className="mb-3 flex items-center gap-3 rounded-2xl bg-sunken p-3">
        <Database className="size-4 text-ink-3" aria-hidden />
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{summary.needsData}</span>{" "}
          <span className="text-ink-2">conflicts cannot be resolved without more data</span>
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">No gaps found in the recorded fields.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {rows.map(([issue, n]) => (
            <li key={issue} className="flex items-center justify-between py-2">
              <span className="text-ink-2">{DATA_QUALITY_LABEL[issue]}</span>
              <span className="font-semibold tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
