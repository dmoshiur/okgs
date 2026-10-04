import { ArrowUpRight, CalendarClock, ExternalLink, FlaskConical, MapPin, Megaphone, Phone, Ticket, Trophy, Users } from "lucide-react";
import type { PublicContent } from "@/lib/types";
import { fairContent, readFlag, readSetting } from "@/lib/site";
import { bn, formatDate, formatDayNumber, formatMonthName, relativeDay } from "@/lib/format";
import { toLines } from "@/lib/content-config";
import { Countdown } from "@/components/public/Countdown";
import { SmartImage } from "@/components/public/Media";
import { IconByName } from "@/lib/icons";

const tabs = [
  { href: "#overview", label: "পরিচিতি" },
  { href: "#categories", label: "ক্যাটাগরি" },
  { href: "#schedule", label: "রুটিন" },
  { href: "#collections", label: "সংগ্রহ" },
  { href: "#register", label: "নিবন্ধন" },
  { href: "#fair-contact", label: "যোগাযোগ" },
];

/**
 * The science-fair microsite — used both at /fair/<slug> and, when the school
 * flips the switch, as the whole homepage.
 */
export interface FairTickerItem {
  id: string;
  message: string;
  kind: string;
  category?: string;
  name?: string;
  class_level?: string;
  section?: string;
}

