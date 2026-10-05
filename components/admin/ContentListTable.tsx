"use client";

/**
 * ContentListTable — the manager's data list (one row per entry).
 *
 * Fixed here:
 * · header and rows share ONE explicit column template with `align-items: center`,
 *   and the whole table scrolls inside `.content-table` at narrow widths instead of
 *   the shell overflowing (min-width on rows + overflow-x on the wrapper);
 * · column captions are single-line, nowrap, Bengali-safe (no uppercase tracking);
 * · dynamic DB values (title / subtitle / details) go through `truncate` +
 *   `break-words`/`line-clamp-1` rules so any stray long slug or URL can never
 *   push the row grid apart.
 */
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { fieldsFor, resourceMeta } from "@/lib/content-config";
import type { ResourceName } from "@/lib/types";
import { iconFor } from "@/lib/icons";
import { formatDate } from "@/lib/format";

export type ContentItem = Record<string, any> & { id: string };

function hasField(resource: ResourceName, name: string) {
  return fieldsFor(resource).some((field) => field.name === name);
}

type RowHandlers = {
  onEdit: (item: ContentItem) => void;
  onDuplicate: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
  onToggle: (item: ContentItem) => void;
  onMove: (item: ContentItem, direction: -1 | 1) => void;
};

type ContentListTableProps = {
  resource: ResourceName;
  rows: ContentItem[];
  loading: boolean;
  clubs: ContentItem[];
  busyRowId: string;
  reorderable: boolean;
  hasFilters: boolean;
  onCreate: () => void;
  onClearFilters: () => void;
} & RowHandlers;

function titleOf(resource: ResourceName, item: ContentItem) {
  const field = resourceMeta[resource].titleField;
  return String(item[field] || item.title || item.name || item.label || item.caption || "শিরোনামহীন");
}

function subtitleOf(resource: ResourceName, item: ContentItem) {
  if (resource === "settings") return item.description || String(item.value || "").slice(0, 80);
  if (resource === "clubs") return item.tagline || item.description;
  if (resource === "gallery" || resource === "club_gallery") return item.event_name || item.caption;
  return String(item.description || item.excerpt || item.body || item.tagline || item.value || item.venue || "").slice(0, 110);
}

function thumbOf(item: ContentItem) {
  return String(item.image_url || item.cover_image_url || item.photo_url || item.certificate_url || "");
}

function previewHref(resource: ResourceName, item: ContentItem) {
  if (resource === "clubs") return `/clubs/${item.slug}`;
  if (resource === "news") return `/news/${item.slug}`;
  if (resource === "club_posts") return `/clubs/${item.club_slug}/posts/${item.slug}`;
  if (item.club_slug) return `/clubs/${item.club_slug}/${resource.replace("club_", "")}`;
  return "/";
}

