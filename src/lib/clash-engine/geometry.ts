/**
 * Planar geometry on a local tangent-plane projection.
 *
 * GeoJSON positions are [longitude, latitude] in degrees, so they are first projected to local metres
 * around a nearby origin using WGS84 metres-per-degree series. Over a few kilometres, the resulting
 * distance error is far below survey tolerances. Exact planar segment geometry then gives true minimum
 * distances between polylines, including intersections.
 */
import type { LineString, Position } from "geojson";

export type Vec2 = readonly [x: number, y: number];

function toLngLat(position: Position): [lng: number, lat: number] {
  const [lng, lat] = position;
  if (lng === undefined || lat === undefined || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new TypeError("Invalid GeoJSON position: expected [longitude, latitude]");
  }
  return [lng, lat];
}

/** Returns a function projecting [lng, lat] to [east, north] metres relative to `origin`. */
export function createLocalProjection(origin: Position): (position: Position) => Vec2 {
  const [lng0, lat0] = toLngLat(origin);
  const phi = (lat0 * Math.PI) / 180;
  const mPerDegLat =
    111_132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi) - 0.0023 * Math.cos(6 * phi);
  const mPerDegLng = 111_412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi);
  return (position) => {
    const [lng, lat] = toLngLat(position);
    return [(lng - lng0) * mPerDegLng, (lat - lat0) * mPerDegLat];
  };
}

const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

export function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** True when the segments properly cross. Touching/collinear cases are caught by endpoint distances. */
export function segmentsCross(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function segmentDistance(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): number {
  if (segmentsCross(p1, p2, q1, q2)) return 0;
  return Math.min(
    pointToSegmentDistance(p1, q1, q2),
    pointToSegmentDistance(p2, q1, q2),
    pointToSegmentDistance(q1, p1, p2),
    pointToSegmentDistance(q2, p1, p2),
  );
}

function segments(points: readonly Vec2[]): [Vec2, Vec2][] {
  if (points.length === 1 && points[0]) return [[points[0], points[0]]];
  const result: [Vec2, Vec2][] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) result.push([a, b]);
  }
  return result;
}

/** Minimum distance in metres between two LineStrings (0 when they intersect). */
export function lineStringDistanceM(a: LineString, b: LineString): number {
  const origin = b.coordinates[0];
  if (!origin || a.coordinates.length === 0) throw new TypeError("LineString has no coordinates");
  const project = createLocalProjection(origin);
  const segA = segments(a.coordinates.map(project));
  const segB = segments(b.coordinates.map(project));
  let min = Infinity;
  for (const [p1, p2] of segA) {
    for (const [q1, q2] of segB) {
      min = Math.min(min, segmentDistance(p1, p2, q1, q2));
      if (min === 0) return 0;
    }
  }
  return min;
}

export interface CorridorDistance {
  /** Distance from the asset centreline to the excavation centreline. */
  centrelineDistanceM: number;
  /** Distance from the asset centreline to the corridor edge; 0 when the centreline is inside the corridor. */
  edgeDistanceM: number;
}

/** Measures an asset centreline against an excavation corridor of `widthM` centred on `corridor`. */
export function measureCorridorDistance(asset: LineString, corridor: LineString, widthM: number): CorridorDistance {
  const centrelineDistanceM = lineStringDistanceM(asset, corridor);
  return { centrelineDistanceM, edgeDistanceM: Math.max(0, centrelineDistanceM - widthM / 2) };
}
