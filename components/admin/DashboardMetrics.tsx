"use client";

/**
 * DashboardMetrics — the overview header block of the studio.
 *
 * Fixed here:
 * · metric counts now sit on the SAME baseline as their label (icon | label | value),
 *   right-anchored with tabular numerals — they used to drop onto their own grid row
 *   and read as "misplaced";
 * · the club coverage progress list is a real 6-column grid (name + আয়োজন/লেখা/ছবি/
 *   সদস্য/অর্জন, `items-center`). The old sheet declared a 3-track grid while rows
 *   emitted 6 children, which scattered the ০/২/৫ digits onto stray implicit rows;
 *   every number is a chip button now, never an isolated floating glyph;
 * · the "সাম্প্রতিক" recent-activity list renders actual `.recent-row` buttons with
 *   space-y-3 rhythm and a `list-style:none` ul — the b/small lines can't run into
 *   each other and the ul bullets can't escape the container anymore.
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
import { bn, formatDate } from "@/lib/format";
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
      <Metric icon={Trophy} label="ক্লাব" value={pending(bn(stats.clubs))} note={`${bn(stats.activeClubs)} টি সক্রিয় তালিকাভুক্ত`} tone="green" />
      <Metric icon={CalendarDays} label="আসন্ন আয়োজন" value={pending(bn(stats.upcoming))} note={`মোট ${bn(stats.totalEvents)} টি আয়োজন`} tone="gold" />
      <Metric icon={ImageIcon} label="Cloudinary ছবি" value={pending(bn(stats.cloudinaryImages))} note={stats.mediaNote} tone="lilac" />
      <Metric icon={Settings2} label="খসড়া এন্ট্রি" value={pending(bn(stats.drafts))} note={`মোট ${bn(stats.live)} টি প্রকাশিত`} tone="peach" />
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
          <span className="panel-eyebrow">ক্লাব ভরতি</span>
          <h2>প্রতিটি ক্লাবে কতটুকু তথ্য আছে</h2>
        </div>
        <button className="panel-link whitespace-nowrap" onClick={onOpenClubs}>ক্লাব তালিকা <ChevronRight size={14} /></button>
      </div>
      {coverage.length ? (
        <div className="coverage-scroll">
          <div className="coverage-table" role="table" aria-label="ক্লাবভিত্তিক তথ্যের পরিমাণ">
            <div className="coverage-head" role="row">
              <span role="columnheader">ক্লাব</span>
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
                        {draft ? <small className="coverage-draft-flag">খসড়া</small> : null}
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
                          title={`${club.name} — ${resourceMeta[resource].label}: ${bn(value)} টি`}
                        >
                          {bn(value)}
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
          <p>এখনো কোনো ক্লাব তৈরি হয়নি।</p>
          <button className="admin-primary-button" onClick={onOpenClubs}>ক্লাব যোগ করুন <ChevronRight size={14} /></button>
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
          <span className="panel-eyebrow">সাম্প্রতিক</span>
          <h2>সবচেয়ে শেষে যা বদলেছে</h2>
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
                  <b className="line-clamp-1 break-words leading-normal">{item.title || item.name || item.caption || "শিরোনামহীন"}</b>
                  <small className="whitespace-nowrap truncate">{resourceMeta[resource].label} · {formatDate(item.updated_at, "short") || "—"}{item.is_active === false ? " · খসড়া" : ""}</small>
                </span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </li>
          );
        })}
        {!items.length ? <li><p className="empty-note">কনটেন্ট এখানে দেখা যাবে।</p></li> : null}
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
          <span className="panel-eyebrow">দ্রুত কাজ</span>
          <h2>এখনি শুরু করুন</h2>
        </div>
        <CirclePlus size={19} className="panel-muted-icon" />
      </div>
      <QuickAction icon={Trophy} label="নতুন ক্লাব যোগ করুন" detail="নাম, রং, ছবি ও পরিচিতি" onClick={onCreateClub} />
      <QuickAction icon={CalendarDays} label="আয়োজন প্রকাশ করুন" detail="তারিখ, স্থান ও নিবন্ধন লিংক" onClick={onCreateEvent} />
      <QuickAction icon={ImageIcon} label="ছবি আপলোড করুন" detail="যেকোনো ছবি ঘরে ড্র্যাগ করে ছাড়ুন" onClick={() => onNavigate("club_gallery")} />
      <QuickAction icon={Users} label="কমিটির তালিকা" detail="শিক্ষার্থী ও উপদেষ্টা" onClick={() => onNavigate("club_members")} />
      <QuickAction icon={Settings2} label="স্কুলের তথ্য" detail="ফোন, ঠিকানা, লোগো" onClick={() => onNavigate("settings")} />
    </section>
  );
}

export function CloudinaryPanel({ media, missingCover, onOpenClubs }: { media: MediaConfig | null; missingCover: number; onOpenClubs: () => void }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">ছবি আপলোড</span>
          <h2>Cloudinary অবস্থা</h2>
        </div>
        <CloudUpload size={19} className={media?.enabled ? "is-ok" : "is-warn"} />
      </div>
      {media?.enabled ? (
        <>
          <p className="panel-copy">সংযুক্ত — <code>{media.cloudName}</code>, ফোল্ডার <code>{media.folder}/</code>, প্রিসেট <code>{media.uploadPreset}</code></p>
          <p className="panel-copy">যেকোনো ছবি ঘরে গিয়ে ফাইল টেনে ছেড়ে দিন বা <kbd>Ctrl</kbd>+<kbd>V</kbd> দিয়ে পেস্ট করুন। লিংক স্বয়ংক্রিয়ভাবে সাইটে বসে যাবে।</p>
        </>
      ) : (
        <>
          <p className="panel-copy">এখনো সেটআপ হয়নি। তবুও ছবির লিংক দিয়ে কাজ করা যায়।</p>
          <ol className="panel-steps space-y-2">
            <li><code>.env.local</code>-এ যোগ করুন: <code>CLOUDINARY_CLOUD_NAME</code>, <code>CLOUDINARY_UPLOAD_PRESET</code></li>
            <li>Cloudinary Dashboard → Settings → Upload presets → একটি <b>Unsigned</b> preset বানান</li>
            <li>সার্ভার রিস্টার্ট করলেই আপলোড চালু হয়ে যাবে</li>
          </ol>
        </>
      )}
      {missingCover ? (
        <button className="panel-alert" onClick={onOpenClubs}>
          {bn(missingCover)} টি ক্লাবের ছবি নেই — ছবি যোগ করুন <ChevronRight size={14} />
        </button>
      ) : (
        <p className="panel-ok"><Check size={13} /> সব ক্লাবের ছবি যুক্ত আছে।</p>
      )}
    </section>
  );
}
