"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Image as ImageIcon, Search, SlidersHorizontal, Trophy, Users, X } from "lucide-react";
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
  all: "সব ক্লাব",
  upcoming: "আসন্ন আয়োজন আছে",
  photos: "ছবি আছে",
  newcomers: "নতুন সদস্য চায়",
};

export function ClubDirectory({ summaries }: { summaries: ClubSummary[] }) {
  const [query, setQuery] = useState("");
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
      if (!needle) return true;
      const haystack = [
        item.club.name,
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
  }, [summaries, query, filter, sort]);

  return (
    <div className="directory-block">
      <div className="directory-stats">
        <div><strong>{bn(summaries.length)}</strong><span><Trophy size={13} /> টি ক্লাব</span></div>
        <div><strong>{bn(totals.events)}</strong><span><CalendarClock size={13} /> প্রকাশিত আয়োজন</span></div>
        <div><strong>{bn(totals.photos)}</strong><span><ImageIcon size={13} /> ছবি</span></div>
        <div><strong>{bn(totals.members)}</strong><span><Users size={13} /> নিবন্ধিত সদস্য</span></div>
      </div>

      <div className="directory-toolbar">
        <label className="directory-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ক্লাব, আয়োজন বা শিক্ষকের নাম লিখুন…"
            aria-label="ক্লাব খুঁজুন"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="খোঁজা বাতিল করুন"><X size={14} /></button>
          ) : null}
        </label>

        <div className="directory-filters" role="group" aria-label="ছাঁকনি">
          {(Object.keys(filterLabels) as FilterKey[]).map((key) => (
            <button key={key} type="button" className={filter === key ? "is-active" : ""} onClick={() => setFilter(key)}>
              {filterLabels[key]}
            </button>
          ))}
        </div>

        <label className="directory-sort">
          <SlidersHorizontal size={14} />
          <span className="sr-only">সাজান</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            {(Object.keys(sortLabels) as SortKey[]).map((key) => (
              <option key={key} value={key}>{sortLabels[key]}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="directory-count" aria-live="polite">
        {results.length ? `${bn(results.length)} টি ক্লাব দেখানো হচ্ছে` : "কিছু পাওয়া যায়নি"}
      </p>

      {results.length ? (
        <div className="directory-grid">
          {results.map((summary) => <ClubCard key={summary.club.id} summary={summary} variant="row" />)}
        </div>
      ) : (
        <div className="directory-empty">
          <Search size={22} />
          <p>‘{query}’ খোঁজা কিছু মেলে না। অন্য শব্দ চেষ্টা করুন বা ছাঁকনি সরান।</p>
          <button type="button" className="button button-green button-small" onClick={() => { setQuery(""); setFilter("all"); }}>
            সব ক্লাব দেখুন
          </button>
        </div>
      )}
    </div>
  );
}
