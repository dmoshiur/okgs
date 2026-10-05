"use client";

/**
 * DashboardMetrics — the overview header block of the studio (English UI).
 *
 * · metric counts sit on the SAME baseline as their label (icon | label | value),
 *   right-anchored with tabular numerals;
 * · the club coverage list is a real 6-column grid (name + events/posts/photos/
 *   members/achievements, `items-center`), so counts can never scatter onto
 *   implicit grid rows;
 * · the “recently changed” list renders `.recent-row` buttons with space-y-3
 *   rhythm and a `list-style:none` ul.
 */
import {
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  CloudUpload,
  Image as ImageIcon,
  Settings2,
  Trophy,
  Users,
} from "lucide-react";
import { resourceMeta } from "@/lib/content-config";
import type { ResourceName } from "@/lib/types";
import { iconFor } from "@/lib/icons";
import { en, formatDateEn, plural } from "@/lib/format";
import type { MediaConfig } from "@/lib/upload-client";

type Item = Record<string, any> & { id: string };

/** Every club's side-collections, in the order the coverage table shows them. */
export const clubChildResources: ResourceName[] = ["club_events", "club_posts", "club_gallery", "club_members", "club_achievements"];

export type CoverageEntry = { club: Item; counts: Record<string, number>; draft: boolean };
export type OverviewItem = { key: string; resource: ResourceName; item: Item };

/* ------------------------------------------------------------- metrics --- */

export type MetricStats = {
  loading: boolean;
  clubs: number;
  activeClubs: number;
  upcoming: number;
  totalEvents: number;
  cloudinaryImages: number;
  mediaNote: string;
  drafts: number;
  live: number;
};

function Metric({ icon: Icon, label, value, note, tone }: { icon: any; label: string; value: string; note: string; tone: string }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-top">
        <span className="metric-icon" aria-hidden="true"><Icon size={17} /></span>
        <span className="metric-label whitespace-nowrap truncate">{label}</span>
        <strong className="metric-value tabular-nums">{value}</strong>
      </div>
      <small className="metric-note break-words">{note}</small>
    </div>
  );
}

export function MetricGrid({ stats }: { stats: MetricStats }) {
  const pending = (value: string) => (stats.loading ? "—" : value);
  return (
    <div className="metric-grid">
      <Metric icon={Trophy} label="Clubs" value={pending(en(stats.clubs))} note={`${en(stats.activeClubs)} active in the directory`} tone="green" />
      <Metric icon={CalendarDays} label="Upcoming events" value={pending(en(stats.upcoming))} note={`${en(stats.totalEvents)} events in total`} tone="gold" />
      <Metric icon={ImageIcon} label="Cloudinary images" value={pending(en(stats.cloudinaryImages))} note={stats.mediaNote} tone="lilac" />
      <Metric icon={Settings2} label="Draft entries" value={pending(en(stats.drafts))} note={`${en(stats.live)} published`} tone="peach" />
    </div>
  );
}

/* ---------------------------------------------------- coverage progress --- */

