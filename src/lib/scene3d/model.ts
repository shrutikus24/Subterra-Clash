/**
 * Framework-free model for the 3D underground view. Converts the shared dataset and clash-engine
 * results into metric scene geometry; the three.js renderer only draws what this module returns.
 *
 * Scene axes (three.js, Y-up): x = east (m), y = up (m, negative below ground), z = south (m).
 * Positions use the clash engine's own local tangent-plane projection, so 3D distances match the
 * engine's horizontal measurements. Degrees are never used as metres.
 */
import type { Position } from "geojson";
import { createLocalProjection } from "@/lib/clash-engine/geometry";
import { rankClashes } from "@/lib/reports";
import type {
  ClashResult,
  ConflictSeverity,
  ExcavationWork,
  ProjectDataset,
  UtilityAsset,
  UtilityType,
  WorkStatus,
} from "@/types";

export interface ScenePoint {
  /** Metres east of the scene origin. */
  x: number;
  /** Metres south of the scene origin (three.js convention: north is −z). */
  z: number;
}

/** Vertical placement of a utility; only recorded values are used. */
export type UtilityDepthModel =
  /** Depth and diameter known: centreline sits at top depth + radius. */
  | { kind: "known"; topDepthM: number; diameterM: number; centreDepthM: number }
  /** Depth known, diameter unknown: drawn as a line at the recorded top depth, no assumed size. */
  | { kind: "diameter-unknown"; topDepthM: number }
  /** Depth unknown: plan position only; the vertical position is shown as an unknown range. */
  | { kind: "depth-unknown"; diameterM?: number };

export interface SceneUtility {
  id: string;
  name: string;
  type: UtilityType;
  path: ScenePoint[];
  depth: UtilityDepthModel;
  depthUncertaintyM?: number;
  /** Recorded vertical range the utility may occupy; only when depth and uncertainty are both recorded. */
  depthBand?: DepthBand;
  /** Highest-priority severity among engine results for this asset; null when none. */
  worstSeverity: ConflictSeverity | null;
  clashIds: string[];
}

export interface SceneTrench {
  id: string;
  name: string;
  status: WorkStatus;
  path: ScenePoint[];
  widthM: number;
  depthM: number;
  depthUncertaintyM?: number;
  /** Cancelled works are drawn for context but excluded from clash detection. */
  excluded: boolean;
  clashIds: string[];
}

/** A vertical range in true metres below ground (positive down). */
export interface DepthBand {
  topM: number;
  bottomM: number;
}

export interface SceneBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SceneModel {
  /** [longitude, latitude] of the scene origin. */
  origin: [number, number];
  utilities: SceneUtility[];
  trenches: SceneTrench[];
  bounds: SceneBounds;
  /** Deepest level the scene needs to show (true metres). */
  maxDepthM: number;
  /** Depth ruler tick values (true metres). */
  rulerTicks: number[];
}

export type SceneFeatureRef = { kind: "asset" | "excavation"; id: string };

// ---------------------------------------------------------------------------
// Coordinates and depth
// ---------------------------------------------------------------------------

/** Midpoint of the bounding box of all positions, used as the local origin. */
export function sceneOrigin(positions: readonly Position[]): [number, number] {
  if (positions.length === 0) throw new Error("Cannot build a scene without coordinates");
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of positions) {
    if (lng === undefined || lat === undefined) continue;
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

/** Returns a converter from [lng, lat] to scene metres around `origin`. */
export function createSceneProjection(origin: [number, number]): (position: Position) => ScenePoint {
  const project = createLocalProjection(origin);
  return (position) => {
    const [east, north] = project(position);
    return { x: east, z: -north };
  };
}

/** Scene Y for a depth below ground. Depths are positive downwards; exaggeration scales only Y. */
export function depthToSceneY(depthM: number, verticalExaggeration = 1): number {
  return depthM === 0 ? 0 : -depthM * verticalExaggeration;
}

export function utilityDepthModel(asset: UtilityAsset): UtilityDepthModel {
  if (asset.depthM === undefined) {
    return asset.diameterM === undefined ? { kind: "depth-unknown" } : { kind: "depth-unknown", diameterM: asset.diameterM };
  }
  if (asset.diameterM === undefined) return { kind: "diameter-unknown", topDepthM: asset.depthM };
  return {
    kind: "known",
    topDepthM: asset.depthM,
    diameterM: asset.diameterM,
    centreDepthM: asset.depthM + asset.diameterM / 2,
  };
}

/**
 * Depth to the bottom of a utility (top + diameter). Only defined when both are recorded; a missing
 * diameter is never assumed.
 */
export function utilityBottomDepthM(asset: Pick<UtilityAsset, "depthM" | "diameterM">): number | undefined {
  if (asset.depthM === undefined || asset.diameterM === undefined) return undefined;
  return Math.round((asset.depthM + asset.diameterM) * 1000) / 1000;
}

/**
 * Illustrative depth ranges (true metres to top) used only when authoring additional synthetic demo
 * examples and shown as reference text in the legend. They are NOT installation standards and are
 * never applied to a record: the scene uses each asset's recorded depth or shows it as unknown.
 */
export const ILLUSTRATIVE_DEPTH_RANGES_M: Readonly<Record<UtilityType, readonly [number, number]>> = {
  telecom: [0.3, 0.8],
  electric: [0.6, 1.2],
  gas: [0.6, 1.0],
  water: [1.0, 1.8],
  sewer: [1.5, 3.0],
};

/**
 * Vertical range a utility may occupy given its recorded depth tolerance: from top depth − uncertainty
 * (never above ground) to top + diameter + uncertainty. Undefined when depth or uncertainty is not
 * recorded — an unknown tolerance is not a zero tolerance, and no band is drawn for it.
 */
export function utilityDepthBand(asset: Pick<UtilityAsset, "depthM" | "diameterM" | "depthUncertaintyM">): DepthBand | undefined {
  if (asset.depthM === undefined || asset.depthUncertaintyM === undefined) return undefined;
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    topM: round(Math.max(0, asset.depthM - asset.depthUncertaintyM)),
    bottomM: round(asset.depthM + (asset.diameterM ?? 0) + asset.depthUncertaintyM),
  };
}

