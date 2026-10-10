"use client";

import { useMemo, useState } from "react";
import { BellRing, CheckCheck, ChevronDown } from "lucide-react";
import { bn, en, formatDate, formatDateEn } from "@/lib/format";
import { useApi, postJson } from "@/components/sf/console/ui";
import type { AnnouncementCategory } from "@/lib/announcement-category";
import { plainPreview, RichText } from "@/components/portal/RichText";
import "@/components/portal/announcements.css";

/**
 * The notices & updates feed. Used by the student dashboard (Bangla) and by the
 * fair console (English): the chrome follows `lang`, the notice text is always
 * exactly what the office wrote.
 *
 * Read state is stored on the account, so the unread badge follows the person
 * across devices. Opening an item marks it read; "mark all read" clears the rest.
 */

interface FeedItem {
  key: string;
  id: string;
  announcement_kind: string;
  category: AnnouncementCategory;
  label: string;
  urgent: boolean;
  title: string;
  body: string;
  published_at: string;
  read: boolean;
}

interface FeedResponse {
  announcements: FeedItem[];
  unread: number;
  counts: Record<AnnouncementCategory, { total: number; unread: number }>;
}

type Filter = "all" | "unread" | AnnouncementCategory;

const copy = {
  bn: {
    title: "ঘোষণা ও নোটিশ",
    subtitle: "বিজ্ঞান মেলা, নোটিশ ও আপডেট এক জায়গায়",
    filters: { all: "সব", unread: "অপঠিত", science_fair: "বিজ্ঞান মেলা", notice: "নোটিশ", update: "আপডেট" } as Record<Filter, string>,
    markAll: "সব পড়া হয়েছে",
    unreadLabel: "অপঠিত",
    newBadge: "নতুন",
    urgent: "জরুরি",
    less: "সংক্ষেপ",
    today: "আজ",
    yesterday: "গতকাল",
    loading: "ঘোষণা লোড হচ্ছে…",
    showAll: "সব ঘোষণা দেখুন",
    showLess: "কম দেখুন",
    empty: "এখন কোনো ঘোষণা নেই।",
    caughtUp: "সব ঘোষণা পড়া হয়েছে — চমৎকার!",
    emptyFilter: "এই বিভাগে কোনো ঘোষণা নেই।",
    failed: "ঘোষণা আনা যায়নি।",
    dateOf: (value: string) => formatDate(value, "short"),
    count: (value: number) => bn(value),
  },
  en: {
    title: "Notices & updates",
    subtitle: "Science fair, notices and updates in one place",
    filters: { all: "All", unread: "Unread", science_fair: "Science Fair", notice: "Notice", update: "Update" } as Record<Filter, string>,
    markAll: "Mark all read",
    unreadLabel: "Unread",
    newBadge: "New",
    urgent: "Urgent",
    less: "Show less",
    today: "Today",
    yesterday: "Yesterday",
    loading: "Loading notices…",
    showAll: "Show all notices",
    showLess: "Show fewer",
    empty: "No notices right now.",
    caughtUp: "You're all caught up.",
    emptyFilter: "Nothing in this category.",
    failed: "Could not load notices.",
    dateOf: (value: string) => formatDateEn(value, "short"),
    count: (value: number) => en(value),
  },
} as const;

const categories: AnnouncementCategory[] = ["science_fair", "notice", "update"];
/** Items shown before "show all", so the dashboard's dues and pass stay in reach. */
const PREVIEW_COUNT = 6;

/** "আজ" / "গতকাল" for the last two days, otherwise the calendar date. */
function dayLabel(value: string, text: (typeof copy)["bn"] | (typeof copy)["en"]) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (days === 0) return text.today;
  if (days === 1) return text.yesterday;
  return text.dateOf(value);
}

