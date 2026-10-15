import { CalendarRange, FileText, LayoutGrid, Map, TriangleAlert, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/map", label: "Utility Map", icon: Map },
  { href: "/conflicts", label: "Conflicts", icon: TriangleAlert },
  { href: "/schedule", label: "Excavation Schedule", icon: CalendarRange },
  { href: "/reports", label: "Reports", icon: FileText },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
