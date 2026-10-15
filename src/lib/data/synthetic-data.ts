/**
 * SYNTHETIC DEMO DATA. Every record here is fictional and generated for testing and demonstration.
 * It does not describe real utilities, owners, contractors, or works. All IDs are prefixed `SYN-`.
 *
 * Geometry is authored in local metres (x = east, y = north) from a fixed origin and converted to
 * GeoJSON [longitude, latitude] with an equirectangular projection. Over this ~300 m x 280 m area,
 * the conversion error is under 1 cm, so the distances quoted below hold for geodesic checks.
 *
 * Scenario notes assume the clash engine's default safety buffers (see DEFAULT_CLASH_CONFIG):
 * 1.0 m horizontal beyond the corridor edge and 0.3 m vertical below the excavation base.
 * Clash results are deliberately NOT stored here; they are derived by the clash engine.
 *
 * Excavation layout (centreline, local metres):
 *   SYN-EXC-01  y = 0,    x -150 → 150   depth 2.5 m, width 1.2 m  planned    2026-11-02 → 2026-12-18
 *   SYN-EXC-02  x = 100,  y -120 → 80    depth 0.9 m, width 0.6 m  active     2026-10-05 → 2026-11-20
 *   SYN-EXC-03  x = -80,  y 30 → 150     depth 1.5 m, width 1.0 m  delayed    2027-02-01 → 2027-02-26
 *   SYN-EXC-04  y = 120,  x 20 → 140     depth 1.2 m, width 0.8 m  cancelled  2026-11-23 → 2026-12-11
 */
import type { LineString } from "geojson";
import type { ExcavationWork, UtilityAsset } from "@/types";

/** Local-frame origin; keep in sync with MAP_DEFAULT_CENTER in ./config.ts. */
export const SYNTHETIC_ORIGIN: [lng: number, lat: number] = [77.597, 12.9745];

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG = 111_320 * Math.cos((SYNTHETIC_ORIGIN[1] * Math.PI) / 180);

const round7 = (v: number) => Math.round(v * 1e7) / 1e7;

/** Builds a GeoJSON LineString from local [east, north] metre offsets. */
function line(...pointsM: [x: number, y: number][]): LineString {
  const [lng0, lat0] = SYNTHETIC_ORIGIN;
  return {
    type: "LineString",
    coordinates: pointsM.map(([x, y]) => [
      round7(lng0 + x / M_PER_DEG_LNG),
      round7(lat0 + y / M_PER_DEG_LAT),
    ]),
  };
}

export const syntheticExcavations: ExcavationWork[] = [
  {
    id: "SYN-EXC-01",
    name: "Main Street Storm Sewer Renewal",
    geometry: line([-150, 0], [150, 0]),
    plannedDepthM: 2.5,
    widthM: 1.2,
    depthUncertaintyM: 0.15,
    horizontalUncertaintyM: 0.3,
    schedule: { startDate: "2026-11-02", endDate: "2026-12-18" },
    status: "planned",
    contractor: "Synthetic Civil Co. A",
  },
  {
    id: "SYN-EXC-02",
    name: "Station Road Fibre Trench",
    geometry: line([100, -120], [100, 80]),
    plannedDepthM: 0.9,
    widthM: 0.6,
    depthUncertaintyM: 0.1,
    horizontalUncertaintyM: 0.2,
    schedule: { startDate: "2026-10-05", endDate: "2026-11-20" },
    status: "active",
    contractor: "Synthetic Telecom Works B",
  },
  {
    id: "SYN-EXC-03",
    name: "Park Lane Water Service Replacement",
    geometry: line([-80, 30], [-80, 150]),
    plannedDepthM: 1.5,
    widthM: 1.0,
    depthUncertaintyM: 0.1,
    horizontalUncertaintyM: 0.25,
    schedule: { startDate: "2027-02-01", endDate: "2027-02-26" },
    status: "delayed",
    contractor: "Synthetic Civil Co. C",
  },
  {
    id: "SYN-EXC-04",
    name: "Market Square EV Charger Ducts",
    geometry: line([20, 120], [140, 120]),
    plannedDepthM: 1.2,
    widthM: 0.8,
    schedule: { startDate: "2026-11-23", endDate: "2026-12-11" },
    status: "cancelled",
    contractor: "Synthetic Electrical D",
  },
];

