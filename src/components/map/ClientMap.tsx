"use client";

import dynamic from "next/dynamic";

/** MapLibre touches `window` on import, so the map is only ever loaded in the browser. */
export const ClientMap = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <MapLoading />,
});

export function MapLoading() {
  return (
    <div className="grid h-full w-full place-items-center bg-sunken text-sm text-ink-3" role="status">
      Loading map…
    </div>
  );
}
