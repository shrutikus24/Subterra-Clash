"use client";

/**
 * three.js renderer for the 3D underground view. All domain decisions (positions, depths, unknowns,
 * highlight state) come from `@/lib/scene3d/model`; this file only turns that model into meshes.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { resolveCssColor } from "@/components/dashboard/colors";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { SEVERITY_META, UTILITY_META } from "@/components/dashboard/meta";
import {
  choosePick,
  depthToSceneY,
  selectionTargets,
  type SceneModel,
  type ScenePoint,
  type SceneTrench,
  type SceneUtility,
} from "@/lib/scene3d/model";
import type { UtilityType } from "@/types";

export type ViewerCommand = { type: "reset" | "rotate-left" | "rotate-right" | "zoom-in" | "zoom-out"; n: number };
export type ViewerStatus = { state: "loading" } | { state: "ready" } | { state: "error"; message: string };

export interface Underground3DViewProps {
  model: SceneModel;
  visibleTypes: Record<UtilityType, boolean>;
  showExcavations: boolean;
  showConflicts: boolean;
  /** Vertical exaggeration applied to depths (1 = true scale). */
  exaggeration: number;
  command: ViewerCommand | null;
  onStatus: (status: ViewerStatus) => void;
  onHover: (label: string | null) => void;
}

interface UtilityEntry {
  type: UtilityType;
  group: THREE.Group;
  halo: THREE.Object3D | null;
  meshMaterials: THREE.MeshStandardMaterial[];
  lineMaterials: (THREE.LineBasicMaterial | THREE.LineDashedMaterial)[];
  curtainMaterials: THREE.MeshBasicMaterial[];
  /** Recorded depth-uncertainty band (absent when no tolerance is recorded). */
  bandMaterials: THREE.MeshBasicMaterial[];
  baseColor: THREE.Color;
}

interface TrenchEntry {
  group: THREE.Group;
  fill: THREE.MeshStandardMaterial;
  edges: THREE.LineBasicMaterial | THREE.LineDashedMaterial;
  baseEdge: THREE.Color;
  baseFill: THREE.Color;
  baseFillOpacity: number;
}

const SELECT_COLOR = new THREE.Color("#06b6d4");
const ROTATE_STEP = Math.PI / 12;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const v3 = (p: ScenePoint, y: number) => new THREE.Vector3(p.x, y, p.z);

function pathCurve(path: readonly ScenePoint[], y: number): THREE.CurvePath<THREE.Vector3> {
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a && b) curve.add(new THREE.LineCurve3(v3(a, y), v3(b, y)));
  }
  return curve;
}

function polyline(path: readonly ScenePoint[], y: number, material: THREE.LineBasicMaterial | THREE.LineDashedMaterial) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.map((p) => v3(p, y))), material);
  if (material instanceof THREE.LineDashedMaterial) line.computeLineDistances();
  return line;
}

/** Segment helper: midpoint, length and Y-rotation that aligns a box/plane's local X with the segment. */
function segments(path: readonly ScenePoint[]) {
  const out: { mid: ScenePoint; length: number; rotationY: number }[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    out.push({ mid: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, length: Math.hypot(dx, dz), rotationY: Math.atan2(-dz, dx) });
  }
  return out;
}

/** Screen-space label: `height` is a fraction of the viewport height, so text stays legible at any zoom. */
function textSprite(text: string, height = 0.032, color = "#1a1a19", background = "rgba(255,255,255,0.85)") {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const fontPx = 48;
  if (!ctx) return new THREE.Sprite();
  ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
  const width = Math.ceil(ctx.measureText(text).width) + 32;
  canvas.width = width;
  canvas.height = fontPx + 24;
  ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 16);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 16, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, sizeAttenuation: false }),
  );
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const withGeometry = obj as THREE.Mesh;
    withGeometry.geometry?.dispose();
    const material = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      (m as THREE.SpriteMaterial).map?.dispose();
      m.dispose();
    }
  });
}

