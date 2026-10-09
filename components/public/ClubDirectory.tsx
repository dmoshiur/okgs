"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Globe, Images, Search, SlidersHorizontal, Trophy, Users, X } from "lucide-react";
import type { ClubSummary } from "@/lib/club-data";
import { ClubCard } from "@/components/public/ClubCard";
import { SmartImage } from "@/components/public/Media";
import { bn } from "@/lib/format";

type SortKey = "order" | "name" | "events" | "photos";
type FilterKey = "all" | "upcoming" | "photos" | "newcomers";

const sortLabels: Record<SortKey, string> = {
  order: "নির্ধারিত ক্রম",
  name: "নাম অনুযায়ী",
  events: "আয়োজন অনুযায়ী",
  photos: "ছবি অনুযায়ী",
};

const filterLabels: Record<FilterKey, string> = {
  all: "সব ক্লাব",
  upcoming: "আসন্ন আয়োজন আছে",
  photos: "ছবি আছে",
  newcomers: "নতুন সদস্য চায়",
};

/**
 * The club directory: search, filter, sort — then a card per club with two
 * clear destinations, one of which is always the club's own subdomain site.
 */
export function ClubDirectory({ summaries }: { summaries: ClubSummary[] }) {
  const [query, setQuery] = useState("");
  const [clubSlug, setClubSlug] = useState("all");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("order");

  const totals = useMemo(
    () =>
      summaries.reduce(
        (accumulator, item) => ({
          events: accumulator.events + item.counts.events,
          members: accumulator.members + (Number(item.club.member_count) || 0),
          photos: accumulator.photos + item.counts.gallery,
          achievements: accumulator.achievements + item.counts.achievements,
        }),
        { events: 0, members: 0, photos: 0, achievements: 0 },
      ),
    [summaries],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let rows = summaries.filter((item) => {
      if (clubSlug !== "all" && item.club.slug !== clubSlug) return false;
      if (!needle) return true;
      const haystack = [
        item.club.name,
        item.club.name_en,
        item.club.short_code,
        item.club.tagline,
        item.club.description,
        item.club.objectives,
        item.club.meeting_day,
        item.club.meeting_place,
        item.club.coordinator,
        item.siteLabel,
        item.nextEvent?.title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    if (filter === "upcoming") rows = rows.filter((item) => Boolean(item.nextEvent));
    if (filter === "photos") rows = rows.filter((item) => item.counts.gallery > 0);
    if (filter === "newcomers") rows = rows.filter((item) => Boolean(item.club.join_info));

    const sorted = [...rows];
    if (sort === "name") sorted.sort((a, b) => a.club.name.localeCompare(b.club.name, "bn"));
    if (sort === "events") sorted.sort((a, b) => b.counts.events - a.counts.events);
    if (sort === "photos") sorted.sort((a, b) => b.counts.gallery - a.counts.gallery);
    if (sort === "order") sorted.sort((a, b) => a.club.sort_order - b.club.sort_order);
    return sorted;
  }, [summaries, query, clubSlug, filter, sort]);

  const reset = () => {
    setQuery("");
    setClubSlug("all");
    setFilter("all");
  };

  const filtered = clubSlug !== "all" || filter !== "all" || Boolean(query);

  return (
    <div className="hub">
      <dl className="hub-stats">
        <div>
          <dt><Trophy size={14} aria-hidden /> ক্লাব</dt>
          <dd>{bn(summaries.length)}</dd>
        </div>
        <div>
          <dt><CalendarClock size={14} aria-hidden /> প্রকাশিত আয়োজন</dt>
          <dd>{bn(totals.events)}</dd>
        </div>
        <div>
          <dt><Images size={14} aria-hidden /> ছবি</dt>
          <dd>{bn(totals.photos)}</dd>
        </div>
        <div>
          <dt><Users size={14} aria-hidden /> নিবন্ধিত সদস্য</dt>
          <dd>{bn(totals.members)}</dd>
        </div>
      </dl>

      <div className="hub-toolbar">
        <div className="hub-toolbar-row">
          <label className="hub-search">
            <Search size={16} aria-hidden />
            <span className="sr-only">ক্লাব খুঁজুন</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ক্লাব, আয়োজন, শিক্ষক বা সাবডোমেইন লিখুন…"
              type="search"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="খোঁজা বাতিল করুন"><X size={14} aria-hidden /></button>
            ) : null}
          </label>

          <label className="hub-sort">
            <SlidersHorizontal size={14} aria-hidden />
            <span className="sr-only">সাজান</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                <option key={key} value={key}>{sortLabels[key]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="hub-pills" role="group" aria-label="ক্লাব নির্বাচন">
          <button
            type="button"
            className={`hub-pill${clubSlug === "all" ? " is-on" : ""}`}
            aria-pressed={clubSlug === "all"}
            onClick={() => setClubSlug("all")}
          >
            সব ক্লাব
          </button>
          {summaries.map((summary) => (
            <button
              key={summary.club.id}
              type="button"
              className={`hub-pill${clubSlug === summary.club.slug ? " is-on" : ""}`}
              aria-pressed={clubSlug === summary.club.slug}
              onClick={() => setClubSlug(summary.club.slug)}
            >
              {summary.club.logo_url ? (
                <SmartImage src={summary.club.logo_url} alt="" transform={{ width: 80 }} label={summary.club.short_code || summary.club.slug} />
              ) : (
                <span className="hub-pill-code">{summary.club.short_code || summary.club.slug}</span>
              )}
              {summary.club.name}
            </button>
          ))}
        </div>

        <div className="hub-pills is-soft" role="group" aria-label="অতিরিক্ত ছাঁকনি">
          {(Object.keys(filterLabels) as FilterKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`hub-pill${filter === key ? " is-on" : ""}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {filterLabels[key]}
            </button>
          ))}
          {filtered ? (
            <button type="button" className="hub-pill is-reset" onClick={reset}>
              <X size={13} aria-hidden /> ছাঁকনি মুছুন
            </button>
          ) : null}
        </div>
      </div>

      <p className="hub-count" aria-live="polite">
        {results.length ? `${bn(results.length)} টি ক্লাব দেখানো হচ্ছে` : "কিছু পাওয়া যায়নি"}
        <span className="hub-count-hint">
          <Globe size={13} aria-hidden /> প্রতিটি কার্ডের বাটন থেকে ক্লাবের নিজের সাইটে যাওয়া যায়
        </span>
      </p>

      {results.length ? (
        <div className="hub-grid">
          {results.map((summary) => <ClubCard key={summary.club.id} summary={summary} />)}
        </div>
      ) : (
        <div className="hub-empty">
          <Search size={22} aria-hidden />
          <p>‘{query}’ খোঁজা কিছু মেলে না। অন্য শব্দ চেষ্টা করুন বা ছাঁকনি সরান।</p>
          <button type="button" className="button button-primary button-small" onClick={reset}>
            সব ক্লাব দেখুন
          </button>
        </div>
      )}
    </div>
  );
}