/** Deepest recorded extent of a utility (top + diameter + uncertainty); undefined when depth is unknown. */
function utilityDeepestM(asset: UtilityAsset): number | undefined {
  if (asset.depthM === undefined) return undefined;
  return asset.depthM + (asset.diameterM ?? 0) + (asset.depthUncertaintyM ?? 0);
}

export function rulerTicks(maxDepthM: number): number[] {
  const step = maxDepthM <= 2 ? 0.25 : maxDepthM <= 5 ? 0.5 : 1;
  const ticks: number[] = [];
  for (let d = 0; d <= maxDepthM + 1e-9; d += step) ticks.push(Math.round(d * 100) / 100);
  return ticks;
}

// ---------------------------------------------------------------------------
// Scene assembly
// ---------------------------------------------------------------------------

export function buildSceneModel(dataset: ProjectDataset): SceneModel {
  const { assets, excavations, clashes } = dataset;
  const allPositions = [...assets, ...excavations].flatMap((r) => r.geometry.coordinates);
  const origin = sceneOrigin(allPositions);
  const toScene = createSceneProjection(origin);

  const ranked = rankClashes(clashes);
  const clashesByAsset = new Map<string, ClashResult[]>();
  const clashesByExcavation = new Map<string, ClashResult[]>();
  for (const c of ranked) {
    for (const id of c.affectedAssetIds) clashesByAsset.set(id, [...(clashesByAsset.get(id) ?? []), c]);
    clashesByExcavation.set(c.excavationId, [...(clashesByExcavation.get(c.excavationId) ?? []), c]);
  }

  const utilities: SceneUtility[] = assets.map((a) => {
    const related = clashesByAsset.get(a.id) ?? [];
    const band = utilityDepthBand(a);
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      path: a.geometry.coordinates.map(toScene),
      depth: utilityDepthModel(a),
      ...(a.depthUncertaintyM !== undefined ? { depthUncertaintyM: a.depthUncertaintyM } : {}),
      ...(band ? { depthBand: band } : {}),
      worstSeverity: related[0]?.severity ?? null,
      clashIds: related.map((c) => c.id),
    };
  });

  const trenches: SceneTrench[] = excavations.map((e: ExcavationWork) => ({
    id: e.id,
    name: e.name,
    status: e.status,
    path: e.geometry.coordinates.map(toScene),
    widthM: e.widthM,
    depthM: e.plannedDepthM,
    ...(e.depthUncertaintyM !== undefined ? { depthUncertaintyM: e.depthUncertaintyM } : {}),
    excluded: e.status === "cancelled",
    clashIds: (clashesByExcavation.get(e.id) ?? []).map((c) => c.id),
  }));

  const points = [...utilities, ...trenches].flatMap((f) => f.path);
  const bounds: SceneBounds = {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };

  const deepest = Math.max(
    1,
    ...excavations.map((e) => e.plannedDepthM + (e.depthUncertaintyM ?? 0)),
    ...assets.map(utilityDeepestM).filter((d): d is number => d !== undefined),
  );
  const maxDepthM = Math.ceil((deepest * 1.15) / 0.5) * 0.5;

  return { origin, utilities, trenches, bounds, maxDepthM, rulerTicks: rulerTicks(maxDepthM) };
}

// ---------------------------------------------------------------------------
// Selection mapping
// ---------------------------------------------------------------------------

export interface SelectionTargets {
  assetIds: Set<string>;
  excavationIds: Set<string>;
}

/** Which scene objects to highlight for the shared dashboard selection. */
export function selectionTargets(
  selectedClash: Pick<ClashResult, "excavationId" | "affectedAssetIds"> | null,
  selectedFeature: SceneFeatureRef | null,
): SelectionTargets {
  const assetIds = new Set<string>(selectedClash?.affectedAssetIds ?? []);
  const excavationIds = new Set<string>(selectedClash ? [selectedClash.excavationId] : []);
  if (selectedFeature?.kind === "asset") assetIds.add(selectedFeature.id);
  if (selectedFeature?.kind === "excavation") excavationIds.add(selectedFeature.id);
  return { assetIds, excavationIds };
}

/** Converts a picked object's userData back into a dashboard feature reference. */
export function pickToFeature(userData: unknown): SceneFeatureRef | null {
  if (typeof userData !== "object" || userData === null) return null;
  const { kind, id } = userData as { kind?: unknown; id?: unknown };
  if ((kind === "asset" || kind === "excavation") && typeof id === "string" && id.length > 0) return { kind, id };
  return null;
}

/**
 * Chooses the clicked feature from ray hits ordered nearest-first. The nearest feature wins, except
 * that a utility lying inside the nearest trench (between the ray's entry and exit hits on that
 * trench) is preferred, since utilities are drawn inside translucent trenches. A utility merely
 * behind a trench never steals the click, so clicking a trench selects that trench.
 */
export function choosePick(hits: readonly unknown[]): SceneFeatureRef | null {
  const refs = hits.map(pickToFeature).filter((r): r is SceneFeatureRef => r !== null);
  const first = refs[0];
  if (!first || first.kind === "asset") return first ?? null;
  let exit = 0;
  refs.forEach((r, i) => {
    if (r.kind === "excavation" && r.id === first.id) exit = i;
  });
  return refs.slice(1, exit).find((r) => r.kind === "asset") ?? first;
}
