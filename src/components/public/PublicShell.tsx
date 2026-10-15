"use client";

import { CalendarClock, FlaskConical, LayoutGrid, ListChecks, Map, Menu, ShieldAlert, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isActive } from "@/components/dashboard/navigation";
import { formatDate } from "@/lib/format";
import { usePublicData } from "./PublicDataProvider";

const PUBLIC_NAV: readonly { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/public", label: "Overview", icon: LayoutGrid },
  { href: "/public/map", label: "Works map", icon: Map },
  { href: "/public/works", label: "Planned works", icon: ListChecks },
  { href: "/public/conflicts", label: "Conflict findings", icon: ShieldAlert },
  { href: "/public/timeline", label: "Timeline & notices", icon: CalendarClock },
];

// "/public" is the portal root, so it must match exactly like "/" does in the dashboard.
const navActive = (pathname: string, href: string) => (href === "/public" ? pathname === href : isActive(pathname, href));

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen p-0 sm:p-3 lg:p-5">
      <div className="mx-auto flex min-h-screen max-w-380 flex-col rounded-none bg-shell sm:min-h-[calc(100vh-1.5rem)] sm:rounded-4xl lg:min-h-[calc(100vh-2.5rem)]">
        <DemoBanner />
        <PublicTopBar />
        <main id="main" className="min-w-0 flex-1 px-3 pb-5 sm:px-5">
          {children}
        </main>
        <PublicFooter />
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="flex items-start gap-2 rounded-none bg-ink px-4 py-2.5 text-xs text-white sm:rounded-t-4xl sm:px-6">
      <FlaskConical className="mt-px size-4 shrink-0 text-accent-bright" aria-hidden />
      <p>
        <strong className="font-semibold">Demonstration portal.</strong> Every work, date and finding shown here is fictional
        synthetic data. It is not real public information and is not connected to any live government system.
      </p>
    </div>
  );
}

function PublicLogo() {
  return (
    <Link href="/public" className="flex items-center gap-2.5 rounded-full bg-card py-1.5 pr-4 pl-1.5 shadow-sm">
      <span className="grid size-9 place-items-center rounded-full bg-accent text-white" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8h18" strokeLinecap="round" />
          <path d="M3 14h7m4 0h7" strokeLinecap="round" />
          <path d="M3 20h18" strokeLinecap="round" opacity=".5" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight whitespace-nowrap">Public Works Portal</span>
        <span className="block text-[11px] text-ink-3">Subterra Clash</span>
      </span>
    </Link>
  );
}

function PublicTopBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="relative px-3 pt-3 pb-4 sm:px-5 sm:pt-5">
      <div className="flex items-center justify-between gap-3">
        <PublicLogo />
        <nav aria-label="Public portal" className="hidden rounded-full bg-card p-1.5 shadow-sm lg:block">
          <ul className="flex items-center gap-0.5">
            {PUBLIC_NAV.map((item) => {
              const active = navActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                      active ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full bg-card shadow-sm lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="public-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>

      {menuOpen && (
        <nav id="public-menu" aria-label="Public portal (menu)" className="mt-3 rounded-3xl bg-card p-3 shadow-sm lg:hidden">
          <ul className="grid gap-1">
            {PUBLIC_NAV.map((item) => {
              const active = navActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${
                      active ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}

function PublicFooter() {
  const { asOf } = usePublicData();
  return (
    <footer className="mx-3 mb-3 grid gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-xs text-ink-2 sm:mx-5 sm:mb-5">
      <p>
        <strong className="font-semibold text-ink">Synthetic demonstration data.</strong> Information is generated from
        fictional records as of {formatDate(asOf)}. It is not live and is not official public works information.
      </p>
      <p>
        Findings come from an automated screening of records, not from engineer-verified site checks. A work with no
        finding is not confirmed safe. Underground utility locations and details are not published here, to protect
        critical infrastructure. Always contact the responsible organisation and check on site before digging.
      </p>
    </footer>
  );
}