function isShown(obj: THREE.Object3D | null): boolean {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function featureData(obj: THREE.Object3D | null): unknown {
  for (let o = obj; o; o = o.parent) if (o.userData.kind) return o.userData;
  return null;
}

// ---------------------------------------------------------------------------
// Scene construction
// ---------------------------------------------------------------------------

function buildUtility(u: SceneUtility, ex: number, maxDepthM: number, haloColor: THREE.Color | null): UtilityEntry {
  const group = new THREE.Group();
  const worst = u.worstSeverity ? ` · ${SEVERITY_META[u.worstSeverity].label}` : "";
  group.userData = { kind: "asset", id: u.id, label: `${u.name} · ${UTILITY_META[u.type].label}${worst}` };
  const base = new THREE.Color(UTILITY_META[u.type].color);
  const entry: UtilityEntry = {
    type: u.type,
    group,
    halo: null,
    meshMaterials: [],
    lineMaterials: [],
    curtainMaterials: [],
    bandMaterials: [],
    baseColor: base,
  };
  let haloY = 0;

  if (u.depth.kind === "known") {
    // True-size pipe; Y scaling stretches only the cross-section by the exaggeration factor.
    const radius = u.depth.diameterM / 2;
    const tubeMaterial = new THREE.MeshStandardMaterial({ color: base, roughness: 0.55, metalness: 0.05, transparent: true });
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(pathCurve(u.path, 0), Math.max(8, u.path.length * 16), radius, 16, false),
      tubeMaterial,
    );
    tube.position.y = depthToSceneY(u.depth.centreDepthM, ex);
    tube.scale.y = ex;
    group.add(tube);
    entry.meshMaterials.push(tubeMaterial);
    // A 1 px centreline keeps thin services visible at site scale.
    const lineMaterial = new THREE.LineBasicMaterial({ color: base, transparent: true });
    group.add(polyline(u.path, tube.position.y, lineMaterial));
    entry.lineMaterials.push(lineMaterial);
    haloY = tube.position.y;
  } else if (u.depth.kind === "diameter-unknown") {
    // Recorded top depth, no assumed size: dashed line only.
    const dashed = new THREE.LineDashedMaterial({ color: base, dashSize: 1.2, gapSize: 0.8, transparent: true });
    haloY = depthToSceneY(u.depth.topDepthM, ex);
    group.add(polyline(u.path, haloY, dashed));
    entry.lineMaterials.push(dashed);
  } else {
    // Unknown depth: dashed plan trace on the surface plus a translucent curtain spanning the whole
    // modelled depth, showing that the asset could be anywhere in that range.
    const dashed = new THREE.LineDashedMaterial({ color: base, dashSize: 1.5, gapSize: 1, transparent: true });
    group.add(polyline(u.path, 0.05, dashed));
    entry.lineMaterials.push(dashed);
    const height = maxDepthM * ex;
    for (const s of segments(u.path)) {
      const material = new THREE.MeshBasicMaterial({
        color: base,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(s.length, height), material);
      curtain.position.set(s.mid.x, -height / 2, s.mid.z);
      curtain.rotation.y = s.rotationY;
      group.add(curtain);
      entry.curtainMaterials.push(material);
    }
    const mid = segments(u.path)[0]?.mid;
    if (mid) {
      const label = textSprite("Depth unknown", 0.028, "#55554f");
      label.position.set(mid.x, 3, mid.z);
      group.add(label);
    }
  }

  if (u.depthBand) {
    // Recorded depth tolerance: a thin vertical ribbon from (top − uncertainty) to (bottom + uncertainty).
    const top = depthToSceneY(u.depthBand.topM, ex);
    const bottom = depthToSceneY(u.depthBand.bottomM, ex);
    const height = top - bottom;
    if (height > 0) {
      const material = new THREE.MeshBasicMaterial({
        color: base,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      for (const s of segments(u.path)) {
        const band = new THREE.Mesh(new THREE.PlaneGeometry(s.length, height), material);
        band.position.set(s.mid.x, (top + bottom) / 2, s.mid.z);
        band.rotation.y = s.rotationY;
        group.add(band);
      }
      entry.bandMaterials.push(material);
    }
  }

  if (haloColor) {
    // Visual highlight only (not a measurement): fixed 0.6 m radius around the drawn line.
    const halo = new THREE.Mesh(
      new THREE.TubeGeometry(pathCurve(u.path, haloY), Math.max(8, u.path.length * 16), 0.6, 10, false),
      new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    halo.userData = { decorative: true };
    group.add(halo);
    entry.halo = halo;
  }
  return entry;
}

function buildTrench(t: SceneTrench, ex: number): TrenchEntry {
  const group = new THREE.Group();
  group.userData = { kind: "excavation", id: t.id, label: `${t.name} · excavation${t.excluded ? " (cancelled)" : ""}` };
  const height = t.depthM * ex;
  const fill = new THREE.MeshStandardMaterial({
    color: t.excluded ? "#9a9a94" : "#3a3a36",
    transparent: true,
    opacity: t.excluded ? 0.06 : 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const baseEdge = new THREE.Color(t.excluded ? "#8a8a85" : "#1a1a19");
  const edges = t.excluded
    ? new THREE.LineDashedMaterial({ color: baseEdge, dashSize: 1, gapSize: 0.8 })
    : new THREE.LineBasicMaterial({ color: baseEdge });

  for (const s of segments(t.path)) {
    const geometry = new THREE.BoxGeometry(s.length, height, t.widthM);
    const box = new THREE.Mesh(geometry, fill);
    box.position.set(s.mid.x, -height / 2, s.mid.z);
    box.rotation.y = s.rotationY;
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edges);
    if (edges instanceof THREE.LineDashedMaterial) outline.computeLineDistances();
    outline.position.copy(box.position);
    outline.rotation.copy(box.rotation);
    group.add(box, outline);
  }

  if (t.depthUncertaintyM !== undefined && t.depthUncertaintyM > 0) {
    // Recorded tolerance on the planned depth: dashed line at the deepest the trench may reach.
    const toleranceMaterial = new THREE.LineDashedMaterial({ color: baseEdge, dashSize: 0.8, gapSize: 0.6, transparent: true, opacity: 0.7 });
    group.add(polyline(t.path, depthToSceneY(t.depthM + t.depthUncertaintyM, ex), toleranceMaterial));
  }

  const first = t.path[0];
  if (first) {
    const tolerance = t.depthUncertaintyM !== undefined ? ` ±${t.depthUncertaintyM}` : "";
    const label = textSprite(`${t.name} · ${t.depthM}${tolerance} m${t.excluded ? " · cancelled" : ""}`);
    label.position.set(first.x, 4, first.z);
    group.add(label);
  }
  return { group, fill, edges, baseEdge, baseFill: fill.color.clone(), baseFillOpacity: fill.opacity };
}

function buildEnvironment(model: SceneModel, ex: number): THREE.Group {
  const env = new THREE.Group();
  const { minX, maxX, minZ, maxZ } = model.bounds;
  const margin = Math.max(maxX - minX, maxZ - minZ) * 0.08;
  const width = maxX - minX + margin * 2;
  const depth = maxZ - minZ + margin * 2;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const soilHeight = model.maxDepthM * ex;

  // Translucent ground surface with a 10 m grid.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ color: "#d9d4c7", transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cz);
  env.add(ground);
  const gridSize = Math.max(width, depth);
  const grid = new THREE.GridHelper(gridSize, Math.round(gridSize / 10), "#b8b2a3", "#d4cfc2");
  grid.position.set(cx, 0.02, cz);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.45;
  env.add(grid);

  // Cutaway soil volume: faint fill plus edges so the underground extent reads clearly.
  const soilGeometry = new THREE.BoxGeometry(width, soilHeight, depth);
  const soil = new THREE.Mesh(
    soilGeometry,
    new THREE.MeshBasicMaterial({ color: "#b9a27a", transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false }),
  );
  soil.position.set(cx, -soilHeight / 2, cz);
  const soilEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(soilGeometry),
    new THREE.LineBasicMaterial({ color: "#a8977a", transparent: true, opacity: 0.6 }),
  );
  soilEdges.position.copy(soil.position);
  env.add(soil, soilEdges);

  // Depth ruler at the south-west corner, nearest the default viewpoint, so it projects longest
  // (the site is far wider than it is deep). Labelled in true metres.
  const rx = minX - margin * 0.6;
  const rz = maxZ + margin * 0.6;
  const rulerMaterial = new THREE.LineBasicMaterial({ color: "#1a1a19" });
  env.add(
    new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(rx, 0, rz), new THREE.Vector3(rx, -soilHeight, rz)]), rulerMaterial),
  );
  // Screen-space labels would collide at overview distances, so only top, middle and bottom are labelled.
  const last = model.rulerTicks.length - 1;
  const labelled = new Set([0, Math.round(last / 2), last]);
  model.rulerTicks.forEach((d, i) => {
    const y = depthToSceneY(d, ex);
    env.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(rx, y, rz), new THREE.Vector3(rx + 3, y, rz)]), rulerMaterial),
    );
    if (labelled.has(i)) {
      const label = textSprite(d === 0 ? "0 m · ground" : `${d} m`, 0.026);
      label.center.set(1.1, 0.5); // anchor the right edge so the text sits left of the ruler
      label.position.set(rx, y, rz);
      env.add(label);
    }
  });
  const rulerTitle = textSprite(`Depth (true m) · vertical ×${ex}`, 0.028, "#55554f");
  // Right of the ruler top, so it never covers the "0 m · ground" label on the left.
  rulerTitle.center.set(-0.08, 0.5);
  rulerTitle.position.set(rx, 0, rz);
  env.add(rulerTitle);

  const north = textSprite("N ↑", 0.034);
  north.position.set(cx, 2, minZ - margin * 0.7);
  env.add(north);

  return env;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Underground3DView({
  model,
  visibleTypes,
  showExcavations,
  showConflicts,
  exaggeration,
  command,
  onStatus,
  onHover,
}: Underground3DViewProps) {
  const { selectedClash, selectedFeature, selectFeature } = useDashboard();
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    focusTarget: THREE.Vector3 | null;
  } | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const utilitiesRef = useRef(new Map<string, UtilityEntry>());
  const trenchesRef = useRef(new Map<string, TrenchEntry>());
  const pickablesRef = useRef<THREE.Object3D[]>([]);
  const homeRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const callbacks = useRef({ selectFeature, onStatus, onHover });
  callbacks.current = { selectFeature, onStatus, onHover };

  // --- Renderer, camera, controls, picking (created once) ----------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      callbacks.current.onStatus({ state: "error", message: "WebGL is not available in this browser." });
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor("#f4f4f2");
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight("#ffffff", 1.6));
    const sun = new THREE.DirectionalLight("#ffffff", 1.4);
    sun.position.set(-80, 160, 120);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 10_000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.95; // allow looking up from below ground
    coreRef.current = { renderer, scene, camera, controls, focusTarget: null };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const tick = () => {
      const core = coreRef.current;
      if (!core) return;
      if (core.focusTarget) {
        const delta = core.focusTarget.clone().sub(core.controls.target).multiplyScalar(reducedMotion ? 1 : 0.12);
        core.controls.target.add(delta);
        core.camera.position.add(delta);
        if (delta.lengthSq() < 1e-4) core.focusTarget = null;
      }
      core.controls.update();
      core.renderer.render(core.scene, core.camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const resize = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resize.observe(container);

    // Picking: click (not drag) selects; hover shows a label.
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.8 };
    const pointer = new THREE.Vector2();
    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const targets = pickablesRef.current.filter(isShown);
      return raycaster.intersectObjects(targets, false).map((h) => featureData(h.object));
    };
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
        const ref = choosePick(pick(e));
        if (ref) callbacks.current.selectFeature(ref);
      }
      down = null;
    };
    let hoverQueued = false;
    const onMove = (e: PointerEvent) => {
      if (hoverQueued || e.buttons) return;
      hoverQueued = true;
      requestAnimationFrame(() => {
        hoverQueued = false;
        const hit = pick(e).find((d) => d && (d as { label?: string }).label);
        const label = (hit as { label?: string } | undefined)?.label ?? null;
        renderer.domElement.style.cursor = label ? "pointer" : "grab";
        callbacks.current.onHover(label);
      });
    };
    const onLeave = () => callbacks.current.onHover(null);
    const onContextLost = (e: Event) => {
      e.preventDefault();
      callbacks.current.onStatus({ state: "error", message: "The 3D view lost its graphics context. Reload to retry." });
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      controls.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.domElement.remove();
      coreRef.current = null;
      contentRef.current = null;
    };
  }, []);

  // --- (Re)build scene content when the model or exaggeration changes ----------------------------
  useEffect(() => {
    const core = coreRef.current;
    if (!core) return;
    if (contentRef.current) {
      core.scene.remove(contentRef.current);
      disposeTree(contentRef.current);
    }
    const content = new THREE.Group();
    const utilities = new Map<string, UtilityEntry>();
    const trenches = new Map<string, TrenchEntry>();
    const pickables: THREE.Object3D[] = [];

    content.add(buildEnvironment(model, exaggeration));
    for (const t of model.trenches) {
      const entry = buildTrench(t, exaggeration);
      trenches.set(t.id, entry);
      content.add(entry.group);
      entry.group.traverse((o) => (o as THREE.Mesh).isMesh && pickables.push(o));
    }
    for (const u of model.utilities) {
      const haloColor = u.worstSeverity ? new THREE.Color(resolveCssColor(SEVERITY_META[u.worstSeverity].color)) : null;
      const entry = buildUtility(u, exaggeration, model.maxDepthM, haloColor);
      utilities.set(u.id, entry);
      content.add(entry.group);
      entry.group.traverse((o) => {
        if (((o as THREE.Mesh).isMesh || (o as THREE.Line).isLine) && !o.userData.decorative) pickables.push(o);
      });
    }
    core.scene.add(content);
    contentRef.current = content;
    utilitiesRef.current = utilities;
    trenchesRef.current = trenches;
    pickablesRef.current = pickables;

    // Default "home" camera: low (~17°) oblique view from the south-west so depth reads clearly, aimed
    // at the soil block's base so the whole site stays in frame (checked by projecting the corners).
    const { minX, maxX, minZ, maxZ } = model.bounds;
    const span = Math.max(maxX - minX, maxZ - minZ, 20);
    const target = new THREE.Vector3((minX + maxX) / 2, -model.maxDepthM * exaggeration, (minZ + maxZ) / 2);
    // Tuned for a ~1.4:1 canvas; narrower (e.g. portrait phone) canvases step back to keep the site in frame.
    const fit = Math.max(1, 1.4 / Math.max(core.camera.aspect, 0.1));
    const position = target.clone().add(new THREE.Vector3(-0.85, 0.45, 1.25).multiplyScalar(span * fit));
    const firstBuild = homeRef.current === null;
    homeRef.current = { position, target };
    core.controls.minDistance = 5;
    core.controls.maxDistance = span * 5;
    if (firstBuild) {
      core.camera.position.copy(position);
      core.controls.target.copy(target);
      core.controls.update();
    }
    callbacks.current.onStatus({ state: "ready" });
  }, [model, exaggeration]);

  // --- Visibility and highlight (cheap; runs after every render) ---------------------------------
  const targets = selectionTargets(selectedClash, selectedFeature);
  const hasSelection = targets.assetIds.size + targets.excavationIds.size > 0;
  useEffect(() => {
    for (const [id, u] of utilitiesRef.current) {
      u.group.visible = visibleTypes[u.type];
      if (u.halo) u.halo.visible = showConflicts;
      const selected = targets.assetIds.has(id);
      // Unselected services dim but stay legible (thin 1 px lines vanish below ~0.5).
      const opacity = hasSelection && !selected ? 0.5 : 1;
      for (const m of u.meshMaterials) {
        m.emissive.copy(selected ? SELECT_COLOR : new THREE.Color("#000000"));
        m.emissiveIntensity = selected ? 0.55 : 0;
        m.opacity = opacity;
      }
      for (const m of u.lineMaterials) {
        m.color.copy(selected ? SELECT_COLOR : u.baseColor);
        m.opacity = opacity;
      }
      for (const m of u.curtainMaterials) {
        m.color.copy(selected ? SELECT_COLOR : u.baseColor);
        m.opacity = selected ? 0.25 : hasSelection ? 0.06 : 0.14;
      }
      for (const m of u.bandMaterials) {
        m.color.copy(selected ? SELECT_COLOR : u.baseColor);
        m.opacity = selected ? 0.22 : hasSelection ? 0.04 : 0.1;
      }
    }
    for (const [id, t] of trenchesRef.current) {
      t.group.visible = showExcavations;
      const selected = targets.excavationIds.has(id);
      t.edges.color.copy(selected ? SELECT_COLOR : t.baseEdge);
      t.fill.color.copy(selected ? SELECT_COLOR : t.baseFill);
      t.fill.opacity = selected ? 0.18 : t.baseFillOpacity;
    }
  });

  // --- Focus the camera on the selection -----------------------------------------------------------
  const focusKey = [...targets.assetIds, ...targets.excavationIds].join("|");
  useEffect(() => {
    const core = coreRef.current;
    if (!core || !focusKey) return;
    const pts = [
      ...model.utilities.filter((u) => targets.assetIds.has(u.id)).flatMap((u) => u.path),
      ...model.trenches.filter((t) => targets.excavationIds.has(t.id)).flatMap((t) => t.path),
    ];
    if (pts.length === 0) return;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    core.focusTarget = new THREE.Vector3(cx, -model.maxDepthM * exaggeration, cz); // same height as home
    // Keyed on the selection's identity (focusKey); `targets` is derived from the same selection.
  }, [focusKey, model, exaggeration]);

  // --- Toolbar / keyboard camera commands ----------------------------------------------------------
  useEffect(() => {
    const core = coreRef.current;
    const home = homeRef.current;
    if (!core || !command) return;
    const offset = core.camera.position.clone().sub(core.controls.target);
    switch (command.type) {
      case "reset":
        if (!home) return;
        core.focusTarget = null;
        core.camera.position.copy(home.position);
        core.controls.target.copy(home.target);
        break;
      case "rotate-left":
      case "rotate-right":
        offset.applyAxisAngle(Y_AXIS, command.type === "rotate-left" ? -ROTATE_STEP : ROTATE_STEP);
        core.camera.position.copy(core.controls.target).add(offset);
        break;
      case "zoom-in":
      case "zoom-out": {
        const length = THREE.MathUtils.clamp(
          offset.length() * (command.type === "zoom-in" ? 0.8 : 1.25),
          core.controls.minDistance,
          core.controls.maxDistance,
        );
        core.camera.position.copy(core.controls.target).add(offset.setLength(length));
        break;
      }
    }
    core.controls.update();
  }, [command]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