export const syntheticAssets: UtilityAsset[] = [
  // --- Water --------------------------------------------------------------
  {
    // Background: parallel to EXC-01, 24.4 m from its corridor edge. Clear.
    id: "SYN-AST-W-01",
    name: "South Avenue Distribution Main",
    type: "water",
    geometry: line([-150, -25], [60, -25]),
    depthM: 1.1,
    depthUncertaintyM: 0.15,
    diameterM: 0.2,
    horizontalUncertaintyM: 0.3,
    source: "SYNTHETIC: Water utility GIS export",
    surveyDate: "2018-04-12",
    owner: "Synthetic Water Authority",
    dataQuality: { confidence: "high", captureMethod: "surveyed" },
  },
  {
    // Scenario 8: crosses EXC-01 at (-106.7, 0) and EXC-03 at (-80, 40); top 1.3 m is above both
    // excavation bases. EXC-01 (Nov–Dec 2026) and EXC-03 (Feb 2027) do not overlap in time.
    id: "SYN-AST-W-02",
    name: "Park Diagonal Trunk Main",
    type: "water",
    geometry: line([-120, -20], [-40, 100]),
    depthM: 1.3,
    depthUncertaintyM: 0.2,
    diameterM: 0.45,
    horizontalUncertaintyM: 0.3,
    source: "SYNTHETIC: Water utility GIS export",
    surveyDate: "2015-09-30",
    owner: "Synthetic Water Authority",
    dataQuality: { confidence: "high", captureMethod: "surveyed" },
  },
  {
    // Scenario 6: contradictory depth records. Crosses EXC-03 at (-80, 130). The stored 1.4 m ± 0.9 m
    // spans 0.5–2.3 m, which straddles the 1.5 m excavation base.
    id: "SYN-AST-W-03",
    name: "Park Lane Cast Iron Main",
    type: "water",
    geometry: line([-120, 130], [-40, 130]),
    depthM: 1.4,
    depthUncertaintyM: 0.9,
    diameterM: 0.15,
    horizontalUncertaintyM: 0.5,
    source: "SYNTHETIC: Reconciled from 1987 as-built drawing and 2019 trial-hole log",
    surveyDate: "1987-07-01",
    owner: "Synthetic Water Authority",
    dataQuality: {
      confidence: "low",
      captureMethod: "as-built",
      notes:
        "Contradictory records: as-built drawing gives 2.3 m, 2019 trial-hole log gives 0.5 m. Midpoint stored with ±0.9 m.",
    },
  },

  // --- Sewer --------------------------------------------------------------
  {
    // Scenario 1: direct crossing. Perpendicular to EXC-01 at (-30, 0); top at 2.0 m is 0.5 m above
    // the 2.5 m excavation base. Well-surveyed, so the clash is certain.
    id: "SYN-AST-S-01",
    name: "Hill Street Foul Sewer",
    type: "sewer",
    geometry: line([-30, -60], [-30, 60]),
    depthM: 2.0,
    depthUncertaintyM: 0.1,
    diameterM: 0.45,
    horizontalUncertaintyM: 0.1,
    source: "SYNTHETIC: CCTV sewer survey",
    surveyDate: "2022-03-08",
    owner: "Synthetic Water Authority",
    dataQuality: { confidence: "high", captureMethod: "surveyed" },
  },
  {
    // Scenario 3: likely safe separation. Crosses EXC-02 in plan at (100, 50), but its top at 2.2 m
    // is 1.3 m below the 0.9 m base. That exceeds the 0.3 m buffer plus ±0.1 m asset and ±0.1 m
    // excavation depth tolerance (0.5 m), assuming the surveyed depth is accurate.
    id: "SYN-AST-S-02",
    name: "Station Road Trunk Sewer",
    type: "sewer",
    geometry: line([60, 50], [160, 50]),
    depthM: 2.2,
    depthUncertaintyM: 0.1,
    diameterM: 0.6,
    horizontalUncertaintyM: 0.1,
    source: "SYNTHETIC: CCTV sewer survey",
    surveyDate: "2023-06-21",
    owner: "Synthetic Water Authority",
    dataQuality: { confidence: "high", captureMethod: "surveyed" },
  },

  // --- Electric -----------------------------------------------------------
  {
    // Scenario 7: physical conflict with overlapping schedules. Crosses EXC-01 at (105, 0) and
    // EXC-02 at (100, -6). Top at 0.7 m is above both bases (2.5 m and 0.9 m). EXC-01 and EXC-02
    // both run between 2026-11-02 and 2026-11-20.
    id: "SYN-AST-E-01",
    name: "Station Road 11 kV Cable",
    type: "electric",
    geometry: line([80, -30], [130, 30]),
    depthM: 0.7,
    depthUncertaintyM: 0.1,
    diameterM: 0.15,
    horizontalUncertaintyM: 0.2,
    source: "SYNTHETIC: Electricity network GNSS survey",
    surveyDate: "2021-11-15",
    owner: "Synthetic Power Networks",
    dataQuality: { confidence: "high", captureMethod: "surveyed" },
  },
  {
    // Scenario 9: crosses cancelled EXC-04 at (80, 120). Top at 0.8 m is above the 1.2 m base, so
    // this would be a clash if the work were not cancelled.
    id: "SYN-AST-E-02",
    name: "Market Square LV Feeder",
    type: "electric",
    geometry: line([80, 90], [80, 160]),
    depthM: 0.8,
    depthUncertaintyM: 0.15,
    diameterM: 0.1,
    horizontalUncertaintyM: 0.3,
    source: "SYNTHETIC: Electricity network GIS export",
    surveyDate: "2016-02-03",
    owner: "Synthetic Power Networks",
    dataQuality: { confidence: "medium", captureMethod: "as-built" },
  },

  // --- Gas ----------------------------------------------------------------
  {
    // Background: 59.5 m west of EXC-03's corridor edge. Clear.
    id: "SYN-AST-G-01",
    name: "West Boulevard MP Gas Main",
    type: "gas",
    geometry: line([-140, 20], [-140, 160]),
    depthM: 1.0,
    depthUncertaintyM: 0.1,
    diameterM: 0.18,
    horizontalUncertaintyM: 0.2,
    source: "SYNTHETIC: Gas network GNSS survey",
    surveyDate: "2020-08-19",
    owner: "Synthetic Gas Distribution",
    dataQuality: { confidence: "high", captureMethod: "surveyed" },
  },
  {
    // Scenario 4: missing asset depth. Crosses EXC-03 at (-80, 90). No depth was recorded, so
    // depthM and depthUncertaintyM are left undefined.
    id: "SYN-AST-G-02",
    name: "Park Lane Gas Service",
    type: "gas",
    geometry: line([-120, 90], [-40, 90]),
    diameterM: 0.063,
    horizontalUncertaintyM: 0.5,
    source: "SYNTHETIC: Digitised from paper service record",
    surveyDate: "2004-05-10",
    owner: "Synthetic Gas Distribution",
    dataQuality: { confidence: "medium", captureMethod: "digitised", notes: "Depth not recorded." },
  },
  {
    // Scenario 10: uncertainty prevents a confident conclusion. Crosses EXC-02 at (100, -60).
    // Nominal top at 1.3 m gives 0.4 m clearance below the 0.9 m base, which passes the 0.3 m buffer.
    // But ±0.5 m allows anything from 0.8 m (intrusion) to 1.8 m (clear).
    id: "SYN-AST-G-03",
    name: "Station Road LP Gas Main",
    type: "gas",
    geometry: line([60, -60], [140, -60]),
    depthM: 1.3,
    depthUncertaintyM: 0.5,
    diameterM: 0.125,
    horizontalUncertaintyM: 0.3,
    source: "SYNTHETIC: Gas network as-built drawing",
    surveyDate: "1999-10-22",
    owner: "Synthetic Gas Distribution",
    dataQuality: { confidence: "medium", captureMethod: "as-built" },
  },

  // --- Telecom ------------------------------------------------------------
  {
    // Scenario 2: near-conflict within the horizontal buffer. Parallel to EXC-01, centreline at
    // y = 1.3, so 0.7 m from the corridor edge (y = 0.6). That is inside the 1.0 m buffer; it does not
    // cross. Position is well known (±0.1 m).
    id: "SYN-AST-T-01",
    name: "Main Street Fibre Duct",
    type: "telecom",
    geometry: line([-140, 1.3], [-60, 1.3]),
    depthM: 0.6,
    depthUncertaintyM: 0.1,
    diameterM: 0.1,
    horizontalUncertaintyM: 0.1,
    source: "SYNTHETIC: Telecom operator GNSS survey",
    surveyDate: "2024-01-17",
    owner: "Synthetic Fibre Networks",
    dataQuality: { confidence: "high", captureMethod: "surveyed" },
  },
  {
    // Scenario 5: high horizontal uncertainty. Parallel to EXC-02 at x = 103.8, 3.5 m from the corridor
    // edge (x = 100.3), so nominally outside the 1.0 m buffer. But ±3.0 m asset and ±0.2 m excavation
    // tolerance (4.2 m reach with the buffer) means it could lie within it.
    id: "SYN-AST-T-02",
    name: "Station Road Copper Cable Route",
    type: "telecom",
    geometry: line([103.8, -100], [103.8, -20]),
    depthM: 0.6,
    depthUncertaintyM: 0.2,
    diameterM: 0.08,
    horizontalUncertaintyM: 3.0,
    source: "SYNTHETIC: Hand-drawn route sketch",
    owner: "Synthetic Fibre Networks",
    dataQuality: {
      confidence: "low",
      captureMethod: "estimated",
      notes: "Route sketched from memory; no survey date.",
    },
  },
  {
    // Background: 40 m north of EXC-04 and 41 m from EXC-03's northern end. Clear.
    id: "SYN-AST-T-03",
    name: "North Road Fibre Spine",
    type: "telecom",
    geometry: line([-40, 160], [140, 160]),
    depthM: 0.7,
    depthUncertaintyM: 0.1,
    diameterM: 0.1,
    horizontalUncertaintyM: 0.2,
    source: "SYNTHETIC: Telecom operator GNSS survey",
    surveyDate: "2023-09-05",
    owner: "Synthetic Fibre Networks",
    dataQuality: { confidence: "high", captureMethod: "surveyed" },
  },
];

