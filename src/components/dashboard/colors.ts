/** Resolves `var(--token)` to a literal colour for renderers (MapLibre, WebGL) that cannot use CSS variables. */
export function resolveCssColor(value: string, fallback = "#888888"): string {
  const name = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  if (!name) return value;
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
