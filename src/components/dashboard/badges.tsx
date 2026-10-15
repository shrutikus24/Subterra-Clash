import type { ConfidenceLevel, ConflictSeverity, ReviewStatus, UtilityType, WorkStatus } from "@/types";
import { CONFIDENCE_LABEL, REVIEW_STATUS_META, SEVERITY_META, UTILITY_META, WORK_STATUS_META } from "./meta";

/** Severity pill: icon + label carry meaning; colour is reinforcement only. */
export function SeverityBadge({ severity, size = "sm" }: { severity: ConflictSeverity; size?: "sm" | "md" }) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap text-ink ${
        size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
      style={{ backgroundColor: meta.tint }}
    >
      <Icon className={size === "md" ? "size-4" : "size-3.5"} style={{ color: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const filled = confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-2">
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-2.5 w-1 rounded-full ${i < filled ? "bg-ink-2" : "bg-line"}`} />
        ))}
      </span>
      {CONFIDENCE_LABEL[confidence]}
      <span className="sr-only"> confidence</span>
    </span>
  );
}

export function UtilitySwatch({ type, withLabel = true }: { type: UtilityType; withLabel?: boolean }) {
  const meta = UTILITY_META[type];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-2">
      <svg width="18" height="6" viewBox="0 0 18 6" aria-hidden>
        <line
          x1="1"
          y1="3"
          x2="17"
          y2="3"
          stroke={meta.color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={meta.dash ? meta.dash.map((d) => d * 3).join(" ") : undefined}
        />
      </svg>
      {withLabel && meta.label}
    </span>
  );
}

export function WorkStatusPill({ status }: { status: WorkStatus }) {
  const meta = WORK_STATUS_META[status];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export function ReviewStatusLabel({ status }: { status: ReviewStatus }) {
  const meta = REVIEW_STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-2">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.dot }} aria-hidden />
      {meta.label}
    </span>
  );
}
