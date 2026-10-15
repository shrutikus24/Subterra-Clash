"use client";

import { bbox, buffer, featureCollection, lineString, point } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";
import { resolveCssColor } from "@/components/dashboard/colors";
import { useDashboard, type FeatureRef } from "@/components/dashboard/DashboardProvider";
import { SEVERITY_META, UTILITY_META } from "@/components/dashboard/meta";
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from "@/lib/data/config";
import { shortClashId } from "@/lib/format";
import { conflictMarkers } from "@/lib/map/markers";
import { UTILITY_TYPES, type ConflictSeverity, type UtilityType } from "@/types";

export type MapStatus = { state: "loading" } | { state: "ready"; basemapError: boolean } | { state: "error"; message: string };

export interface MapViewProps {
  visibleTypes: Record<UtilityType, boolean>;
  showExcavations: boolean;
  showConflicts: boolean;
  /** Incrementing counter; each change fits the view to all data. */
  fitAllRequest: number;
  onStatus: (status: MapStatus) => void;
}

// MapLibre v6 parses GeoJSON in a Web Worker that the bundler cannot locate on its own;
// scripts/copy-maplibre-worker.mjs places it in /public before dev and build.
setWorkerUrl("/maplibre-gl-worker.mjs");

// Keyless OpenStreetMap raster basemap, desaturated so data layers stay dominant.
const BASEMAP_STYLE: StyleSpecification = {
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

const ASSET_LAYERS = UTILITY_TYPES.map((t) => `asset-${t}`);
const CLICKABLE_LAYERS = [...ASSET_LAYERS, "excavation-fill"];
const cssColor = (value: string) => resolveCssColor(value);

function fitTo(map: MapLibreMap, collection: FeatureCollection, maxZoom = 18) {
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

export function MapView({ visibleTypes, showExcavations, showConflicts, fitAllRequest, onStatus }: MapViewProps) {
  const {
    dataset,
    clashesByAsset,
    selectedClash,
    selectedFeature,
    selectFeature,
    selectClash,
    assetById,
    excavationById,
  } = useDashboard();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const selectRef = useRef(selectFeature);
  selectRef.current = selectFeature;
  const selectClashRef = useRef(selectClash);
  selectClashRef.current = selectClash;
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;

  // --- GeoJSON built from the shared dataset and engine results ------------------------------------
  const sources = useMemo(() => {
    const assets = featureCollection(
      dataset.assets.map((a) =>
        lineString(a.geometry.coordinates, {
          id: a.id,
          name: a.name,
          type: a.type,
          worstSeverity: clashesByAsset.get(a.id)?.[0]?.severity ?? "none",
        }),
      ),
    );
    const corridors = featureCollection(
      dataset.excavations
        .map((e) => {
          const poly = buffer(lineString(e.geometry.coordinates), e.widthM / 2, { units: "meters" });
          if (!poly) return null;
          poly.properties = { id: e.id, name: e.name, status: e.status };
          return poly;
        })
        .filter((f): f is Feature<Polygon | MultiPolygon> => f !== null),
    );
    const centrelines = featureCollection(
      dataset.excavations.map((e) => lineString(e.geometry.coordinates, { id: e.id, status: e.status })),
    );
    const markers = featureCollection(
      conflictMarkers(dataset.clashes, dataset.assets, dataset.excavations).map((m) =>
        point(m.position, { clashId: m.clashId, severity: m.severity, crosses: m.centrelinesCross }),
      ),
    );
    return { assets, corridors, centrelines, markers };
  }, [dataset, clashesByAsset]);

  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  // --- Map lifecycle --------------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: MAP_DEFAULT_CENTER,
        zoom: MAP_DEFAULT_ZOOM,
        attributionControl: { compact: true },
      });
    } catch (err) {
      statusRef.current({
        state: "error",
        message: err instanceof Error ? err.message : "The map could not be initialised (WebGL may be unavailable).",
      });
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    let basemapError = false;

    map.on("error", (e) => {
      const sourceId = (e as { sourceId?: string }).sourceId;
      if (sourceId !== "osm") {
        console.error("[map]", e.error);
        return;
      }
      if (!basemapError) {
        basemapError = true;
        if (loadedRef.current) statusRef.current({ state: "ready", basemapError });
      }
    });

    // "style.load" fires once the inline style is parsed; unlike "load" it does not wait for basemap
    // tiles, so data layers appear even when the tile server is slow or unreachable.
    map.once("style.load", () => {
      const { assets, corridors, centrelines, markers } = sourcesRef.current;
      map.addSource("assets", { type: "geojson", data: assets });
      map.addSource("corridors", { type: "geojson", data: corridors });
      map.addSource("centrelines", { type: "geojson", data: centrelines });
      map.addSource("markers", { type: "geojson", data: markers });

      const severityColorOf = (property: string): unknown[] => {
        const expr: unknown[] = ["match", ["get", property]];
        for (const [sev, meta] of Object.entries(SEVERITY_META)) expr.push(sev, cssColor(meta.color));
        expr.push("rgba(0,0,0,0)");
        return expr;
      };
      const severityColor = severityColorOf("worstSeverity");

      map.addLayer({
        id: "excavation-fill",
        type: "fill",
        source: "corridors",
        paint: {
          "fill-color": ["case", ["==", ["get", "status"], "cancelled"], "#9a9a94", "#1a1a19"],
          "fill-opacity": ["case", ["==", ["get", "status"], "cancelled"], 0.1, 0.22],
        },
      });
      map.addLayer({
        id: "excavation-outline",
        type: "line",
        source: "corridors",
        paint: {
          "line-color": ["case", ["==", ["get", "status"], "cancelled"], "#8a8a85", "#1a1a19"],
          "line-width": 1.2,
        },
      });
      map.addLayer({
        id: "excavation-centreline",
        type: "line",
        source: "centrelines",
        paint: { "line-color": "#1a1a19", "line-width": 1, "line-dasharray": [2, 2], "line-opacity": 0.6 },
      });
      map.addLayer({
        id: "conflict-halo",
        type: "line",
        source: "assets",
        filter: ["!=", ["get", "worstSeverity"], "none"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": severityColor as never, "line-width": 12, "line-opacity": 0.35 },
      });
      map.addLayer({
        id: "selected-asset",
        type: "line",
        source: "assets",
        filter: ["==", ["get", "id"], ""],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cssColor("var(--color-accent-bright)"), "line-width": 9 },
      });
      for (const type of UTILITY_TYPES) {
        const meta = UTILITY_META[type];
        map.addLayer({
          id: `asset-${type}`,
          type: "line",
          source: "assets",
          filter: ["==", ["get", "type"], type],
          layout: { "line-join": "round" },
          paint: {
            "line-color": meta.color,
            "line-width": 3.5,
            ...(meta.dash ? { "line-dasharray": meta.dash } : {}),
          },
        });
      }
      map.addLayer({
        id: "selected-excavation",
        type: "line",
        source: "corridors",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": cssColor("var(--color-accent)"), "line-width": 3 },
      });
      // Conflict markers: crossing point of recorded centrelines, or closest approach (display aid).
      map.addLayer({
        id: "conflict-marker-selected",
        type: "circle",
        source: "markers",
        filter: ["==", ["get", "clashId"], ""],
        paint: {
          "circle-radius": 12,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": cssColor("var(--color-accent-bright)"),
          "circle-stroke-width": 3,
        },
      });
      map.addLayer({
        id: "conflict-marker",
        type: "circle",
        source: "markers",
        paint: {
          "circle-radius": 6,
          "circle-color": severityColorOf("severity") as never,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      const hit = (e: MapMouseEvent) => {
        const p = e.point;
        return map.queryRenderedFeatures(
          [
            [p.x - 5, p.y - 5],
            [p.x + 5, p.y + 5],
          ],
          { layers: CLICKABLE_LAYERS.filter((id) => map.getLayer(id)) },
        );
      };
      const toRef = (features: ReturnType<typeof hit>): FeatureRef | null => {
        const asset = features.find((f) => f.layer.id.startsWith("asset-"));
        const target = asset ?? features[0];
        const id = target?.properties?.id;
        if (typeof id !== "string") return null;
        return { kind: asset ? "asset" : "excavation", id };
      };

      const markerAt = (e: MapMouseEvent) => {
        const p = e.point;
        const [f] = map.queryRenderedFeatures(
          [
            [p.x - 6, p.y - 6],
            [p.x + 6, p.y + 6],
          ],
          { layers: ["conflict-marker"] },
        );
        const clashId = f?.properties?.clashId;
        const severity = f?.properties?.severity as ConflictSeverity | undefined;
        return typeof clashId === "string" ? { clashId, severity, crosses: f?.properties?.crosses === true } : null;
      };

      map.on("mousemove", (e) => {
        const marker = markerAt(e);
        if (marker) {
          map.getCanvas().style.cursor = "pointer";
          const where = marker.crosses ? "centrelines cross" : "closest approach of centrelines";
          const severity = marker.severity && SEVERITY_META[marker.severity] ? ` · ${SEVERITY_META[marker.severity].label}` : "";
          popup.setLngLat(e.lngLat).setText(`${shortClashId(marker.clashId)}${severity} · ${where}`).addTo(map);
          return;
        }
        const ref = toRef(hit(e));
        map.getCanvas().style.cursor = ref ? "pointer" : "";
        if (!ref) return void popup.remove();
        const label =
          ref.kind === "asset"
            ? `${assetById.get(ref.id)?.name ?? ref.id} · ${UTILITY_META[assetById.get(ref.id)?.type ?? "water"].label}`
            : `${excavationById.get(ref.id)?.name ?? ref.id} · excavation`;
        popup.setLngLat(e.lngLat).setText(label).addTo(map);
      });
      map.on("mouseout", () => popup.remove());
      map.on("click", (e) => {
        const marker = markerAt(e);
        if (marker) return selectClashRef.current(marker.clashId);
        selectRef.current(toRef(hit(e)));
      });

      loadedRef.current = true;
      fitTo(map, featureCollection([...assets.features, ...corridors.features] as Feature[]), 17);
      statusRef.current({ state: "ready", basemapError });
    });

    return () => {
      loadedRef.current = false;
      mapRef.current = null;
      map.remove();
    };
    // Map is created once; data and handlers are read through refs.
  }, [assetById, excavationById]);

  // --- Keep sources in sync if the dataset changes -------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource("assets") as GeoJSONSource | undefined)?.setData(sources.assets);
    (map.getSource("corridors") as GeoJSONSource | undefined)?.setData(sources.corridors);
    (map.getSource("centrelines") as GeoJSONSource | undefined)?.setData(sources.centrelines);
    (map.getSource("markers") as GeoJSONSource | undefined)?.setData(sources.markers);
  }, [sources]);

  // --- Layer visibility ----------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const set = (id: string, visible: boolean) =>
      map.getLayer(id) && map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    for (const type of UTILITY_TYPES) set(`asset-${type}`, visibleTypes[type]);
    for (const id of ["excavation-fill", "excavation-outline", "excavation-centreline", "selected-excavation"]) {
      set(id, showExcavations);
    }
    set("conflict-halo", showConflicts);
    set("conflict-marker", showConflicts);
    set("conflict-marker-selected", showConflicts);
  });

  // --- Selection highlight and focus ---------------------------------------------------------------
  // Highlight the asset of the selected clash even when the selection started from an excavation.
  const selectedAssetId =
    selectedFeature?.kind === "asset" ? selectedFeature.id : (selectedClash?.affectedAssetIds[0] ?? "");
  const selectedExcavationId =
    selectedClash?.excavationId ?? (selectedFeature?.kind === "excavation" ? selectedFeature.id : "");

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setFilter("selected-asset", ["==", ["get", "id"], selectedAssetId]);
    map.setFilter("selected-excavation", ["==", ["get", "id"], selectedExcavationId]);
    map.setFilter("conflict-marker-selected", ["==", ["get", "clashId"], selectedClash?.id ?? ""]);
    const features: Feature[] = [
      ...sources.assets.features.filter((f) => f.properties.id === selectedAssetId),
      ...sources.corridors.features.filter((f) => f.properties?.id === selectedExcavationId),
    ];
    if (features.length) fitTo(map, featureCollection(features), 19);
  }, [selectedAssetId, selectedExcavationId, selectedClash?.id, sources]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || fitAllRequest === 0) return;
    fitTo(map, featureCollection([...sources.assets.features, ...sources.corridors.features] as Feature[]), 17);
  }, [fitAllRequest, sources]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="region"
      aria-label="Interactive utility map. Use the conflict list for keyboard selection."
    />
  );
}
