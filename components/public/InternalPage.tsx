import Link from "next/link";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({
  items,
  className = "",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  const trail: BreadcrumbItem[] = [{ label: "হোম", href: "/" }, ...items];

  return (
    <nav className={`internal-breadcrumb${className ? ` ${className}` : ""}`} aria-label="আপনি আছেন">
      <ol>
        {trail.map((item, index) => {
          const isCurrent = index === trail.length - 1;
          return (
            <li key={`${item.href || "current"}-${item.label}-${index}`}>
              {index > 0 ? <span className="internal-breadcrumb-separator" aria-hidden="true">/</span> : null}
              {item.href && !isCurrent ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={isCurrent ? "page" : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function InternalPageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`internal-page-shell${className ? ` ${className}` : ""}`}>{children}</div>;
}

export function CTAGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`internal-cta-group${className ? ` ${className}` : ""}`}>{children}</div>;
}

export function InternalPageHeader({
  breadcrumb,
  eyebrow,
  title,
  description,
  actions,
  actionsClassName = "",
  children,
  className = "",
}: {
  breadcrumb?: BreadcrumbItem[];
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  actionsClassName?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`internal-page-header${className ? ` ${className}` : ""}`}>
      <div className="page-width internal-page-header-inner">
        {breadcrumb?.length ? <Breadcrumb items={breadcrumb} /> : null}
        {eyebrow ? <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="internal-page-description">{description}</p> : null}
        {actions ? <CTAGroup className={actionsClassName}>{actions}</CTAGroup> : null}
        {children}
      </div>
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  intro,
  action,
  titleId,
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  titleId?: string;
  className?: string;
}) {
  return (
    <header className={`internal-section-header${className ? ` ${className}` : ""}`}>
      <div className="internal-section-title">
        <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
      </div>
      {intro ? <p className="internal-section-intro section-intro club-section-intro">{intro}</p> : null}
      {action ? <div className="internal-section-action">{action}</div> : null}
    </header>
  );
}

export function ContentSection({
  children,
  className = "",
  eyebrow,
  title,
  intro,
  action,
  titleId,
}: {
  children: ReactNode;
  className?: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  titleId?: string;
}) {
  return (
    <section className={`internal-content-section${className ? ` ${className}` : ""}`} aria-labelledby={titleId}>
      <SectionHeader className="section-heading" eyebrow={eyebrow} title={title} intro={intro} action={action} titleId={titleId} />
      {children}
    </section>
  );
}

export function EmptyState({
  message = "এখনও কোনো তথ্য প্রকাশিত হয়নি।",
  className = "",
}: {
  message?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`internal-empty-state${className ? ` ${className}` : ""}`} role="status">
      <p>{message}</p>
    </div>
  );
}

export function LoadingState({ label = "পাতা লোড হচ্ছে" }: { label?: string }) {
  return (
    <main className="internal-loading-page" role="status" aria-label={label}>
      <div className="page-width">
        <div className="internal-loading-crumb" />
        <div className="internal-loading-eyebrow" />
        <div className="internal-loading-title" />
        <div className="internal-loading-copy" />
        <div className="internal-loading-grid" aria-hidden="true">
          <div className="internal-loading-card" />
          <div className="internal-loading-card" />
          <div className="internal-loading-card" />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </main>
  );
}
