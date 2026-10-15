"use client";

import { useDashboard, type SpatialView } from "@/components/dashboard/DashboardProvider";
import { UtilityMapCard } from "@/components/map/UtilityMapCard";
import { Underground3DCard } from "./Underground3DCard";

const OPTIONS: { value: SpatialView; label: string }[] = [
  { value: "2d", label: "2D Map" },
  { value: "3d", label: "3D Underground" },
];

function ViewSwitcher() {
  const { spatialView, setSpatialView } = useDashboard();
  return (
    <div className="inline-flex rounded-full bg-sunken p-1" role="group" aria-label="Spatial view">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={spatialView === o.value}
          onClick={() => setSpatialView(o.value)}
          className={`rounded-full px-3 py-1.5 text-xs whitespace-nowrap ${
            spatialView === o.value ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface SpatialViewCardProps {
  className?: string;
  heightClass?: string;
  showDetails?: boolean;
  title2d?: string;
  title3d?: string;
}

/** 2D map or 3D underground view, switched by a shared selector; both use the same dashboard selection. */
export function SpatialViewCard({ className, heightClass, showDetails, title2d, title3d }: SpatialViewCardProps) {
  const { spatialView } = useDashboard();
  return spatialView === "3d" ? (
    <Underground3DCard
      className={className}
      heightClass={heightClass}
      showDetails={showDetails}
      title={title3d}
      viewSwitcher={<ViewSwitcher />}
    />
  ) : (
    <UtilityMapCard
      className={className}
      mapHeightClass={heightClass}
      showDetails={showDetails}
      title={title2d}
      viewSwitcher={<ViewSwitcher />}
    />
  );
}
