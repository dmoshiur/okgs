"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Images, Search, SlidersHorizontal, Trophy, Users, X } from "lucide-react";
import type { ClubSummary } from "@/lib/club-data";
import { ClubCard } from "@/components/public/ClubCard";
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
  all: "সব ধরন",
  upcoming: "আসন্ন আয়োজন আছে",
  photos: "ছবি আছে",
  newcomers: "নতুন সদস্য চায়",
};

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

  return (
    <div className="directory-block">
      <div className="directory-stats">
        <div><strong>{bn(summaries.length)}</strong><span><Trophy size={13} aria-hidden /> টি ক্লাব</span></div>
        <div><strong>{bn(totals.events)}</strong><span><CalendarClock size={13} aria-hidden /> প্রকাশিত আয়োজন</span></div>
        <div><strong>{bn(totals.photos)}</strong><span><Images size={13} aria-hidden /> ছবি</span></div>
        <div><strong>{bn(totals.members)}</strong><span><Users size={13} aria-hidden /> নিবন্ধিত সদস্য</span></div>
      </div>

      <div className="directory-toolbar">
        <div className="directory-toolbar-row">
          <label className="directory-search">
            <Search size={16} aria-hidden />
            <span className="sr-only">ক্লাব খুঁজুন</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ক্লাব, আয়োজন বা শিক্ষকের নাম লিখুন…"
              type="search"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="খোঁজা বাতিল করুন"><X size={14} aria-hidden /></button>
            ) : null}
          </label>

          <label className="directory-sort">
            <SlidersHorizontal size={14} aria-hidden />
            <span className="sr-only">সাজান</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                <option key={key} value={key}>{sortLabels[key]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-row" role="group" aria-label="ক্লাব নির্বাচন">
          <button
            type="button"
            className={`filter-pill ${clubSlug === "all" ? "is-on" : ""}`}
            aria-pressed={clubSlug === "all"}
            onClick={() => setClubSlug("all")}
          >
            সব ক্লাব
          </button>
          {summaries.map((summary) => (
            <button
              key={summary.club.id}
              type="button"
              className={`filter-pill ${clubSlug === summary.club.slug ? "is-on" : ""}`}
              aria-pressed={clubSlug === summary.club.slug}
              onClick={() => setClubSlug(summary.club.slug)}
            >
              <span className="filter-code">{summary.club.short_code || summary.club.slug}</span>
              <span className="filter-note" aria-hidden>·</span>
              {summary.club.name}
            </button>
          ))}
        </div>

        <div className="filter-row" role="group" aria-label="অতিরিক্ত ছাঁকনি">
          {(Object.keys(filterLabels) as FilterKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`filter-pill ${filter === key ? "is-on" : ""}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {filterLabels[key]}
            </button>
          ))}
          {clubSlug !== "all" || filter !== "all" || query ? (
            <button type="button" className="filter-pill" onClick={reset}>
              <X size={13} aria-hidden /> ছাঁকনি মুছুন
            </button>
          ) : null}
        </div>
      </div>

      <p className="directory-count" aria-live="polite">
        {results.length ? `${bn(results.length)} টি ক্লাব দেখানো হচ্ছে` : "কিছু পাওয়া যায়নি"}
      </p>

      {results.length ? (
        <div className="directory-grid">
          {results.map((summary) => <ClubCard key={summary.club.id} summary={summary} />)}
        </div>
      ) : (
        <div className="directory-empty">
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
