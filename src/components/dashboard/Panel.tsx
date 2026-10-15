import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  /** Heading level for document outline. */
  as?: "h2" | "h3";
}

/** White rounded card used for every dashboard section. */
export function Panel({
  title,
  subtitle,
  icon: Icon,
  actions,
  className = "",
  bodyClassName = "",
  children,
  as: Heading = "h2",
}: PanelProps) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-3xl border border-line bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)] ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon && (
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-line text-ink-2">
              <Icon className="size-4" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <Heading className="text-[17px] font-semibold tracking-tight text-ink">{title}</Heading>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={`min-h-0 flex-1 px-5 pb-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line bg-sunken px-4 py-6 text-center">
      {Icon && <Icon className="size-5 text-ink-3" aria-hidden />}
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {children && <div className="max-w-sm text-[13px] text-ink-3">{children}</div>}
    </div>
  );
}