function ContentRow({
  resource,
  item,
  clubs,
  busy,
  reorderable,
  isFirst,
  isLast,
  onEdit,
  onToggle,
  onDelete,
  onDuplicate,
  onMove,
}: { resource: ResourceName; item: ContentItem; clubs: ContentItem[]; busy: boolean; reorderable: boolean; isFirst: boolean; isLast: boolean } & RowHandlers) {
  const Icon = iconFor(resourceMeta[resource].icon);
  const thumb = thumbOf(item);
  const isLive = item.is_active !== false;
  const detail =
    resource === "clubs"
      ? String(item.domain || item.slug || "").replace(/^https?:\/\//, "")
      : item.category || item.type || item.kind || item.role || item.event_type || item.level || item.field_kind || "—";
  const clubName = item.club_slug ? String(clubs.find((club) => club.slug === item.club_slug)?.name ?? item.club_slug) : "";
  const dateValue = item.published_at || item.event_date || item.date || item.achieved_on || item.taken_on || item.updated_at;
  const canPreview = previewHref(resource, item) !== "/";

  return (
    <div className={`content-row ${isLive ? "" : "is-draft"}`}>
      <span className="row-title">
        <span className={`row-icon row-${resource}`} aria-hidden="true">
          {thumb ? <img src={thumb} alt="" loading="lazy" /> : <Icon size={16} />}
        </span>
        <span className="min-w-0">
          <b className="truncate whitespace-nowrap" title={titleOf(resource, item)}>{titleOf(resource, item)}</b>
          <small className="truncate break-words leading-normal">
            {clubName ? `${clubName} · ` : ""}{subtitleOf(resource, item) || "—"}{hasField(resource, "slug") && item.slug ? ` · /${item.slug}` : ""}
          </small>
        </span>
      </span>
      <span className="row-details whitespace-nowrap" title={String(detail)}>{detail}</span>
      <button
        type="button"
        className={`status-pill ${isLive ? "" : "is-draft"}`}
        onClick={() => onToggle(item)}
        disabled={busy}
        title={isLive ? "খসড়াতে নিতে ক্লিক করুন" : "প্রকাশ করতে ক্লিক করুন"}
      >
        <i />{busy ? "…" : isLive ? "প্রকাশিত" : "খসড়া"} {isLive ? <Eye size={11} /> : <EyeOff size={11} />}
      </button>
      <span className="row-date tabular-nums whitespace-nowrap">{dateValue ? formatDate(dateValue, "short") : "—"}</span>
      <span className="row-actions">
        {reorderable ? (
          <>
            <button onClick={() => onMove(item, -1)} disabled={isFirst || busy} aria-label="উপরে নিন"><ArrowUp size={14} /></button>
            <button onClick={() => onMove(item, 1)} disabled={isLast || busy} aria-label="নিচে নিন"><ArrowDown size={14} /></button>
          </>
        ) : null}
        {canPreview ? (
          <a href={previewHref(resource, item)} target="_blank" rel="noreferrer" aria-label="সাইটে দেখুন"><Eye size={15} /></a>
        ) : null}
        <button onClick={() => onDuplicate(item)} aria-label="নকল তৈরি করুন"><Copy size={15} /></button>
        <button onClick={() => onEdit(item)} aria-label="সম্পাদনা করুন"><Pencil size={15} /></button>
        <button className="is-danger" onClick={() => onDelete(item)} aria-label="মুছে ফেলুন"><Trash2 size={15} /></button>
      </span>
    </div>
  );
}

export function ContentListTable({ resource, rows, loading, clubs, busyRowId, reorderable, hasFilters, onCreate, onClearFilters, onEdit, onDuplicate, onDelete, onToggle, onMove }: ContentListTableProps) {
  const visibleIds = rows.map((row) => String(row.id));
  return (
    <section className="content-panel">
      <div className="content-table">
        <div className="content-table-head" role="row">
          <span role="columnheader">{resourceMeta[resource].singular}</span>
          <span role="columnheader">{resource === "clubs" ? "স্লাগ" : "বিভাগ / ধরন"}</span>
          <span role="columnheader">অবস্থা</span>
          <span role="columnheader">হালনাগাদ</span>
          <span role="columnheader" aria-label="কাজ" />
        </div>
        {loading ? (
          <div className="table-loading" role="status" aria-label="লোড হচ্ছে"><span /><span /><span /></div>
        ) : rows.length ? (
          rows.map((item, index) => (
            <ContentRow
              key={item.id}
              resource={resource}
              item={item}
              clubs={clubs}
              busy={busyRowId === item.id}
              reorderable={reorderable}
              isFirst={index === 0}
              isLast={index === rows.length - 1}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onToggle={onToggle}
              onMove={onMove}
            />
          ))
        ) : (
          <div className="empty-dashboard content-empty">
            <span className="empty-orb">{(() => { const Icon = iconFor(resourceMeta[resource].icon); return <Icon size={23} />; })()}</span>
            <h3>{hasFilters ? "এই ছাঁকনিতে কিছু নেই" : `এখনো ${resourceMeta[resource].label} নেই`}</h3>
            <p>{hasFilters ? "ছাঁকনি সরিয়ে দেখুন, অথবা নতুন এন্ট্রি যোগ করুন।" : "প্রথম এন্ট্রিটি যোগ করলেই সাইটে দেখা যাবে।"}</p>
            <div className="empty-actions">
              <button className="topbar-preview" onClick={onCreate}><Plus size={14} /> নতুন {resourceMeta[resource].singular}</button>
              {hasFilters ? (
                <button className="topbar-preview" onClick={onClearFilters}><X size={14} /> ছাঁকনি সরান</button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
