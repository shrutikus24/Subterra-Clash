/** Display metadata (labels, colours, icons) for domain enums. UI-only; no domain logic. */
import {
  CircleCheck,
  CircleDashed,
  CircleHelp,
  OctagonAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { DataQualityIssue } from "@/lib/reports";
import type {
  ClashReasonCode,
  ConfidenceLevel,
  ConflictSeverity,
  InspectionAction,
  ReviewStatus,
  UtilityType,
  WorkStatus,
} from "@/types";

export const SEVERITY_META: Record<ConflictSeverity, { label: string; color: string; tint: string; icon: LucideIcon }> = {
  critical: { label: "Critical", color: "var(--color-sev-critical)", tint: "#fbeaea", icon: OctagonAlert },
  high: { label: "High", color: "var(--color-sev-high)", tint: "#fdf0ea", icon: TriangleAlert },
  medium: { label: "Medium", color: "var(--color-sev-medium)", tint: "#fef6e4", icon: CircleDashed },
  low: { label: "Low", color: "var(--color-sev-low)", tint: "#e9f6e9", icon: CircleCheck },
  "needs-data": { label: "Needs data", color: "var(--color-sev-needs-data)", tint: "#f0f0ee", icon: CircleHelp },
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const UTILITY_META: Record<UtilityType, { label: string; color: string; dash: number[] | null }> = {
  water: { label: "Water", color: "#2a78d6", dash: null },
  sewer: { label: "Sewer", color: "#904f10", dash: [3, 1.5] },
  electric: { label: "Electricity", color: "#c8b400", dash: null },
  gas: { label: "Gas", color: "#f0620f", dash: [1, 1.2] },
  telecom: { label: "Telecom", color: "#a8329e", dash: [4, 1.5, 1, 1.5] },
};

export const WORK_STATUS_META: Record<WorkStatus, { label: string; className: string }> = {
  planned: { label: "Planned", className: "bg-accent-soft text-accent" },
  active: { label: "Active", className: "bg-ink text-white" },
  delayed: { label: "Delayed", className: "bg-[#fef6e4] text-[#8a5a00]" },
  cancelled: { label: "Cancelled", className: "bg-sunken text-ink-3 line-through" },
};

export const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; dot: string }> = {
  open: { label: "Open", dot: "var(--color-ink-3)" },
  "under-review": { label: "Under review", dot: "var(--color-accent-bright)" },
  inspected: { label: "Inspected", dot: "var(--color-sev-low)" },
};

export const ACTION_LABEL: Record<InspectionAction, string> = {
  "no-action": "No action",
  "verify-records": "Verify records",
  "ground-penetrating-radar": "GPR survey",
  "trial-hole": "Trial hole",
  "owner-standby": "Owner standby",
  "redesign-alignment": "Redesign alignment",
};

export const REASON_LABEL: Record<ClashReasonCode, string> = {
  "horizontal-intersection": "Crosses excavation",
  "within-horizontal-buffer": "Within horizontal buffer",
  "depth-intrusion": "Depth intrusion",
  "insufficient-vertical-clearance": "Insufficient vertical clearance",
  "missing-asset-depth": "Missing asset depth",
  "missing-asset-diameter": "Missing diameter",
  "high-position-uncertainty": "High position uncertainty",
  "low-data-quality": "Low data quality",
  "outdated-survey": "Outdated survey",
  "high-consequence-utility": "High-consequence utility",
  "schedule-overlap": "Schedule overlap",
};

export const DATA_QUALITY_LABEL: Record<DataQualityIssue, string> = {
  "missing-depth": "Missing depth",
  "missing-depth-uncertainty": "Depth uncertainty not recorded",
  "missing-diameter": "Missing diameter",
  "high-horizontal-uncertainty": "High horizontal uncertainty",
  "missing-horizontal-uncertainty": "Position uncertainty not recorded",
  "outdated-survey": "Outdated survey",
  "missing-survey-date": "Missing survey date",
  "low-quality-record": "Low-quality record",
};