export function FairSite({
  content,
  fair,
  compact = false,
  tickers = [],
}: {
  content: PublicContent;
  fair: PublicContent["fairs"][number];
  compact?: boolean;
  tickers?: FairTickerItem[];
}) {
  const { categories, schedule, collections } = fairContent(content, fair);
  const settings = content.settings;
  const registrationOpen = readFlag(settings, "fair_registration_open", true);
  const siteName = readSetting(settings, "short_name", "OKGS");
  const schoolName = readSetting(settings, "site_name");
  const poster = fair.poster_url || fair.cover_image_url;
  const featuredCollections = collections.filter((item) => item.is_featured).slice(0, 3);
  const counts = {
    categories: categories.length,
    collections: collections.length,
    passes: 0,
  };

  return (
    <div className="v2 fair-page">
      {/* ------------------------------------------------ hero */}
      <section className="fair-mega">
        <div className="v2-wrap fair-mega-inner">
          <div>
            <p className="fair-mega-kicker">
              <FlaskConical size={15} /> {fair.edition ? `${fair.edition} · ` : ""}
              {fair.venue || "স্কুল ক্যাম্পাস"}
            </p>
            <h1 className="fair-mega-title">
              {fair.name}
              {fair.tagline ? <span>{fair.tagline}</span> : null}
            </h1>
            <div className="fair-mega-facts">
              {fair.starts_on ? (
                <span>
                  <CalendarClock size={13} style={{ display: "inline", verticalAlign: -2 }} /> {formatDate(fair.starts_on)}
                  {fair.ends_on && fair.ends_on !== fair.starts_on ? ` – ${formatDate(fair.ends_on)}` : ""}
                </span>
              ) : null}
              {fair.intro_time ? <span>{fair.intro_time}</span> : null}
              {fair.city ? (
                <span>
                  <MapPin size={13} style={{ display: "inline", verticalAlign: -2 }} /> {fair.city}
                </span>
              ) : null}
              <span>{fair.fee ? `ফি ${bn(fair.fee)} টাকা` : "নিবন্ধন ফ্রি"}</span>
            </div>
            <div className="fair-mega-actions">
              <a className="v2-btn" href="#register">
                <Ticket size={17} /> {registrationOpen ? "নিবন্ধন করুন" : "নিবন্ধন বন্ধ"}
              </a>
              <a className="v2-btn v2-btn-ghost" href="#schedule">
                <CalendarClock size={16} /> পুরো রুটিন
              </a>
              <a className="v2-btn v2-btn-ghost" href="#collections">
                <Trophy size={16} /> সংগ্রহ দেখুন
              </a>
            </div>
          </div>
          <div style={{ display: "grid", gap: 18 }}>
            {fair.logo_url ? <SmartImage className="fair-mega-logo" src={fair.logo_url} alt={fair.name} transform={{ width: 220 }} /> : null}
            {fair.starts_on ? <Countdown date={fair.starts_on} label="উল্টো গোনা" /> : null}
            {featuredCollections.length ? (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                <strong>নির্বাচিত সংগ্রহ:</strong> {featuredCollections.map((item) => item.title).join(" · ")}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ ticker */}
      {tickers.length ? (
        <section className="fair-ticker" aria-label="মেলার ঘোষণা">
          <span className="fair-ticker-label">
            <Megaphone size={15} /> ঘোষণা
          </span>
          <div className="fair-ticker-track">
            <div className="fair-ticker-run">
              {[...tickers, ...tickers].map((item, index) => (
                <span className={`fair-ticker-item kind-${item.kind || "notice"}`} key={`${item.id}-${index}`}>
                  {item.message}
                  {item.name ? <em> — {item.name}</em> : null}
                  {item.class_level ? (
                    <small>
                      {item.class_level}
                      {item.section ? ` · শাখা ${item.section}` : ""}
                    </small>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------ tabs */}
      <nav className="fair-tabs" aria-label="মেলার অংশ">
        <div className="v2-wrap fair-tabs-inner">
          {tabs.map((tab) => (
            <a className="fair-tab" href={tab.href} key={tab.href}>
              {tab.label}
            </a>
          ))}
          <a className="fair-tab" href="/clubs">
            ক্লাবসমূহ <ArrowUpRight size={13} />
          </a>
          <a className="fair-tab" href="/sf/login">
            পোর্টাল লগইন
          </a>
        </div>
      </nav>

      {/* ------------------------------------------------ overview */}
      <section className="v2 v2-sec" id="overview">
        <div className="v2-wrap v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(250px, .65fr)" }}>
          <div>
            <div className="v2-sec-head" style={{ marginBottom: 18 }}>
              <div>
                <p className="v2-chip v2-chip-accent">মেলা সম্পর্কে</p>
                <h2>এক মঞ্চে পুরো স্কুলের বিজ্ঞান</h2>
              </div>
            </div>
            {(fair.about || fair.description || "").split(/\r?\n\s*\r?\n/).filter(Boolean).map((block, index) => (
              <p key={index} className="v2-muted" style={{ marginTop: 0 }}>{block}</p>
            ))}
            <div className="metric-grid" style={{ marginTop: 22 }}>
              <div className="metric">
                <span><FlaskConical size={14} /> ক্যাটাগরি</span>
                <strong>{bn(counts.categories)}</strong>
              </div>
              <div className="metric">
                <span><Trophy size={14} /> সংগৃহীত প্রকল্প</span>
                <strong>{bn(counts.collections)}</strong>
              </div>
              <div className="metric">
                <span><CalendarClock size={14} /> আয়োজনের দিন</span>
                <strong>{fair.starts_on && fair.ends_on ? bn(Math.max(1, Math.round((new Date(fair.ends_on).getTime() - new Date(fair.starts_on).getTime()) / 86_400_000) + 1)) : bn(1)}</strong>
              </div>
              <div className="metric">
                <span><Users size={14} /> নিবন্ধন</span>
                <strong style={{ fontSize: 20 }}>{registrationOpen ? (fair.registration_deadline ? formatDate(fair.registration_deadline) : "চলছে") : "বন্ধ"}</strong>
              </div>
            </div>
          </div>

          <aside className="v2-card" style={{ padding: 18 }}>
            {poster ? (
              <SmartImage src={poster} alt={`${fair.name} পোস্টার`} transform={{ width: 800 }} />
            ) : (
              <div className="v2-chip">পোস্টার অ্যাডমিন প্যানেল থেকে আপলোড করুন</div>
            )}
            <div style={{ display: "grid", gap: 8, marginTop: 14, fontSize: 14 }}>
              {fair.chief_guest ? <div><strong>প্রধান অতিথি:</strong> {fair.chief_guest}</div> : null}
              {fair.contact_phone ? (
                <div>
                  <strong>যোগাযোগ:</strong>{" "}
                  <a className="text-link" href={`tel:${fair.contact_phone}`}><Phone size={13} /> {fair.contact_phone}</a>
                </div>
              ) : null}
              {fair.contact_email ? (
                <div>
                  <strong>ইমেইল:</strong> <a className="text-link" href={`mailto:${fair.contact_email}`}>{fair.contact_email}</a>
                </div>
              ) : null}
              {fair.registration_deadline ? <div><strong>নিবন্ধনের শেষ:</strong> {formatDate(fair.registration_deadline)}</div> : null}
              {!compact ? (
                <a className="v2-btn v2-btn-sm" href="/sf/login" style={{ marginTop: 6 }}>
                  শিক্ষার্থী/শিক্ষক পোর্টাল <ArrowUpRight size={14} />
                </a>
              ) : (
                <a className="v2-btn v2-btn-sm v2-btn-ghost" href="/" style={{ marginTop: 6 }}>
                  স্কুল সাইটে ফিরুন <ExternalLink size={14} />
                </a>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* ------------------------------------------------ categories */}
      <section className="v2 v2-sec" id="categories" style={{ background: "var(--okgs-surface-2)" }}>
        <div className="v2-wrap">
          <div className="v2-sec-head">
            <div>
              <p className="v2-chip v2-chip-accent">আটটি ক্যাটাগরি</p>
              <h2>কোন বিষয়ে প্রতিযোগিতা</h2>
              <p>প্রতিটি ক্যাটাগরির নিয়ম, দলের আকার, কোন শ্রেণির জন্য — সবই কনসোল থেকে সম্পাদনা করা যায়।</p>
            </div>
          </div>
          <div className="cat-grid">
            {categories.map((category) => (
              <article className="cat-card" key={category.id} style={{ ["--cat-color" as string]: category.color || fair.accent }}>
                <span className="cat-icon">
                  <IconByName name={category.icon || "FlaskConical"} size={20} />
                </span>
                <h3>{category.name}</h3>
                <p className="v2-muted" style={{ marginTop: 0, fontSize: 14 }}>{category.description}</p>
                <div className="pill-row" style={{ marginTop: 10 }}>
                  <span className="badge-soft">{category.kind}</span>
                  {category.classes ? <span className="badge-soft">{category.classes}</span> : null}
                  <span className="badge-soft">{bn(category.team_size || 1)} জন/দল</span>
                  <span className="badge-soft">{category.fee ? `${bn(category.fee)} টাকা` : "ফ্রি"}</span>
                </div>
                {toLines(category.rules).length ? (
                  <ul className="v2-muted" style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 13 }}>
                    {toLines(category.rules).slice(0, 4).map((rule, index) => (
                      <li key={index}>{rule}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
            {!categories.length ? <p className="v2-muted">ক্যাটাগরি এখনো যোগ করা হয়নি।</p> : null}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ schedule */}
      <section className="v2 v2-sec" id="schedule">
        <div className="v2-wrap">
          <div className="v2-sec-head">
            <div>
              <p className="v2-chip v2-chip-accent">সময়সূচি</p>
              <h2>দিন-ভিত্তিক রুটিন</h2>
              <p>{fair.starts_on ? `${formatDate(fair.starts_on)}${fair.ends_on && fair.ends_on !== fair.starts_on ? ` – ${formatDate(fair.ends_on)}` : ""}` : ""}</p>
            </div>
          </div>
          <div className="v2-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {groupByDay(schedule).map(([day, items]) => (
              <div className="v2-card" key={day} style={{ padding: 20 }}>
                <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <span style={{ width: 52, height: 52, borderRadius: 14, background: "color-mix(in srgb, var(--okgs-accent) 14%, var(--okgs-surface))", color: "var(--okgs-accent)", display: "grid", placeItems: "center", fontWeight: 700 }}>
                    <b style={{ fontSize: 19, lineHeight: 1 }}>{formatDayNumber(day)}</b>
                  </span>
                  <div>
                    <strong style={{ display: "block" }}>{formatMonthName(day, "long")}</strong>
                    <span className="v2-muted" style={{ fontSize: 13 }}>{relativeDay(day) || formatDate(day)}</span>
                  </div>
                </header>
                <ul className="timeline">
                  {items.map((item) => (
                    <li key={item.id}>
                      <time>{timeOf(item.starts_at)}{item.ends_at ? ` – ${timeOf(item.ends_at)}` : ""}</time>
                      <h3 style={{ margin: "3px 0 4px", fontSize: 17 }}>{item.title}</h3>
                      <p className="v2-muted" style={{ margin: 0, fontSize: 13.5 }}>{item.description}</p>
                      <div className="pill-row" style={{ marginTop: 8 }}>
                        {item.venue ? <span className="badge-soft"><MapPin size={11} /> {item.venue}</span> : null}
                        {item.host ? <span className="badge-soft">{item.host}</span> : null}
                        <span className="badge-soft">{item.kind}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!schedule.length ? <p className="v2-muted">রুটিন এখনো প্রকাশিত হয়নি।</p> : null}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ collections */}
      <section className="v2 v2-sec" id="collections" style={{ background: "var(--okgs-surface-2)" }}>
        <div className="v2-wrap">
          <div className="v2-sec-head">
            <div>
              <p className="v2-chip v2-chip-accent">মেলার সংগ্রহশালা</p>
              <h2>প্রকল্প ও সংগ্রহের আর্কাইভ</h2>
              <p>মেলার প্রতিটি প্রকল্প এখানে জমা থাকে — ছবি, দল, শ্রেণি, ফলাফল ও সনদ সহ। কনসোল থেকে নতুন সংগ্রহ যোগ করুন।</p>
            </div>
            <span className="v2-chip"><Trophy size={14} /> মোট {bn(collections.length)} টি</span>
          </div>
          <div className="collection-grid">
            {collections.map((item) => (
              <article className="collection-card" key={item.id}>
                {item.image_url ? <SmartImage src={item.image_url} alt={item.title} transform={{ width: 700, fit: "cover" }} /> : null}
                <div className="collection-body">
                  <div className="pill-row">
                    <span className={`badge-soft ${item.status === "বিজয়ী" ? "badge-win" : ""}`}>{item.status}</span>
                    {item.position ? <span className="badge-soft badge-win">{item.position}</span> : null}
                    {item.category ? <span className="badge-soft">{item.category}</span> : null}
                  </div>
                  <h3>{item.title}</h3>
                  <p className="v2-muted" style={{ margin: 0, fontSize: 13.5 }}>{item.description}</p>
                  <div className="v2-muted" style={{ fontSize: 12.5, marginTop: "auto" }}>
                    {[item.student_name, item.class_level, item.section ? `শাখা ${item.section}` : ""].filter(Boolean).join(" · ")}
                    {item.team_members ? <div>দল: {item.team_members}</div> : null}
                  </div>
                </div>
              </article>
            ))}
            {!collections.length ? <p className="v2-muted">এখনো কোনো সংগ্রহ যোগ করা হয়নি।</p> : null}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ register */}
      <section className="v2 v2-sec" id="register">
        <div className="v2-wrap">
          <div className="v2-card" style={{ padding: "28px 26px", display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }}>
            <div>
              <p className="v2-chip v2-chip-accent"><Ticket size={14} /> নিবন্ধন {registrationOpen ? "চলছে" : "বন্ধ"}</p>
              <h2 style={{ margin: "12px 0 8px" }}>{registrationOpen ? "আপনার দল নিবন্ধন করুন" : "নিবন্ধন এখন বন্ধ"}</h2>
              <p className="v2-muted" style={{ margin: 0, maxWidth: "64ch" }}>
                {registrationOpen
                  ? `শিক্ষার্থীরা নিজের স্কুল আইডি নম্বর অথবা ইমেইল দিয়ে পোর্টালে লগইন করে ক্যাটাগরি বেছে নিন, ফি জমা দিন এবং সঙ্গে সঙ্গে QR পাস পেয়ে যান। শিক্ষক/অ্যাডমিন চাইলে স্কুল থেকেও নিবন্ধন করে দিতে পারেন।`
                  : "পরবর্তী নিবন্ধনের সময় এখানেই ঘোষণা দেওয়া হবে।"}
              </p>
              <div className="fair-mega-facts" style={{ marginTop: 14 }}>
                <span>ধাপ ১: /sf/login এ লগইন</span>
                <span>ধাপ ২: ক্যাটাগরি ও দল নির্বাচন</span>
                <span>ধাপ ৩: QR পাস ডাউনলোড</span>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <a className="v2-btn" href="/sf/login">
                <Users size={16} /> শিক্ষার্থী লগইন
              </a>
              <a className="v2-btn v2-btn-ghost" href="/sf/login?next=/sf">
                শিক্ষক / অ্যাডমিন
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ contact */}
      <section className="v2 v2-sec" id="fair-contact" style={{ background: "var(--okgs-surface-2)" }}>
        <div className="v2-wrap">
          <div className="v2-sec-head">
            <div>
              <p className="v2-chip v2-chip-accent">যোগাযোগ</p>
              <h2>{schoolName || siteName} — বিজ্ঞান মেলা কমিটি</h2>
              <p>{fair.venue ? `${fair.venue} · ` : ""}{fair.city}</p>
            </div>
          </div>
          <div className="v2-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div className="v2-card" style={{ padding: 18 }}>
              <h3 style={{ marginTop: 0 }}>ফোন</h3>
              <p className="v2-muted" style={{ margin: 0 }}>
                {fair.contact_phone || readSetting(settings, "phone", "01711857205")}
                <br />
                হেল্পলাইন: {readSetting(settings, "phone_secondary", "05725-56351-52")}
              </p>
            </div>
            <div className="v2-card" style={{ padding: 18 }}>
              <h3 style={{ marginTop: 0 }}>ইমেইল</h3>
              <p className="v2-muted" style={{ margin: 0 }}>{fair.contact_email || readSetting(settings, "email", "okgs2003@gmail.com")}</p>
            </div>
            <div className="v2-card" style={{ padding: 18 }}>
              <h3 style={{ marginTop: 0 }}>ঠিকানা</h3>
              <p className="v2-muted" style={{ margin: 0 }}>{readSetting(settings, "address", "কালাই সদর, জয়পুরহাট")}</p>
            </div>
            <div className="v2-card" style={{ padding: 18 }}>
              <h3 style={{ marginTop: 0 }}>অনলাইনে</h3>
              <p className="v2-muted" style={{ margin: 0 }}>
                {readSetting(settings, "facebook_url") ? <a className="text-link" href={readSetting(settings, "facebook_url")} target="_blank" rel="noreferrer noopener">ফেসবুক পেজ <ArrowUpRight size={13} /></a> : null}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function timeOf(value: string) {
  const match = /(\d{2}):(\d{2})/.exec(String(value ?? ""));
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${bn(twelve)}:${bn(minute)} ${suffix}`;
}

function groupByDay(items: PublicContent["fair_schedule"]): [string, PublicContent["fair_schedule"]][] {
  const map = new Map<string, PublicContent["fair_schedule"]>();
  for (const item of items) {
    const day = String(item.starts_at || "").slice(0, 10) || "দিন নির্ধারিত হয়নি";
    const bucket = map.get(day);
    if (bucket) bucket.push(item);
    else map.set(day, [item]);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}