export function PortalAnnouncements({ lang = "bn" }: { lang?: "bn" | "en" }) {
  const text = copy[lang];
  const { data, loading, error } = useApi<FeedResponse>("/api/portal/announcements");
  const [filter, setFilter] = useState<Filter>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [locallyRead, setLocallyRead] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => data?.announcements ?? [], [data]);
  const isRead = (item: FeedItem) => item.read || locallyRead.has(item.key);
  const unreadTotal = items.filter((item) => !isRead(item)).length;

  const visible = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "unread") return !isRead(item);
    return item.category === filter;
  });

  const countsFor = (category: AnnouncementCategory) => {
    const scoped = items.filter((item) => item.category === category);
    return { total: scoped.length, unread: scoped.filter((item) => !isRead(item)).length };
  };

  async function markRead(keys: string[]) {
    if (!keys.length) return;
    setLocallyRead((previous) => new Set([...previous, ...keys]));
    await postJson("/api/portal/announcements", { keys }).catch(() => null);
  }

  function toggle(item: FeedItem) {
    setOpenKey((current) => (current === item.key ? null : item.key));
    if (!isRead(item)) void markRead([item.key]);
  }

  async function markAllVisible() {
    setBusy(true);
    await markRead(visible.filter((item) => !isRead(item)).map((item) => item.key));
    setBusy(false);
  }

  if (loading && !data) {
    return (
      <section className="ann" aria-busy="true">
        <p className="ann-empty">{text.loading}</p>
      </section>
    );
  }
  if (error && !data) return <section className="ann"><p className="ann-empty">{text.failed}</p></section>;
  if (!items.length) return null;

  return (
    <section className="ann" id="student-notices">
      <header className="ann-head">
        <div className="ann-title-wrap">
          <span className="ann-bell" aria-hidden="true">
            <BellRing size={18} />
            {unreadTotal > 0 ? <span className="ann-bell-badge">{text.count(unreadTotal)}</span> : null}
          </span>
          <div>
            <h2>{text.title}</h2>
            <p>{text.subtitle}</p>
          </div>
        </div>
        {unreadTotal > 0 ? (
          <button type="button" className="ann-markall" onClick={() => void markAllVisible()} disabled={busy}>
            <CheckCheck size={15} /> {text.markAll}
          </button>
        ) : null}
      </header>

      <div className="ann-filters" role="tablist" aria-label={text.title}>
        {(["all", ...categories, "unread"] as Filter[]).map((option) => {
          const active = filter === option;
          const count = option === "all" ? { total: items.length, unread: unreadTotal } : option === "unread" ? { total: unreadTotal, unread: unreadTotal } : countsFor(option);
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={active}
              className={`ann-filter cat-${option} ${active ? "is-active" : ""}`}
              onClick={() => setFilter(option)}
            >
              <span>{text.filters[option]}</span>
              <span className="ann-count">{text.count(count.total)}</span>
              {option !== "unread" && count.unread > 0 ? <span className="ann-unread-dot" aria-label={`${text.unreadLabel}: ${text.count(count.unread)}`}>{text.count(count.unread)}</span> : null}
            </button>
          );
        })}
      </div>

      {visible.length ? (
        <>
        <ol className="ann-list">
          {(showAll ? visible : visible.slice(0, PREVIEW_COUNT)).map((item) => {
            const read = isRead(item);
            const open = openKey === item.key;
            const catLabel = text.filters[item.category];
            const preview = plainPreview(item.body);
            return (
              <li key={item.key} className={`ann-item cat-${item.category} ${read ? "is-read" : "is-unread"} ${item.urgent ? "is-urgent" : ""}`}>
                <button type="button" className="ann-item-toggle" aria-expanded={open} onClick={() => toggle(item)}>
                  <span className="ann-stripe" aria-hidden="true" />
                  <span className="ann-item-main">
                    <span className="ann-chips">
                      <span className={`ann-cat cat-${item.category}`}>{catLabel}</span>
                      {item.urgent ? <span className="ann-urgent">{text.urgent}</span> : null}
                      {!read ? <span className="ann-new">{text.newBadge}</span> : null}
                    </span>
                    <strong className="ann-item-title">{item.title}</strong>
                    <span className="ann-item-meta">
                      {dayLabel(item.published_at, text)}
                      {item.label && item.label !== catLabel ? <> · {item.label}</> : null}
                    </span>
                    {!open && preview ? <span className="ann-preview">{preview}</span> : null}
                  </span>
                  <ChevronDown className={`ann-chevron ${open ? "is-open" : ""}`} size={18} aria-hidden="true" />
                </button>
                {open ? (
                  <div className="ann-body">
                    {item.body ? <RichText source={item.body} /> : null}
                    <button type="button" className="ann-collapse" onClick={() => setOpenKey(null)}>{text.less}</button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {visible.length > PREVIEW_COUNT ? (
          <button type="button" className="ann-more" onClick={() => setShowAll((value) => !value)}>
            {showAll ? text.showLess : `${text.showAll} (${text.count(visible.length - PREVIEW_COUNT)})`}
          </button>
        ) : null}
        </>
      ) : (
        <p className="ann-empty">{unreadTotal === 0 && filter === "unread" ? text.caughtUp : text.emptyFilter}</p>
      )}
    </section>
  );
}
