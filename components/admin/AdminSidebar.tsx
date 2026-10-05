"use client";

/**
 * AdminSidebar — the dark navigation rail of the studio (English UI).
 *
 * Layout contract (fixes the “text runs into the counter” and the
 * “rows pile up on each other” bugs):
 * · every nav row is a flex `justify-between`: [icon + label] left, count pill
 *   right — the pill carries `ml-auto shrink-0`, so it is always right-aligned
 *   and never collides with the label;
 * · labels are `whitespace-nowrap truncate` (with a `title` so the full text is
 *   still readable when it ellipsises) and single-line;
 * · live/total counts live ONLY in the `.nav-count` pill (slate-800 on the slate
 *   rail) — no raw `6/6` concatenations baked into link titles;
 * · the rail is `sticky top-0 h-screen overflow-y-auto` with a thin scrollbar:
 *   it is the scroll container, and every section inside it is `flex:0 0 auto`
 *   (see `.admin-sidebar > *`), so a long menu scrolls cleanly instead of
 *   squeezing the section boxes and letting their rows overlap;
 * · section groups are separated by 1rem and their headers occupy a fixed 20px
 *   box (`height/line-height: 20px`), so SCIENCE FAIR / CLUB INFORMATION /
 *   INSTITUTION can never collide with the links below them;
 * · the logo header and workspace chip use p-4 / gap-3 with ellipsis.
 */
import Link from "next/link";
import { CloudUpload, Eye, LayoutDashboard, Power, Settings2, Users, X } from "lucide-react";
import { resourceMeta, studioGroups } from "@/lib/content-config";
import type { ResourceName } from "@/lib/types";
import { iconFor } from "@/lib/icons";
import { en } from "@/lib/format";
import type { MediaConfig } from "@/lib/upload-client";
import { LogoutButton } from "@/components/admin/LogoutButton";

export type ResourceCount = { live: number; total: number };
export type ResourceCounts = Partial<Record<ResourceName, ResourceCount>>;

type AdminSidebarProps = {
  active: ResourceName | "overview";
  counts: ResourceCounts;
  loading: boolean;
  media: MediaConfig | null;
  mobileNav: boolean;
  /** SuperAdmins get the system section (settings, maintenance, accounts). */
  isSuperAdmin: boolean;
  userName: string;
  userEmail: string;
  onClose: () => void;
  onNavigate: (next: ResourceName | "overview") => void;
};

function CountPill({ count, loading }: { count?: ResourceCount; loading: boolean }) {
  // `ml-auto` + `shrink-0` keep the badge pinned to the right edge of the flex row
  // and at its own size: a long label ellipsises, it never slides under the pill.
  const base = "nav-count ml-auto shrink-0 px-2 py-0.5 rounded-full text-xs";
  if (loading) {
    return <span className={`${base} is-loading`} aria-hidden="true">…</span>;
  }
  const total = count?.total ?? 0;
  const live = count?.live ?? 0;
  if (!total) {
    return <span className={`${base} is-empty`} title="No entries yet">0</span>;
  }
  return (
    <span className={base} title={`${en(live)} published · ${en(total)} total`}>
      {en(live)}/{en(total)}
    </span>
  );
}

export function AdminSidebar({
  active,
  counts,
  loading,
  media,
  mobileNav,
  isSuperAdmin,
  userName,
  userEmail,
  onClose,
  onNavigate,
}: AdminSidebarProps) {
  return (
    <aside className={`admin-sidebar ${mobileNav ? "is-open" : ""}`} aria-label="Studio navigation">
      {/* Brand header — avatar + two text lines, truncate-guarded. */}
      <div className="admin-sidebar-top">
        <Link href="/" className="admin-logo" title="OKGS — site home">
          <span className="brand-mark" aria-hidden="true"><span>O</span></span>
          <span className="admin-logo-copy">
            <b className="truncate">OKGS</b>
            <small className="truncate">Content Studio</small>
          </span>
        </Link>
        <button className="sidebar-close" onClick={onClose} aria-label="Close the menu"><X size={19} /></button>
      </div>

      {/* Signed-in account — role and email, same truncate rules. */}
      <div className="workspace-chip">
        <span className="workspace-avatar" aria-hidden="true">{isSuperAdmin ? "S" : "A"}</span>
        <span className="workspace-copy">
          <b className="truncate">{userName || "Administrator"}</b>
          <small className="truncate">{isSuperAdmin ? "SuperAdmin" : "Admin"} · {userEmail}</small>
        </span>
      </div>

      <nav className="admin-nav" aria-label="Main menu">
        <button className={active === "overview" ? "is-active" : ""} onClick={() => onNavigate("overview")} aria-current={active === "overview" ? "page" : undefined}>
          <span className="nav-item-label">
            <LayoutDashboard size={16} strokeWidth={active === "overview" ? 2.2 : 1.8} />
            <span className="whitespace-nowrap">Overview</span>
          </span>
        </button>
      </nav>

      {studioGroups.map((group) => (
        <div className="admin-nav-group" key={group.id}>
          <p className="admin-nav-label">{group.label}</p>
          <nav className="admin-nav" aria-label={group.label}>
            {group.resources.map((resource) => {
              const Icon = iconFor(resourceMeta[resource].icon);
              const isActive = active === resource;
              return (
                <button key={resource} className={isActive ? "is-active" : ""} onClick={() => onNavigate(resource)} aria-current={isActive ? "page" : undefined}>
                  <span className="nav-item-label">
                    <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                    <span className="whitespace-nowrap truncate" title={resourceMeta[resource].label}>{resourceMeta[resource].label}</span>
                  </span>
                  <CountPill loading={loading} count={counts[resource]} />
                </button>
              );
            })}
          </nav>
        </div>
      ))}

      {/* SuperAdmin-only system section — real pages, not studio panels. */}
      {isSuperAdmin ? (
        <div className="admin-nav-group admin-nav-system">
          <p className="admin-nav-label">System</p>
          <nav className="admin-nav" aria-label="System pages">
            <Link href="/admin/settings">
              <span className="nav-item-label">
                <Settings2 size={16} />
                <span className="whitespace-nowrap">Site Settings</span>
              </span>
            </Link>
            <Link href="/admin/maintenance">
              <span className="nav-item-label">
                <Power size={16} />
                <span className="whitespace-nowrap">Maintenance Switch</span>
              </span>
            </Link>
            <Link href="/admin/users">
              <span className="nav-item-label">
                <Users size={16} />
                <span className="whitespace-nowrap">Accounts</span>
              </span>
            </Link>
          </nav>
        </div>
      ) : null}

      <div className="sidebar-bottom">
        <div className={`media-chip ${media?.enabled ? "is-on" : "is-off"}`} title={media?.enabled ? `Uploads: ${media.cloudName}/${media.folder}/` : "Cloudinary configuration needed"}>
          <CloudUpload size={14} />
          <span className="min-w-0">
            <b className="truncate">{media?.enabled ? "Cloudinary connected" : "Cloudinary not set up"}</b>
            <small className="truncate">{media?.enabled ? `${media.cloudName} · ${media.folder}/` : "Image uploads need configuration"}</small>
          </span>
        </div>
        <Link href="/" target="_blank" rel="noreferrer">
          <span className="nav-item-label"><Eye size={15} /><span className="whitespace-nowrap">View live site</span></span>
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}
