/** Display formatting shared by UI components. Deterministic on server and client (no locale/timezone). */
import type { IsoDate } from "@/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-02" → "2 Nov 2026". */
export function formatDate(iso: IsoDate): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1] ?? ""} ${y}`;
}

export function formatDateRange(start: IsoDate, end: IsoDate): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Metres with up to 2 decimals; unknown values are labelled, never shown as zero. */
export function formatMetres(value: number | undefined, unknown = "Not recorded"): string {
  if (value === undefined) return unknown;
  return `${Number(value.toFixed(2))} m`;
}

export function formatSignedMetres(value: number | undefined, unknown = "Not recorded"): string {
  if (value === undefined) return unknown;
  const rounded = Number(value.toFixed(2));
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded)} m`;
}

export function formatDiameter(diameterM: number | undefined): string {
  if (diameterM === undefined) return "Not recorded";
  return `Ø ${Math.round(diameterM * 1000)} mm`;
}

/** Days since the Unix epoch for an ISO date, in UTC. */
export function isoToDay(iso: IsoDate): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

export function dayToIso(day: number): IsoDate {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** "CLASH:SYN-EXC-01:SYN-AST-S-01" → "EXC-01 × AST-S-01" for compact display. */
export function shortClashId(id: string): string {
  const [, exc, asset] = id.split(":");
  if (!exc || !asset) return id;
  return `${exc.replace(/^SYN-/, "")} × ${asset.replace(/^SYN-/, "")}`;
}
