"use client";

import dynamic from "next/dynamic";

/** three.js needs the DOM and is heavy, so the 3D view is loaded only in the browser, on demand. */
export const ClientUnderground3D = dynamic(() => import("./Underground3DView").then((m) => m.Underground3DView), {
  ssr: false,
  loading: () => <Viewer3DLoading />,
});

export function Viewer3DLoading() {
  return (
    <div className="grid h-full w-full place-items-center bg-sunken text-sm text-ink-3" role="status">
      Loading 3D view…
    </div>
  );
}
