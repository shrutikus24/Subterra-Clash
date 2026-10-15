"use client";

import { useId } from "react";
import { UTILITY_META } from "@/components/dashboard/meta";
import { formatDiameter, formatMetres, formatSignedMetres } from "@/lib/format";
import type { ClashResult, ExcavationWork, UtilityAsset } from "@/types";

interface CrossSectionProps {
  clash: ClashResult;
  asset: UtilityAsset;
  excavation: ExcavationWork;
  /** Vertical buffer the engine applied (metres). */
  verticalBufferM: number;
}

const W = 640;
const H = 330;
const LEFT = 64;
const TOP = 44;
const BOTTOM = 30;
const TRENCH_X = 200;
const TRENCH_W = 120;

const niceStep = (max: number) => (max <= 2 ? 0.25 : max <= 4 ? 0.5 : 1);

/**
 * Schematic section perpendicular to the excavation. Depth is to scale; horizontal placement is not.
 * Draws only recorded values and engine outputs — a missing depth is shown as unknown, never estimated.
 */
export function CrossSection({ clash, asset, excavation, verticalBufferM }: CrossSectionProps) {
  const titleId = useId();
  const descId = useId();

  const D = excavation.plannedDepthM;
  const eu = excavation.depthUncertaintyM;
  const T = asset.depthM;
  const au = asset.depthUncertaintyM;
  const dia = asset.diameterM;

  const deepest = Math.max(D + (eu ?? 0) + verticalBufferM, T !== undefined ? T + (au ?? 0) + (dia ?? 0) : D, 1);
  const step = niceStep(deepest * 1.2);
  const maxDepth = Math.ceil((deepest * 1.2) / step) * step;
  const pxPerM = (H - TOP - BOTTOM) / maxDepth;
  const y = (depth: number) => TOP + depth * pxPerM;

  const crossing = clash.reasonCodes.includes("horizontal-intersection");
  const cx = crossing ? TRENCH_X + TRENCH_W / 2 : TRENCH_X + TRENCH_W + 70;
  const r = dia !== undefined ? Math.max(4, (dia / 2) * pxPerM) : 7;
  const labelX = crossing ? TRENCH_X + TRENCH_W + 16 : cx + r + 14;
  const dimX = TRENCH_X - 18;
  const color = UTILITY_META[asset.type].color;
  const clearance = clash.verticalClearanceM;
  const ticks = Array.from({ length: Math.round(maxDepth / step) + 1 }, (_, i) => i * step);

  const description = [
    `${excavation.name}: planned dig depth ${formatMetres(D)}, corridor width ${formatMetres(excavation.widthM)}.`,
    T === undefined
      ? `${asset.name}: depth not recorded.`
      : `${asset.name}: top at ${formatMetres(T)}${au !== undefined ? ` ± ${formatMetres(au)}` : ""}, ${formatDiameter(dia)}.`,
    clearance !== undefined ? `Nominal vertical clearance ${formatSignedMetres(clearance)}.` : "",
    crossing ? "The asset crosses the corridor." : `The asset is ${formatMetres(clash.horizontalDistanceM)} from the corridor edge.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      fontFamily="inherit"
    >
      <title id={titleId}>Schematic cross-section</title>
      <desc id={descId}>{description}</desc>
      <defs>
        <pattern id={`${titleId}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#ec835a" strokeWidth="1.5" opacity="0.5" />
        </pattern>
      </defs>

      {/* Soil and ground surface */}
      <rect x={LEFT} y={y(0)} width={W - LEFT - 8} height={H - BOTTOM - y(0)} fill="#f3f0e9" />
      <line x1={LEFT} x2={W - 8} y1={y(0)} y2={y(0)} stroke="#1a1a19" strokeWidth="1.5" />
      <text x={W - 10} y={y(0) - 8} textAnchor="end" fontSize="11" fill="#55554f">
        Ground surface
      </text>

      {/* Depth axis */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={LEFT - 4} x2={LEFT} y1={y(t)} y2={y(t)} stroke="#8a8a85" />
          <line x1={LEFT} x2={W - 8} y1={y(t)} y2={y(t)} stroke="#1a1a19" opacity={t === 0 ? 0 : 0.06} />
          <text x={LEFT - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#6b6b65">
            {t} m
          </text>
        </g>
      ))}
      <text x={14} y={TOP + (H - TOP - BOTTOM) / 2} fontSize="10.5" fill="#6b6b65" transform={`rotate(-90 14 ${TOP + (H - TOP - BOTTOM) / 2})`} textAnchor="middle">
        Depth below ground
      </text>

      {/* Vertical safety buffer below trench base */}
      <rect x={TRENCH_X} y={y(D)} width={TRENCH_W} height={verticalBufferM * pxPerM} fill={`url(#${titleId}-hatch)`} />

      {/* Trench */}
      <rect x={TRENCH_X} y={y(0)} width={TRENCH_W} height={D * pxPerM} fill="#ffffff" stroke="#1a1a19" strokeWidth="1.5" />
      <text x={TRENCH_X + TRENCH_W / 2} y={y(0) - 22} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1a1a19">
        {excavation.name}
      </text>
      <text x={TRENCH_X + TRENCH_W / 2} y={y(0) - 8} textAnchor="middle" fontSize="10.5" fill="#55554f">
        width {formatMetres(excavation.widthM)} (not to scale)
      </text>
      <text x={TRENCH_X + TRENCH_W / 2} y={y(0) + 16} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#1a1a19">
        dig {formatMetres(D)}
      </text>
      <text x={TRENCH_X + TRENCH_W / 2} y={y(0) + 29} textAnchor="middle" fontSize="10" fill="#6b6b65">
        {eu !== undefined ? `± ${formatMetres(eu)} tolerance` : "tolerance not recorded"}
      </text>
      {eu !== undefined &&
        [D - eu, D + eu].map((d) => (
          <line key={d} x1={TRENCH_X} x2={TRENCH_X + TRENCH_W} y1={y(d)} y2={y(d)} stroke="#1a1a19" strokeDasharray="4 3" opacity="0.55" />
        ))}
      <text x={TRENCH_X + TRENCH_W / 2} y={y(D + verticalBufferM) + 13} textAnchor="middle" fontSize="10" fill="#9a4a24">
        {formatMetres(verticalBufferM)} vertical buffer
      </text>

      {/* Horizontal offset (schematic) */}
      {!crossing && (
        <g>
          <line x1={TRENCH_X + TRENCH_W} x2={cx - r - 2} y1={y(0) + 14} y2={y(0) + 14} stroke="#0e7490" strokeWidth="1.2" />
          <line x1={TRENCH_X + TRENCH_W} x2={TRENCH_X + TRENCH_W} y1={y(0) + 8} y2={y(0) + 20} stroke="#0e7490" />
          <line x1={cx - r - 2} x2={cx - r - 2} y1={y(0) + 8} y2={y(0) + 20} stroke="#0e7490" />
          <text x={(TRENCH_X + TRENCH_W + cx) / 2} y={y(0) + 32} textAnchor="middle" fontSize="10.5" fill="#0e7490">
            {formatMetres(clash.horizontalDistanceM)} to edge
          </text>
        </g>
      )}

      {/* Asset */}
      {T === undefined ? (
        <g>
          <rect x={cx - 16} y={y(0) + 40} width={32} height={H - BOTTOM - y(0) - 44} fill="none" stroke={color} strokeDasharray="5 4" rx="6" />
          <text x={cx} y={y(maxDepth / 2) + 8} textAnchor="middle" fontSize="26" fontWeight="600" fill="#8a8a85">
            ?
          </text>
          <text x={crossing ? labelX : cx + 26} y={y(maxDepth / 2) - 4} fontSize="11" fontWeight="600" fill="#1a1a19">
            {asset.name}
          </text>
          <text x={crossing ? labelX : cx + 26} y={y(maxDepth / 2) + 11} fontSize="10.5" fill="#55554f">
            Depth not recorded — position unknown
          </text>
        </g>
      ) : (
        <g>
          {au !== undefined && (
            <g>
              <rect x={cx - r - 6} y={y(Math.max(0, T - au))} width={2 * r + 12} height={(Math.min(T, au) + au) * pxPerM} fill={color} opacity="0.12" rx="4" />
              {[Math.max(0, T - au), T + au].map((d) => (
                <line key={d} x1={cx - r - 8} x2={cx + r + 8} y1={y(d)} y2={y(d)} stroke={color} strokeWidth="1.2" />
              ))}
            </g>
          )}
          <circle
            cx={cx}
            cy={y(T) + r}
            r={r}
            fill={color}
            fillOpacity={dia !== undefined ? 0.85 : 0.15}
            stroke="#1a1a19"
            strokeWidth="1"
            strokeDasharray={dia !== undefined ? undefined : "3 2"}
          />
          {crossing && (
            <line x1={cx + r + 2} x2={labelX - 4} y1={y(T) + r} y2={y(T) + 4} stroke="#8a8a85" strokeWidth="1" />
          )}
          <text x={labelX} y={y(T) - 2} fontSize="11" fontWeight="600" fill="#1a1a19">
            {asset.name}
          </text>
          <text x={labelX} y={y(T) + 12} fontSize="10.5" fill="#55554f">
            top {formatMetres(T)}
            {au !== undefined ? ` ± ${formatMetres(au)}` : " (uncertainty not recorded)"} · {formatDiameter(dia)}
          </text>
        </g>
      )}

      {/* Vertical clearance from the engine */}
      {clearance !== undefined && T !== undefined && (
        <g>
          {/* Guides from the dimension line to the trench base and asset top */}
          <line x1={dimX - 6} x2={TRENCH_X} y1={y(D)} y2={y(D)} stroke="#8a8a85" strokeDasharray="2 3" />
          <line x1={dimX - 6} x2={cx - r} y1={y(T)} y2={y(T)} stroke="#8a8a85" strokeDasharray="2 3" />
          <line x1={dimX} x2={dimX} y1={y(D)} y2={y(T)} stroke={clearance < 0 ? "#d03b3b" : "#0e7490"} strokeWidth="1.5" />
          {[D, T].map((d) => (
            <line key={d} x1={dimX - 6} x2={dimX + 6} y1={y(d)} y2={y(d)} stroke={clearance < 0 ? "#d03b3b" : "#0e7490"} strokeWidth="1.5" />
          ))}
          <text x={dimX - 10} y={(y(D) + y(T)) / 2 - 2} textAnchor="end" fontSize="11" fontWeight="600" fill="#1a1a19">
            {formatSignedMetres(clearance)}
          </text>
          <text x={dimX - 10} y={(y(D) + y(T)) / 2 + 11} textAnchor="end" fontSize="10" fill="#55554f">
            {clearance < 0 ? "dig below top" : "clearance"}
          </text>
        </g>
      )}
    </svg>
  );
}
