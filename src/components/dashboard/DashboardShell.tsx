"use client";

import { Bell, Database, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { useDashboard } from "./DashboardProvider";
import { DATA_QUALITY_LABEL } from "./meta";
import { NAV_ITEMS, isActive } from "./navigation";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen p-0 sm:p-3 lg:p-5 print:min-h-0 print:p-0">
      <div className="mx-auto flex min-h-screen max-w-380 flex-col rounded-none bg-shell sm:min-h-[calc(100vh-1.5rem)] sm:rounded-4xl lg:min-h-[calc(100vh-2.5rem)] print:min-h-0 print:rounded-none print:bg-white">
        <TopBar />
        <main id="main" className="min-w-0 flex-1 px-3 pb-5 sm:px-5 print:p-0">
          {children}
        </main>
        <SyntheticDisclaimer />
      </div>
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-full bg-card py-1.5 pr-4 pl-1.5 shadow-sm">
      <span className="grid size-9 place-items-center rounded-full bg-ink text-white" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8h18" strokeLinecap="round" />
          <path d="M3 14h7m4 0h7" strokeLinecap="round" stroke="var(--color-accent-bright)" />
          <path d="M3 20h18" strokeLinecap="round" opacity=".5" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap">Subterra Clash</span>
    </Link>
  );
}

function TopBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="relative px-3 pt-3 pb-4 sm:px-5 sm:pt-5 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <Logo />

        <nav aria-label="Primary" className="hidden rounded-full bg-card p-1.5 shadow-sm xl:block">
          <ul className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
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

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <SearchBox />
          </div>
          <AlertsMenu />
          <DatasetBadge />
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full bg-card shadow-sm xl:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="mt-3 rounded-3xl bg-card p-3 shadow-sm xl:hidden">
          <div className="mb-3 md:hidden">
            <SearchBox />
          </div>
          <nav aria-label="Mobile">
            <ul className="grid gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
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
        </div>
      )}
    </header>
  );
}

/** Searches conflicts by ID, asset or excavation; results show in the Conflicts view. */
function SearchBox() {
  const { filters, setFilters } = useDashboard();
  const router = useRouter();
  const pathname = usePathname();
  const inputId = useId();

  const goToResults = () => {
    if (pathname !== "/conflicts") router.push("/conflicts");
  };

  return (
    <form
      role="search"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        goToResults();
      }}
      className="flex h-11 items-center gap-2 rounded-full border border-line bg-card px-4 focus-within:border-accent"
    >
      <label htmlFor={inputId} className="sr-only">
        Search conflicts, assets or excavations
      </label>
      <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
      <input
        id={inputId}
        type="search"
        value={filters.query}
        onChange={(e) => setFilters({ query: e.target.value })}
        placeholder="Search conflicts…"
        className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ink-3 md:w-40 lg:w-48"
      />
    </form>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** Data-quality alerts derived from engine output and asset records. */
function AlertsMenu() {
  const { summary, dataQuality, setFilters, resetFilters } = useDashboard();
  const router = useRouter();
  const { open, setOpen, ref } = usePopover();
  const panelId = useId();

  const qualityRows = (Object.entries(dataQuality.counts) as [keyof typeof DATA_QUALITY_LABEL, number][]).filter(
    ([, n]) => n > 0,
  );
  const alertCount = summary.needsData + dataQuality.assets.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Data-quality alerts (${alertCount})`}
        className="relative grid size-11 place-items-center rounded-full bg-card shadow-sm hover:bg-sunken"
      >
        <Bell className="size-4.5" aria-hidden />
        {alertCount > 0 && (
          <span className="absolute top-2 right-2 size-2 rounded-full bg-sev-high ring-2 ring-card" aria-hidden />
        )}
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-3xl border border-line bg-card p-4 shadow-lg"
        >
          <p className="text-sm font-semibold">Data-quality alerts</p>
          <p className="mt-0.5 text-xs text-ink-3">Gaps that limit how far the results can be trusted.</p>
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between rounded-2xl bg-sunken px-3 py-2.5 text-left text-sm hover:bg-line"
            onClick={() => {
              resetFilters();
              setFilters({ severities: ["needs-data"] });
              setOpen(false);
              router.push("/conflicts");
            }}
          >
            <span>Conflicts needing more data</span>
            <span className="font-semibold tabular-nums">{summary.needsData}</span>
          </button>
          <ul className="mt-2 divide-y divide-line text-sm">
            {qualityRows.map(([issue, n]) => (
              <li key={issue} className="flex justify-between px-3 py-2">
                <span className="text-ink-2">{DATA_QUALITY_LABEL[issue]}</span>
                <span className="tabular-nums">
                  {n} {n === 1 ? "asset" : "assets"}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/reports#data-quality"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-full border border-line px-3 py-2 text-center text-sm hover:bg-sunken"
          >
            View data-quality report
          </Link>
        </div>
      )}
    </div>
  );
}

function DatasetBadge() {
  const { analysisDate } = useDashboard();
  const { open, setOpen, ref } = usePopover();
  const panelId = useId();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex h-11 items-center gap-2 rounded-full bg-card px-3 text-sm shadow-sm hover:bg-sunken sm:px-4"
      >
        <Database className="size-4 text-accent" aria-hidden />
        <span className="hidden sm:inline">Synthetic dataset</span>
        <span className="sr-only sm:hidden">Synthetic dataset information</span>
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-3xl border border-line bg-card p-4 text-sm shadow-lg"
        >
          <p className="font-semibold">Synthetic demonstration data</p>
          <p className="mt-1 text-ink-2">
            All assets and excavations are fictional. They are not verified underground utility survey data.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
            <dt className="text-ink-3">Analysis date</dt>
            <dd className="text-right">{formatDate(analysisDate)}</dd>
            <dt className="text-ink-3">Source</dt>
            <dd className="text-right">In-repo synthetic set</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

function SyntheticDisclaimer() {
  return (
    <footer className="mx-3 mb-3 rounded-2xl border border-line bg-card px-4 py-3 text-xs text-ink-2 sm:mx-5 sm:mb-5">
      <strong className="font-semibold text-ink">Synthetic demonstration data.</strong> Not verified underground
      utility survey data. Subterra Clash provides engineering decision support only; it does not approve or reject
      excavation permits. Always confirm utility locations on site before excavating.{" "}
      <Link href="/public" className="font-medium text-accent underline-offset-2 hover:underline">
        Open the public works portal
      </Link>
    </footer>
  );
}
