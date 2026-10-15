// Copies MapLibre's prebuilt Web Worker into /public so the browser can load it by URL.
// Next.js's bundler does not resolve MapLibre v6's worker automatically; the map calls
// setWorkerUrl("/maplibre-gl-worker.mjs"). Runs before `dev` and `build`, so the copy always
// matches the installed package version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(dirname(require.resolve("maplibre-gl/package.json")), "dist", "maplibre-gl-worker.mjs");
const target = join(root, "public", "maplibre-gl-worker.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log("Copied MapLibre worker to public/maplibre-gl-worker.mjs");
