"use client";

/**
 * AdminSidebar — the dark navigation rail of the studio.
 *
 * Layout contract (fixes the "text runs into the counter" bug):
 * · every nav row is a flex `justify-between`: [icon + label] left, count pill right;
 * · labels are `whitespace-nowrap truncate` — Bengali never wraps inside a rail row;
 * · live/total counts live ONLY in the `.nav-count` pill (slate-800 on slate rail) —
 *   no more raw `৬/৬` concatenations baked into the link titles;
 * · the logo header and workspace chip use p-4 / gap-3 with ellipsis, so the brand
 *   avatar and "ওকেজিএস" copy can't clip into each other.
 */
import { CloudUpload, Eye, LayoutDashboard, LogOut, X } from "lucide-react";
import { resourceMeta, studioGroups } from "@/lib/content-config";
import type { ResourceName } from "@/lib/types";
import { iconFor } from "@/lib/icons";
import { bn } from "@/lib/format";
import type { MediaConfig } from "@/lib/upload-client";

export type ResourceCount = { live: number; total: number };
export type ResourceCounts = Partial<Record<ResourceName, ResourceCount>>;

type AdminSidebarProps = {
  active: ResourceName | "overview";
  counts: ResourceCounts;
  loading: boolean;
  media: MediaConfig | null;
  mobileNav: boolean;
  onClose: () => void;
  onNavigate: (next: ResourceName | "overview") => void;
  onLogout: () => void;
};

function CountPill({ count, loading }: { count?: ResourceCount; loading: boolean }) {
  if (loading) {
    return <span className="nav-count is-loading px-2 py-0.5 rounded-full text-xs" aria-hidden="true">…</span>;
  }
  const total = count?.total ?? 0;
  const live = count?.live ?? 0;
  if (!total) {
    return <span className="nav-count is-empty px-2 py-0.5 rounded-full text-xs" title="এখনো কোনো এন্ট্রি নেই">০</span>;
  }
  return (
    <span className="nav-count px-2 py-0.5 rounded-full text-xs" title={`${bn(live)} টি প্রকাশিত · মোট ${bn(total)} টি`}>
      {bn(live)}/{bn(total)}
    </span>
  );
}

export function AdminSidebar({ active, counts, loading, media, mobileNav, onClose, onNavigate, onLogout }: AdminSidebarProps) {
  return (
    <aside className={`admin-sidebar ${mobileNav ? "is-open" : ""}`} aria-label="স্টুডিও নেভিগেশন">
      {/* Brand header — avatar + two text lines, truncate-guarded. */}
      <div className="admin-sidebar-top">
        <a href="/" className="admin-logo" title="ওকেজিএস — সাইটের হোম">
          <span className="brand-mark" aria-hidden="true"><span>অ</span></span>
          <span className="admin-logo-copy">
            <b className="truncate">ওকেজিএস</b>
            <small className="truncate">কনটেন্ট স্টুডিও</small>
          </span>
        </a>
        <button className="sidebar-close" onClick={onClose} aria-label="মেনু বন্ধ করুন"><X size={19} /></button>
      </div>

      {/* Workspace chip — school identity, same truncate rules. */}
      <div className="workspace-chip">
        <span className="workspace-avatar" aria-hidden="true">A</span>
        <span className="workspace-copy">
          <b className="truncate">ওমর কিন্ডারগার্টেন স্কুল</b>
          <small className="truncate">সব ক্লাবের তথ্য এক জায়গায়</small>
        </span>
      </div>

      <nav className="admin-nav" aria-label="প্রধান মেনু">
        <button className={active === "overview" ? "is-active" : ""} onClick={() => onNavigate("overview")} aria-current={active === "overview" ? "page" : undefined}>
          <span className="nav-item-label">
            <LayoutDashboard size={16} strokeWidth={active === "overview" ? 2.2 : 1.8} />
            <span className="whitespace-nowrap">ওভারভিউ</span>
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
                    {/* Title is just the title — the ৬/৬-style count belongs to the pill. */}
                    <span className="whitespace-nowrap truncate">{resourceMeta[resource].label}</span>
                  </span>
                  <CountPill loading={loading} count={counts[resource]} />
                </button>
              );
            })}
          </nav>
        </div>
      ))}

      <div className="sidebar-bottom">
        <div className={`media-chip ${media?.enabled ? "is-on" : "is-off"}`} title={media?.enabled ? `আপলোড: ${media.cloudName}/${media.folder}/` : "Cloudinary কনফিগ দরকার"}>
          <CloudUpload size={14} />
          <span className="min-w-0">
            <b className="truncate">{media?.enabled ? "Cloudinary সংযুক্ত" : "Cloudinary সেটআপ বাকি"}</b>
            <small className="truncate">{media?.enabled ? `${media.cloudName} · ${media.folder}/` : "ছবি আপলোডের জন্য কনফিগ দরকার"}</small>
          </span>
        </div>
        <a href="/" target="_blank" rel="noreferrer">
          <span className="nav-item-label"><Eye size={15} /><span className="whitespace-nowrap">সাইট দেখুন</span></span>
        </a>
        <button onClick={onLogout}>
          <span className="nav-item-label"><LogOut size={15} /><span className="whitespace-nowrap">প্রস্থান</span></span>
        </button>
      </div>
    </aside>
  );
}