/** Records that exercise each documented scenario. Expected outcomes are for engine tests, not data. */
export const SYNTHETIC_SCENARIOS = {
  directCrossing: { assetIds: ["SYN-AST-S-01"], excavationIds: ["SYN-EXC-01"] },
  nearConflictWithinBuffer: { assetIds: ["SYN-AST-T-01"], excavationIds: ["SYN-EXC-01"] },
  likelySafeSeparation: { assetIds: ["SYN-AST-S-02"], excavationIds: ["SYN-EXC-02"] },
  missingAssetDepth: { assetIds: ["SYN-AST-G-02"], excavationIds: ["SYN-EXC-03"] },
  highHorizontalUncertainty: { assetIds: ["SYN-AST-T-02"], excavationIds: ["SYN-EXC-02"] },
  contradictoryDepthRecords: { assetIds: ["SYN-AST-W-03"], excavationIds: ["SYN-EXC-03"] },
  conflictWithOverlappingSchedules: {
    assetIds: ["SYN-AST-E-01"],
    excavationIds: ["SYN-EXC-01", "SYN-EXC-02"],
  },
  conflictWithoutScheduleOverlap: {
    assetIds: ["SYN-AST-W-02"],
    excavationIds: ["SYN-EXC-01", "SYN-EXC-03"],
  },
  cancelledExcavation: { assetIds: ["SYN-AST-E-02"], excavationIds: ["SYN-EXC-04"] },
  uncertaintyPreventsConclusion: { assetIds: ["SYN-AST-G-03"], excavationIds: ["SYN-EXC-02"] },
} as const satisfies Record<string, { assetIds: readonly string[]; excavationIds: readonly string[] }>;

export type SyntheticScenario = keyof typeof SYNTHETIC_SCENARIOS;
