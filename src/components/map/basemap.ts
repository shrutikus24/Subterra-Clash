/** Basemap and viewport helpers shared by the engineering map and the public works map. */
import { bbox } from "@turf/turf";
import type { FeatureCollection } from "geojson";
import { setWorkerUrl, type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";

// MapLibre v6 parses GeoJSON in a Web Worker that the bundler cannot locate on its own;
// scripts/copy-maplibre-worker.mjs places it in /public before dev and build.
setWorkerUrl("/maplibre-gl-worker.mjs");

// Keyless OpenStreetMap raster basemap, desaturated so data layers stay dominant.
export const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f4f4f2" } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.85, "raster-opacity": 0.7 } },
  ],
};

export function fitTo(map: MapLibreMap, collection: FeatureCollection, maxZoom = 18) {
  if (collection.features.length === 0) return;
  const [minX, minY, maxX, maxY] = bbox(collection);
  map.fitBounds(
    [
      [minX, minY],
      [maxX, maxY],
    ],
    { padding: 48, maxZoom, duration: 600 },
  );
}