export function ClubCoverageTable({
  coverage,
  loading,
  onOpenClubs,
  onOpenClubResource,
}: {
  coverage: CoverageEntry[];
  loading: boolean;
  onOpenClubs: () => void;
  onOpenClubResource: (resource: ResourceName, slug: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">Club coverage</span>
          <h2>How complete every club profile is</h2>
        </div>
        <button className="panel-link whitespace-nowrap" onClick={onOpenClubs}>All clubs <ChevronRight size={14} /></button>
      </div>
      {coverage.length ? (
        <div className="coverage-scroll">
          <div className="coverage-table" role="table" aria-label="Amount of content per club">
            <div className="coverage-head" role="row">
              <span role="columnheader">Club</span>
              {clubChildResources.map((resource) => (
                <span key={resource} role="columnheader" title={resourceMeta[resource].label}>
                  {resourceMeta[resource].singular}
                </span>
              ))}
            </div>
            {loading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div className="coverage-row" key={index} aria-hidden="true">
                    <span className="coverage-name"><span className="coverage-dot" style={{ background: "var(--line)" }} />…</span>
                    {clubChildResources.map((resource) => <span key={resource} className="coverage-cell is-zero">…</span>)}
                  </div>
                ))
              : coverage.map(({ club, counts, draft }) => (
                  <div className="coverage-row" key={club.id} role="row">
                    <span className="coverage-name" role="rowheader">
                      <span className="coverage-dot" style={{ background: club.accent || "var(--brand)" }} aria-hidden="true" />
                      <button onClick={onOpenClubs} className="truncate whitespace-nowrap">
                        {String(club.name || club.slug || "—")}
                        {draft ? <small className="coverage-draft-flag">Draft</small> : null}
                      </button>
                    </span>
                    {clubChildResources.map((resource) => {
                      const value = counts[resource] || 0;
                      return (
                        <button
                          key={resource}
                          role="cell"
                          className={`coverage-cell ${value ? "tabular-nums" : "is-zero"}`}
                          onClick={() => onOpenClubResource(resource, String(club.slug))}
                          title={`${club.name} — ${resourceMeta[resource].label}: ${plural(value, "entry", "entries")}`}
                        >
                          {en(value)}
                        </button>
                      );
                    })}
                  </div>
                ))}
          </div>
        </div>
      ) : (
        <div className="empty-dashboard">
          <Trophy size={20} />
          <p>No club has been created yet.</p>
          <button className="admin-primary-button" onClick={onOpenClubs}>Add a club <ChevronRight size={14} /></button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------- recent list ----- */

export function RecentActivityList({ items, onOpen }: { items: OverviewItem[]; onOpen: (resource: ResourceName) => void }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">Recent</span>
          <h2>The most recently changed content</h2>
        </div>
      </div>
      <ul className="recent-list space-y-3">
        {items.map(({ key, resource, item }) => {
          const thumb = String(item.image_url || item.cover_image_url || item.photo_url || item.certificate_url || "");
          return (
            <li key={key}>
              <button className="recent-row" onClick={() => onOpen(resource)}>
                <span className="recent-thumb" aria-hidden="true">
                  {thumb ? <img src={thumb} alt="" loading="lazy" /> : (() => { const Icon = iconFor(resourceMeta[resource].icon); return <Icon size={15} />; })()}
                </span>
                <span className="recent-copy min-w-0">
                  {/* line-clamp-1 + break-words: DB titles never collide with the meta line. */}
                  <b className="line-clamp-1 break-words leading-normal">{item.title || item.name || item.caption || "Untitled"}</b>
                  <small className="whitespace-nowrap truncate">{resourceMeta[resource].label} · {formatDateEn(item.updated_at, "short") || "—"}{item.is_active === false ? " · Draft" : ""}</small>
                </span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </li>
          );
        })}
        {!items.length ? <li><p className="empty-note">Content will appear here.</p></li> : null}
      </ul>
    </section>
  );
}

/* ------------------------------------------------- quick actions + media --- */

function QuickAction({ icon: Icon, label, detail, onClick }: { icon: any; label: string; detail: string; onClick: () => void }) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span className="quick-icon" aria-hidden="true"><Icon size={16} /></span>
      <span className="min-w-0">
        <b className="block truncate leading-normal">{label}</b>
        <small className="block truncate leading-normal">{detail}</small>
      </span>
      <ArrowUpRightInline />
    </button>
  );
}

function ArrowUpRightInline() {
  // Tiny wrapper so the icon keeps a fixed footprint inside the flex row.
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>;
}

export function QuickActionsPanel({ onCreateClub, onCreateEvent, onNavigate }: { onCreateClub: () => void; onCreateEvent: () => void; onNavigate: (next: ResourceName) => void }) {
  return (
    <section className="panel quick-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">Quick actions</span>
          <h2>Start right away</h2>
        </div>
        <CirclePlus size={19} className="panel-muted-icon" />
      </div>
      <QuickAction icon={Trophy} label="Add a new club" detail="Name, colours, photos and profile" onClick={onCreateClub} />
      <QuickAction icon={CalendarDays} label="Publish an event" detail="Date, venue and registration link" onClick={onCreateEvent} />
      <QuickAction icon={ImageIcon} label="Upload photos" detail="Drag any image into its field" onClick={() => onNavigate("club_gallery")} />
      <QuickAction icon={Users} label="Committee list" detail="Students and advisers" onClick={() => onNavigate("club_members")} />
      <QuickAction icon={Settings2} label="School information" detail="Phone, address, logo" onClick={() => onNavigate("settings")} />
    </section>
  );
}

export function CloudinaryPanel({ media, missingCover, onOpenClubs }: { media: MediaConfig | null; missingCover: number; onOpenClubs: () => void }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">Image upload</span>
          <h2>Cloudinary status</h2>
        </div>
        <CloudUpload size={19} className={media?.enabled ? "is-ok" : "is-warn"} />
      </div>
      {media?.enabled ? (
        <>
          <p className="panel-copy">Connected — <code>{media.cloudName}</code>, folder <code>{media.folder}/</code>, preset <code>{media.uploadPreset}</code></p>
          <p className="panel-copy">Open any image field and drag a file in, or paste with <kbd>Ctrl</kbd>+<kbd>V</kbd>. The link is written into the site automatically.</p>
        </>
      ) : (
        <>
          <p className="panel-copy">Not configured yet — you can still work with pasted image links.</p>
          <ol className="panel-steps space-y-2">
            <li>Add <code>CLOUDINARY_CLOUD_NAME</code> and <code>CLOUDINARY_UPLOAD_PRESET</code> to <code>.env.local</code></li>
            <li>Cloudinary Dashboard → Settings → Upload presets → create an <b>Unsigned</b> preset</li>
            <li>Restart the server and uploads start working</li>
          </ol>
        </>
      )}
      {missingCover ? (
        <button className="panel-alert" onClick={onOpenClubs}>
          {plural(missingCover, "club has", "clubs have")} no cover image — add one <ChevronRight size={14} />
        </button>
      ) : (
        <p className="panel-ok"><Check size={13} /> Every club has a cover image.</p>
      )}
    </section>
  );
}
