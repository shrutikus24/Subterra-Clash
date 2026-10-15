import { lineString, pointToLineDistance } from "@turf/turf";
import type { LineString } from "geojson";
import { describe, expect, it } from "vitest";
import {
  createLocalProjection,
  lineStringDistanceM,
  measureCorridorDistance,
  pointToSegmentDistance,
  segmentsCross,
} from "./geometry";

const line = (...coordinates: [number, number][]): LineString => ({ type: "LineString", coordinates });

describe("planar primitives", () => {
  it("measures point-to-segment distance including endpoints", () => {
    expect(pointToSegmentDistance([0, 5], [-10, 0], [10, 0])).toBe(5);
    expect(pointToSegmentDistance([13, 4], [-10, 0], [10, 0])).toBe(5);
  });

  it("detects proper crossings only", () => {
    expect(segmentsCross([0, -1], [0, 1], [-1, 0], [1, 0])).toBe(true);
    expect(segmentsCross([0, 1], [0, 2], [-1, 0], [1, 0])).toBe(false);
  });
});

describe("local projection", () => {
  it("agrees with Turf within 1% (Turf uses a spherical earth; this projection uses WGS84)", () => {
    const corridor = line([77.597, 12.9745], [77.6, 12.9745]);
    const asset = line([77.5985, 12.9772], [77.5995, 12.9772]);
    const turf = pointToLineDistance([77.5985, 12.9772], lineString(corridor.coordinates), { units: "meters" });
    expect(Math.abs(lineStringDistanceM(asset, corridor) - turf) / turf).toBeLessThan(0.01);
  });

  it("matches the WGS84 meridian degree length at 45° (~111,132 m)", () => {
    const project = createLocalProjection([0, 45]);
    expect(Math.abs(project([0, 46])[1] - 111_132)).toBeLessThan(2);
  });
});

describe("corridor distance", () => {
  it("returns zero for crossing lines", () => {
    const d = measureCorridorDistance(line([0, -0.001], [0, 0.001]), line([-0.001, 0], [0.001, 0]), 2);
    expect(d.centrelineDistanceM).toBe(0);
    expect(d.edgeDistanceM).toBe(0);
  });

  it("subtracts half the corridor width and floors at zero", () => {
    const corridor = line([77.597, 12.9745], [77.598, 12.9745]);
    const asset = line([77.597, 12.97455], [77.598, 12.97455]); // ~5.5 m north
    const d = measureCorridorDistance(asset, corridor, 2);
    expect(d.edgeDistanceM).toBeCloseTo(d.centrelineDistanceM - 1, 9);
    expect(measureCorridorDistance(asset, corridor, 20).edgeDistanceM).toBe(0);
  });
});
