"use client";

import { buffer, featureCollection, lineString } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { Map as MapLibreMap, NavigationControl, Popup, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";
import { resolveCssColor } from "@/components/dashboard/colors";
import { WORK_STATUS_META } from "@/components/dashboard/meta";
import { BASEMAP_STYLE, fitTo } from "@/components/map/basemap";
import type { MapStatus } from "@/components/map/MapView";
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from "@/lib/data/config";
import type { PublicWork } from "@/lib/public";

export interface PublicMapViewProps {
  works: readonly PublicWork[];
  /** Works passing the current filters; the rest are hidden. */
  visibleIds: readonly string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onStatus: (status: MapStatus) => void;
}

/** Status colours as literals, because MapLibre cannot read CSS variables. */
function statusColorExpr(): unknown[] {
  return [
    "match",
    ["get", "status"],
    "planned",
    resolveCssColor("var(--color-accent)", "#0e7490"),
    "active",
    "#1a1a19",
    "delayed",
    "#c98a00",
    "#8a8a85",
  ];
}

/**
 * Public works map. Shows excavation corridors only: no utility lines and no conflict markers, since a
 * marker would reveal where an underground line crosses the work.
 */
export function PublicMapView({ works, visibleIds, selectedId, onSelect, onStatus }: PublicMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const sources = useMemo(() => {
    const corridors = featureCollection(
      works
        .map((w) => {
          // Corridors are drawn at least 6 m wide so narrow trenches stay visible and clickable.
          const poly = buffer(lineString(w.geometry.coordinates), Math.max(w.widthM, 6) / 2, { units: "meters" });
          if (!poly) return null;
          poly.properties = { id: w.id, name: w.name, status: w.status };
          return poly;
        })
        .filter((f): f is Feature<Polygon | MultiPolygon> => f !== null),
    );
    const centrelines = featureCollection(
      works.map((w) => lineString(w.geometry.coordinates, { id: w.id, name: w.name, status: w.status })),
    );
    return { corridors, centrelines };
  }, [works]);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const nameById = useMemo(() => new Map(works.map((w) => [w.id, w])), [works]);
  const nameRef = useRef(nameById);
  nameRef.current = nameById;

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
      if ((e as { sourceId?: string }).sourceId !== "osm") return void console.error("[map]", e.error);
      if (!basemapError) {
        basemapError = true;
        if (loadedRef.current) statusRef.current({ state: "ready", basemapError });
      }
    });

    map.once("style.load", () => {
      const { corridors, centrelines } = sourcesRef.current;
      map.addSource("corridors", { type: "geojson", data: corridors });
      map.addSource("centrelines", { type: "geojson", data: centrelines });
      const color = statusColorExpr() as never;

      map.addLayer({
        id: "work-fill",
        type: "fill",
        source: "corridors",
        paint: { "fill-color": color, "fill-opacity": ["case", ["==", ["get", "status"], "cancelled"], 0.12, 0.3] },
      });
      map.addLayer({
        id: "work-outline",
        type: "line",
        source: "corridors",
        paint: {
          "line-color": color,
          "line-width": 1.5,
          "line-opacity": ["case", ["==", ["get", "status"], "cancelled"], 0.5, 1],
        },
      });
      map.addLayer({
        id: "work-selected",
        type: "line",
        source: "corridors",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": resolveCssColor("var(--color-accent-bright)", "#06b6d4"), "line-width": 4 },
      });
      map.addLayer({
        id: "work-centreline",
        type: "line",
        source: "centrelines",
        paint: { "line-color": color, "line-width": 2, "line-opacity": 0.8 },
      });

      const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      const hitId = (e: MapMouseEvent): string | null => {
        const p = e.point;
        const [f] = map.queryRenderedFeatures(
          [
            [p.x - 6, p.y - 6],
            [p.x + 6, p.y + 6],
          ],
          { layers: ["work-fill", "work-centreline"] },
        );
        const id = f?.properties?.id;
        return typeof id === "string" ? id : null;
      };
      map.on("mousemove", (e) => {
        const id = hitId(e);
        map.getCanvas().style.cursor = id ? "pointer" : "";
        const work = id ? nameRef.current.get(id) : undefined;
        if (!work) return void popup.remove();
        popup.setLngLat(e.lngLat).setText(`${work.name} · ${WORK_STATUS_META[work.status].label}`).addTo(map);
      });
      map.on("mouseout", () => popup.remove());
      map.on("click", (e) => selectRef.current(hitId(e)));

      loadedRef.current = true;
      // A work linked from another page (?work=) may be selected before the map finished loading.
      const initial = corridors.features.filter((f) => f.properties?.id === selectedRef.current);
      map.setFilter("work-selected", ["==", ["get", "id"], selectedRef.current ?? ""]);
      fitTo(map, initial.length ? featureCollection(initial) : corridors, initial.length ? 18 : 17);
      statusRef.current({ state: "ready", basemapError });
    });

    return () => {
      loadedRef.current = false;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource("corridors") as GeoJSONSource | undefined)?.setData(sources.corridors);
    (map.getSource("centrelines") as GeoJSONSource | undefined)?.setData(sources.centrelines);
  }, [sources]);

  // Filtered-out works are hidden rather than removed, so the view does not jump.
  const visibleKey = visibleIds.join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const filter = ["in", ["get", "id"], ["literal", visibleKey ? visibleKey.split("|") : []]] as never;
    for (const id of ["work-fill", "work-outline", "work-centreline"]) map.setFilter(id, filter);
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setFilter("work-selected", ["==", ["get", "id"], selectedId ?? ""]);
    const target = sources.corridors.features.filter((f) => f.properties?.id === selectedId);
    if (target.length) fitTo(map, featureCollection(target), 18);
  }, [selectedId, sources]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="region"
      aria-label="Map of public works. Use the list of works for keyboard selection."
    />
  );
}
