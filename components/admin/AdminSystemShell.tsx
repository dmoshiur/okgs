import Link from "next/link";
import { ArrowUpRight, Gauge, Power, Settings2, ShieldCheck, Users } from "lucide-react";
import type { AdminSession } from "@/lib/auth";
import { LogoutButton } from "@/components/admin/LogoutButton";

/**
 * AdminSystemShell — the frame for the SuperAdmin-only system pages
 * (Site Settings, Maintenance Switch, Accounts).
 *
 * It reuses the studio's grid contract, so the sidebar and the content scroll
 * independently:
 *
 *   .admin-shell  → 100dvh, overflow hidden
 *   .admin-sidebar → its own overflow-y:auto rail
 *   .admin-main   → flex column, .admin-content scrolls underneath a sticky bar
 */
const systemNav = [
  { href: "/admin", label: "Content Studio", icon: Gauge, key: "studio" },
  { href: "/admin/settings", label: "Site Settings", icon: Settings2, key: "settings", superOnly: true },
  { href: "/admin/maintenance", label: "Maintenance Switch", icon: Power, key: "maintenance", superOnly: true },
  { href: "/admin/users", label: "Accounts", icon: Users, key: "users", superOnly: true },
];

export function AdminSystemShell({
  session,
  active,
  title,
  description,
  actions,
  children,
  banner,
}: {
  session: AdminSession;
  active: "settings" | "maintenance" | "users";
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Optional full-width notice rendered above the page body (e.g. site is down). */
  banner?: React.ReactNode;
}) {
  const items = systemNav.filter((item) => !item.superOnly || session.isSuperAdmin);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="System navigation">
        <div className="admin-sidebar-top">
          <Link href="/admin" className="admin-logo" title="Back to the content studio">
            <span className="brand-mark" aria-hidden="true">
              <span>O</span>
            </span>
            <span className="admin-logo-copy">
              <b className="truncate">OKGS</b>
              <small className="truncate">Admin Studio</small>
            </span>
          </Link>
        </div>

        <div className="workspace-chip">
          <span className="workspace-avatar" aria-hidden="true">
            {session.isSuperAdmin ? "S" : "A"}
          </span>
          <span className="workspace-copy">
            <b className="truncate">{session.name}</b>
            <small className="truncate">{session.isSuperAdmin ? "SuperAdmin" : "Administrator"}</small>
          </span>
        </div>

        <nav className="admin-nav" aria-label="System pages">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            return (
              <Link key={item.key} href={item.href} className={isActive ? "is-active" : ""} aria-current={isActive ? "page" : undefined}>
                <span className="nav-item-label">
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="whitespace-nowrap truncate">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-system-note">
          <ShieldCheck size={14} />
          <p>These pages are SuperAdmin-only. Changes apply sitewide the moment they are saved.</p>
        </div>

        <div className="sidebar-bottom">
          <Link href="/" target="_blank" rel="noreferrer">
            <span className="nav-item-label">
              <ArrowUpRight size={15} />
              <span className="whitespace-nowrap">View live site</span>
            </span>
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb" aria-label="Breadcrumb">
            <span className="whitespace-nowrap">System</span>
            <span aria-hidden="true">›</span>
            <strong className="truncate whitespace-nowrap">{title}</strong>
          </div>
          <div className="admin-top-actions">
            {actions}
            <Link className="topbar-preview" href="/admin">
              <Gauge size={13} /> Content Studio
            </Link>
          </div>
        </header>

        <div className="admin-content">
          {banner}
          <div className="admin-page-heading">
            <div className="min-w-0">
              <p className="admin-kicker">
                <ShieldCheck size={14} />
                <span className="whitespace-nowrap">SuperAdmin control</span>
              </p>
              <h1>{title}</h1>
              <p className="heading-sub leading-relaxed">{description}</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
