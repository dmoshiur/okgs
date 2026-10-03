import { createClient, type Client, type Row, type InStatement } from "@libsql/client";
import { randomUUID } from "node:crypto";
import {
  asciiSlug,
  coerceFieldValue,
  columnSql,
  defaultValueFor,
  fieldDef,
  fieldsFor,
  normalizeRowFlags,
  resourceSchema,
  slugify,
} from "@/lib/content-config";
import type {
  Club,
  ClubAchievement,
  ClubEvent,
  ClubGalleryItem,
  ClubMember,
  ClubPost,
  PublicContent,
  ResourceName,
} from "@/lib/types";

const localDatabaseUrl = "file:local.db";

const globalForDb = globalThis as unknown as {
  okgsDb?: Client;
  okgsDbReady?: Promise<void>;
};

export const db =
  globalForDb.okgsDb ??
  createClient({
    url: process.env.TURSO_DATABASE_URL || process.env.TURSO_URL || localDatabaseUrl,
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.okgsDb = db;
}

const now = () => new Date().toISOString();

/* ---------------------------------------------------------------- *
 * Schema — generated from lib/content-config.ts so a new field only
 * ever needs to be declared once.
 * ---------------------------------------------------------------- */

export const resourceTables: Record<ResourceName, string> = {
  slides: "slides",
  notices: "notices",
  banners: "banners",
  news: "news",
  updates: "updates",
  clubs: "clubs",
  club_events: "club_events",
  club_posts: "club_posts",
  club_gallery: "club_gallery",
  club_members: "club_members",
  club_achievements: "club_achievements",
  teachers: "teachers",
  facilities: "facilities",
  gallery: "site_gallery",
  stats: "stats",
  settings: "settings",
};

export const resourceOrder: ResourceName[] = Object.keys(resourceTables) as ResourceName[];

const orderBy: Record<ResourceName, string> = {
  slides: "sort_order ASC, created_at DESC",
  notices: "published_at DESC",
  banners: "sort_order ASC, created_at DESC",
  news: "published_at DESC",
  updates: "date DESC",
  clubs: "sort_order ASC, created_at DESC",
  club_events: "event_date DESC, sort_order ASC",
  club_posts: "published_at DESC",
  club_gallery: "sort_order ASC, created_at DESC",
  club_members: "sort_order ASC, name ASC",
  club_achievements: "achieved_on DESC, sort_order ASC",
  teachers: "sort_order ASC, name ASC",
  facilities: "sort_order ASC",
  gallery: "sort_order ASC, created_at DESC",
  stats: "sort_order ASC",
  settings: "label ASC",
};

/** Extra SQL constraints that cannot be expressed by field type alone. */
const uniqueColumns: Partial<Record<ResourceName, string[]>> = {
  settings: ["key"],
};

function columnsFor(resource: ResourceName) {
  return fieldsFor(resource).map((field) => ({ name: field.name, sql: columnSql(field) }));
}

function createTableSql(resource: ResourceName) {
  const parts = ["id TEXT PRIMARY KEY"];
  for (const column of columnsFor(resource)) parts.push(`${wrap(column.name)} ${column.sql}`);
  parts.push("created_at TEXT NOT NULL DEFAULT ''", "updated_at TEXT NOT NULL DEFAULT ''");
  // Table constraints have to come after every column definition in libSQL's parser.
  for (const column of uniqueColumns[resource] ?? []) parts.push(`UNIQUE (${wrap(column)})`);
  return `CREATE TABLE IF NOT EXISTS ${wrap(resourceTables[resource])} (\n  ${parts.join(",\n  ")}\n)`;
}

/** Quote every identifier we generate (`key`, `value` … are SQL keywords). */
function wrap(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe column name: ${name}`);
  }
  return `"${name}"`;
}

export function schemaStatements() {
  return resourceOrder.map(createTableSql);
}

/* ---------------------------------------------------------------- *
 * Migrations — add columns that were introduced after a table existed.
 * ---------------------------------------------------------------- */

async function existingColumns(table: string) {
  const result = await db.execute(`PRAGMA table_info(${wrap(table)})`);
  return new Set(result.rows.map((row) => String(row.name)));
}

async function migrateTable(resource: ResourceName) {
  const table = resourceTables[resource];
  const present = await existingColumns(table);
  for (const column of columnsFor(resource)) {
    if (!present.has(column.name)) {
      await db.execute(`ALTER TABLE ${wrap(table)} ADD COLUMN ${wrap(column.name)} ${column.sql}`);
    }
  }
}

/* ---------------------------------------------------------------- *
 * Seeds — a starter set of club data so the site is never empty.
 * ---------------------------------------------------------------- */

const media = (name: string) => `/media/${name}.svg`;

const seedClubs: Array<Partial<Club> & { id: string; slug: string; name: string }> = [
  {
    id: "club-science",
    name: "ম্যাথ এন্ড সাইন্স ক্লাব",
    slug: "science",
    tagline: "গণিত ও বিজ্ঞানে কৌতূহল, অনুসন্ধানে আনন্দ",
    description: "গণিত ও বিজ্ঞানের ভয় দূর করা, কুইজ, বিজ্ঞান মেলা ও অলিম্পিয়াডের প্রস্তুতি।",
    history:
      "২০০৯ সালে কয়েকজন শিক্ষার্থী ও শিক্ষকের হাতে গড়ে ওঠে ম্যাথ এন্ড সাইন্স ক্লাব। শুরুতে শুক্রবার বিকেলে ক্লাসরুমের এক কোণে গণিতের ধাঁধা আর বিজ্ঞানের ছোট পরীক্ষা নিয়ে জড়ো হওয়া যেত। আজ ক্লাবের নিজস্ব পরীক্ষাগার, মডেল ল্যাব ও বার্ষিক ‘ART ODYSSEY’ বিজ্ঞান মেলা — যা পুরো উপজেলার শিক্ষার্থীদের আকৃষ্ট করে।",
    mission: "স্মৃতিনির্ভর পাঠের বদলে প্রশ্ন করা, পরীক্ষা করা ও নিজের হাতে আবিষ্কার করার সংস্কতি গড়ে তোলা।",
    objectives:
      "প্রতি সপ্তাহে গণিত কুইজ ও ধাঁধা আসর\nবার্ষিক বিজ্ঞান মেলা ও মডেল প্রদর্শনী\nঅলিম্পিয়াড (গণিত, পদার্থ, রসায়ন) এর নিয়মিত প্রস্তুতি\nছোট পরীক্ষা ও নিরাপদ রসায়ন কর্মশালা\nপড়ার তালিকা: বিজ্ঞান সাহিত্য ও জীবনী",
    accent: "#f59e0b",
    icon: "Atom",
    image_url: media("club-science"),
    cover_image_url: media("club-science-cover"),
    founded_year: 2009,
    member_count: 96,
    meeting_day: "প্রতি বৃহস্পতিবার",
    meeting_time: "বিকাল ৪টা – ৫টা",
    meeting_place: "বিজ্ঞানাগার, দ্বিতীয় তলা",
    coordinator: "মোঃ রহমতুল্লাহ পিকে",
    coordinator_phone: "01711-000000",
    president: "সাদিয়া আক্তার (দশম শ্রেণি)",
    email: "science.club@okgs.info",
    join_info: "প্রতি বৃহস্পতিবার বিকেলে সরাসরি বিজ্ঞানাগারে আসুন; পঞ্চম থেকে দশম শ্রেণির যেকোনো শিক্ষার্থী সদস্য হতে পারবে।",
    sort_order: 1,
  },
  {
    id: "club-language",
    name: "ভাষা ও সাহিত্য ক্লাব",
    slug: "language",
    tagline: "কথায় ভাব, লেখায় চিন্তা",
    description: "পঠন অভ্যাস, লেখালেখি, আবৃত্তি ও সাহিত্য আসরের মাধ্যমে মাতৃভাষা ও ইংরেজিতে দক্ষতা।",
    history:
      "২০১২ সালে পাঠাগারের সামনে ছোট্ট একটি আসর নিয়ে ভাষা ও সাহিত্য ক্লাবের যাত্রা। আজ প্রতি মাসে কবিতার আসর, গল্প লেখার প্রতিযোগিতা ও ইংরেজি স্পিকিং সার্কেল অনুষ্ঠিত হয়।",
    mission: "ভয়ভাঙা কথা বলার মানসিকতা এবং নিজের মত লিখে ফেলার অভ্যাস তৈরি করা।",
    objectives:
      "মাসিক কবিতা ও গল্প পাঠের আসর\nইংরেজি স্পিকিং ও ডিবেটিং সার্কেল\nবার্ষিক সৃজনশীল রচনা প্রতিযোগিতা\nস্কুল ম্যাগাজিন ‘শুভসূচী’ প্রস্তুতি\nগ্রাম-বাংলার মৌখিক সাহিত্য সংগ্রহ",
    accent: "#0d9488",
    icon: "BookOpen",
    image_url: media("club-language"),
    cover_image_url: media("club-language-cover"),
    founded_year: 2012,
    member_count: 74,
    meeting_day: "প্রতি রবিবার",
    meeting_time: "সকাল ৯টা – ১০টা",
    meeting_place: "স্কুল পাঠাগার",
    coordinator: "মোছাঃ ফাতেমা আক্তার",
    email: "language.club@okgs.info",
    join_info: "পাঠাগারে নাম লেখান বা শিক্ষকের কাছে একটি লেখা জমা দিন — সেটিই সদস্যপদ।",
    sort_order: 2,
  },
  {
    id: "club-computer",
    name: "কম্পিউটার ক্লাব",
    slug: "computer",
    tagline: "প্রযুক্তিতে দক্ষতার শুরু",
    description: "আইসিটি, প্রোগ্রামিং, ওয়েব ডেভেলপমেন্ট ও তথ্য খোঁজার দক্ষতা গড়ে তোলা।",
    history:
      "২০১৫ সালে আটটি পুরোনো কম্পিউটার নিয়ে ল্যাব চালু হয়। শিক্ষার্থীরা আজ স্কুলের ওয়েবসাইট, অ্যাপ ও ডিজিটাল আর্কাইভ তৈরিতে নিজেরাই কাজ করছে।",
    mission: "ব্যবহারশিল্পী নয়, নির্মাতা হিসেবে প্রযুক্তি শেখানো।",
    objectives:
      "বেসিক কম্পিউটার দক্ষতা ও টাইপিং ক্লাস\nScratch ও Python দিয়ে প্রোগ্রামিং যাত্রা\nওয়েবসাইট তৈরির কর্মশালা (HTML/CSS/JS)\nজাতীয় আইসিটি প্রতিযোগিতার প্রস্তুতি\nনিরাপদ ইন্টারনেট ও সাইবার সচেতনতা সপ্তাহ",
    accent: "#0ea5e9",
    icon: "Monitor",
    image_url: media("club-computer"),
    cover_image_url: media("club-computer-cover"),
    founded_year: 2015,
    member_count: 62,
    meeting_day: "প্রতি শনিবার",
    meeting_time: "বিকাল ৩টা – ৫টা",
    meeting_place: "কম্পিউটার ল্যাব",
    coordinator: "মোঃ মেহেরুল ইসলাম",
    email: "computer.club@okgs.info",
    domain: "",
    join_info: "ষষ্ঠ শ্রেণি থেকে দশম শ্রেণি পর্যন্ত নিবন্ধন ফরম ল্যাবে জমা দিন।",
    sort_order: 3,
  },
  {
    id: "club-sports",
    name: "স্পোর্টিং ক্লাব",
    slug: "sports",
    tagline: "খেলাধুলায় সুস্থ শরীর, সুস্থ মন",
    description: "মোবাইল আসক্তি দূর করে খেলাধুলায় উৎসাহ এবং স্থানীয় থেকে জাতীয় পর্যায়ে অংশগ্রহণ।",
    history:
      "মাঠহীন দিনগুলো থেকে শুরু। আজ ফুটবল, ক্রিকেট, ব্যাডমিন্টন ও কাবাডিতে নিজস্ব দল এবং প্রতি বছর বার্ষিক ক্রীড়া প্রতিযোগিতা।",
    mission: "শৃঙ্খলা, দলবোধ ও পরাজয় মানার পরিপক্বতা — এই তিনটি শিক্ষা খেলার মাঠেই সবচেয়ে ভালো পাওয়া যায়।",
    objectives:
      "প্রতিদিন সকালে ফিজিক্যাল ফিটনেস সেশন\nবার্ষিক ক্রীড়া প্রতিযোগিতা ও পদক প্রদান\nউপজেলা স্কুল ক্রিকেট ও ফুটবল টুর্নামেন্টে অংশগ্রহণ\nসাঁতার ও প্রাথমিক প্রাথমিক চিকিৎসা প্রশিক্ষণ\nখেলাধুলোয় মেয়েদের সমান অংশগ্রহণ",
    accent: "#22c55e",
    icon: "Trophy",
    image_url: media("club-sports"),
    cover_image_url: media("club-sports-cover"),
    founded_year: 2007,
    member_count: 128,
    meeting_day: "প্রতিদিন সকাল + বিকাল অনুশীলন",
    meeting_time: "সকাল ৭টা, বিকাল ৪টা",
    meeting_place: "স্কুল মাঠ",
    coordinator: "মোঃ আবুল কালাম আজাদ",
    email: "sports.club@okgs.info",
    join_info: "শারীরিক শিক্ষকের কাছে নাম দিন; পোশাক ও জুতা নিজের ব্যবস্থায়।",
    sort_order: 4,
  },
  {
    id: "club-culture",
    name: "বিতর্ক ও সংস্কৃতি ক্লাব",
    slug: "culture",
    tagline: "কথা, সংস্কৃতি ও নেতৃত্ব",
    description: "বিতর্ক, কবিতা, গান, নাটক ও সাংস্কৃতিক কার্যক্রমে আত্মবিশ্বাসী হওয়ার সুযোগ।",
    history:
      "২০১১ সালে একটি একতারা আর চারটি কেদারা নিয়ে প্রথম সাংস্কৃতিক সন্ধ্যা। আজ বিতর্ক প্রতিযোগিতা, পথনাটক, আধুনিক গান ও লোকসংগীতে ক্লাবের নিজস্ব পরিচয়।",
    mission: "মঞ্চের ভয় কেটে গলা খোলা রাখা, এবং নিজের সংস্কৃতির সঙ্গে পরিচয় রাখা।",
    objectives:
      "পাক্ষিক বিতর্ক আসর (গতি ও যুক্তি)\nনাটক ও পথনাটক দলের অনুশীলন\nআবৃত্তি, লোকসংগীত ও আধুনিক গানের চর্চা\nএকুশে বইমেলা ও সাংস্কৃতিক সন্ধ্যা আয়োজন\nঅভিভাবক ও গ্রামবাসীর জন্য মুক্ত আসর",
    accent: "#a855f7",
    icon: "MessagesSquare",
    image_url: media("club-culture"),
    cover_image_url: media("club-culture-cover"),
    founded_year: 2011,
    member_count: 81,
    meeting_day: "প্রতি বৃহস্পতিবার ও শনিবার",
    meeting_time: "বিকাল ৫টা – ৬টা",
    meeting_place: "মিলনায়তন",
    coordinator: "মোছাঃ রোজিনা আক্তার",
    email: "culture.club@okgs.info",
    join_info: "মঞ্চ প্রেমী যে কেউ আসতে পারেন; প্রথম দিনে শুধু একটি কবিতা বা নিজের পরিচয় দিন।",
    sort_order: 5,
  },
  {
    id: "club-junior",
    name: "নার্সারি ও প্রি-কিউট ক্লাব",
    slug: "junior",
    tagline: "ছোটদের বড় স্বপ্ন",
    description: "প্লে থেকে তৃতীয় শ্রেণির শিক্ষার্থীদের জন্য খেলার ছালে অক্ষর, সংখ্যা, আবাকাস ও চরিত্র গঠন।",
    history:
      "প্রি-প্রাইমারি শাখার শিক্ষার্থীদের জন্য ২০১৮ সালে ক্লাবটি শুরু। আবাকাস, স্পোকেন ইংলিশ ও কুরআন শিক্ষার সঙ্গে চিত্রকর্মে ছোটদের আত্মবিশ্বাস তৈরি হয়।",
    mission: "ভয় নয়, আনন্দ — শেখার প্রথম অভিজ্ঞতা যেন মিষ্টি হয়।",
    objectives:
      "আবাকাস ও দ্রুত গণনার খেলা\nস্পোকেন ইংরেজি চর্চা\nরংতুলি, কলেজ ও মাটির কাজ\nনজরুল ও রবীন্দ্রনাথের ছড়া আবৃত্তি\nহাত ধুয়ে, পরিবেশ রক্ষার অভ্যাস",
    accent: "#ec4899",
    icon: "Sprout",
    image_url: media("club-junior"),
    cover_image_url: media("club-junior-cover"),
    founded_year: 2018,
    member_count: 54,
    meeting_day: "প্রতি মঙ্গল ও বৃহস্পতিবার",
    meeting_time: "সকাল ১০টা – ১১টা",
    meeting_place: "নার্সারি রুম",
    coordinator: "মোছাঃ শারমিন সুলতানা",
    email: "junior.club@okgs.info",
    join_info: "অভিভাবকের সম্মতিতে শ্রেণি শিক্ষকের মাধ্যমে নিবন্ধন।",
    sort_order: 6,
  },
];

const seedEvents = [
  { id: "event-science-fair", club_slug: "science", title: "বার্ষিক বিজ্ঞান মেলা — ART ODYSSEY", description: "শিক্ষার্থীদের তৈরি ৪০টির বেশি মডেল ও প্রকল্প প্রদর্শনী, সঙ্গে বিজ্ঞান অলিম্পিয়াডের বাছাই পরীক্ষা।", event_date: "2026-12-12", event_time: "সকাল ৯টা", venue: "স্কুল মাঠ ও বিজ্ঞানাগার", event_type: "প্রদর্শনী", registration_deadline: "2026-12-01", image_url: media("event-science-fair"), is_featured: 1, sort_order: 1 },
  { id: "event-math-quiz", club_slug: "science", title: "উপজেলা পর্যায়ের গণিত কুইজ", description: "পঞ্চম থেকে অষ্টম শ্রেণির দলগত কুইজ প্রতিযোগিতা।", event_date: "2026-11-08", event_time: "সকাল ১০টা", venue: "মিলনায়তন", event_type: "প্রতিযোগিতা", sort_order: 2 },
  { id: "event-robot-workshop", club_slug: "science", title: "সোলার কার ও রোবটিক্স ওয়ার্কশপ", description: "স্থানীয় প্রকৌশলীদের সহযোগিতায় একদিনের হাতে-কলমে কর্মশালা।", event_date: "2026-10-25", event_time: "বিকাল ৩টা", venue: "বিজ্ঞানাগার", event_type: "ওয়ার্কশপ", sort_order: 3 },
  { id: "event-rekhta", club_slug: "language", title: "মাসিক কবিতার আসর", description: "নিজের লেখা কবিতা পাঠ ও প্রিয় কবিতা আবৃত্তি।", event_date: "2026-10-19", event_time: "সকাল ৯টা", venue: "স্কুল পাঠাগার", event_type: "আয়োজন", sort_order: 1 },
  { id: "event-rachana", club_slug: "language", title: "সৃজনশীল রচনা প্রতিযোগিতা", description: "‘আমার গ্রাম, আমার স্কুল’ বিষয়ে রচনা লেখা; বিজয়ী রচনাগুলো ম্যাগাজিনে ছাপা হবে।", event_date: "2026-11-15", event_time: "সকাল ১০টা", venue: "পরীক্ষা কক্ষ", event_type: "প্রতিযোগিতা", registration_deadline: "2026-11-10", sort_order: 2 },
  { id: "event-english-camp", club_slug: "language", title: "ইংরেজি স্পিকিং ক্যাম্প", description: "তিন দিনের ভয়ভাঙা ইংরেজি চর্চার ক্যাম্প।", event_date: "2026-12-05", event_time: "সকাল ৯টা", venue: "অডিটোরিয়াম", event_type: "ওয়ার্কশপ", sort_order: 3 },
  { id: "event-webcamp", club_slug: "computer", title: "প্রথম ওয়েবসাইট তৈরির কর্মশালা", description: "HTML ও CSS দিয়ে নিজের পরিচয়পাতা বানানো — শেষ দিনে সবার সামনে উপস্থাপন।", event_date: "2026-10-30", event_time: "বিকাল ৩টা", venue: "কম্পিউটার ল্যাব", event_type: "ওয়ার্কশপ", is_featured: 1, sort_order: 1 },
  { id: "event-ict", club_slug: "computer", title: "জাতীয় আইসিটি প্রতিযোগিতার বাছাই", description: "স্কুল পর্যায়ের বাছাই পরীক্ষা ও প্রকল্প জমা।", event_date: "2026-11-20", event_time: "সকাল ১০টা", venue: "কম্পিউটার ল্যাব", event_type: "প্রতিযোগিতা", sort_order: 2 },
  { id: "event-coding-club", club_slug: "computer", title: "পাইথন পরিচিতি সেশন", description: "প্রাইমারি গণনা থেকে ছোট গেম — পাইথনে যাত্রা শুরু।", event_date: "2027-01-09", event_time: "বিকাল ৪টা", venue: "কম্পিউটার ল্যাব", event_type: "ওয়ার্কশপ", sort_order: 3 },
  { id: "event-annual-sports", club_slug: "sports", title: "বার্ষিক ক্রীড়া প্রতিযোগিতা", description: "দৌড়, লাফ, ফুটবল ও কাবাডা; সমাপনী দিনে পদক প্রদান।", event_date: "2027-01-22", event_time: "সকাল ৮টা", venue: "স্কুল মাঠ", event_type: "আয়োজন", is_featured: 1, sort_order: 1 },
  { id: "event-cricket", club_slug: "sports", title: "উপজেলা স্কুল ক্রিকেট লিগ", description: "আমাদের দল উপজেলার ১২টি স্কুলের সঙ্গে খেলবে।", event_date: "2026-11-28", event_time: "সকাল ৯টা", venue: "উপজেলা স্টেডিয়াম", event_type: "প্রতিযোগিতা", sort_order: 2 },
  { id: "event-swim", club_slug: "sports", title: "সাঁতার ও নিরাপত্তা প্রশিক্ষণ", description: "গ্রীষ্মের আগে বেসিক সাঁতার ও জলরক্ষার শিক্ষা।", event_date: "2027-03-05", event_time: "সকাল ৭টা", venue: "পৌর পুকুর (অনুমোদিত)", event_type: "ওয়ার্কশপ", sort_order: 3 },
  { id: "event-debate", club_slug: "culture", title: "আন্তঃশ্রেণি বিতর্ক প্রতিযোগিতা", description: "যুক্তি, সময় ও শালীনতার বিচারে পুরস্কার।", event_date: "2026-10-26", event_time: "বিকাল ৪টা", venue: "মিলনায়তন", event_type: "প্রতিযোগিতা", sort_order: 1 },
  { id: "event-shongit", club_slug: "culture", title: " সাংস্কৃতিক সন্ধ্যা ও লোকগান", description: "আবৃত্তি, নজরুল-রবীন্দ্রসংগীত, লোকসংগীত ও পথনাটক।", event_date: "2026-12-19", event_time: "সন্ধ্যা ৬টা", venue: "স্কুল মাঠ", event_type: "আয়োজন", is_featured: 1, sort_order: 2 },
  { id: "event-boimela", club_slug: "culture", title: "একুশে বইমেলা", description: "শিক্ষার্থীদের হাতে-গড়া ছোট বই, ম্যাগাজিন ও চিত্রকর্মের মেলা।", event_date: "2027-02-18", event_time: "সকাল ১০টা", venue: "লাইব্রেরি করিডোর", event_type: "প্রদর্শনী", sort_order: 3 },
  { id: "event-junior-color", club_slug: "junior", title: "রংতুলি ও ক্রেয়ন উৎসব", description: "ছোটদের চিত্রকর্ম প্রতিযোগিতা ও অভিভাবকদের জন্য প্রদর্শনী।", event_date: "2026-11-02", event_time: "সকাল ১০টা", venue: "নার্সারি রুম", event_type: "প্রতিযোগিতা", sort_order: 1 },
  { id: "event-junior-abacus", club_slug: "junior", title: "আবাকাস উৎসব", description: "দ্রুত গণনার খেলা ও পুরস্কার বিতরণ।", event_date: "2026-12-08", event_time: "সকাল ৯টা", venue: "প্রি-প্রাইমারি কক্ষ", event_type: "আয়োজন", sort_order: 2 },
];

const seedGallery = [
  { id: "gal-sci-1", club_slug: "science", caption: "বিজ্ঞান মেলার মডেল প্রদর্শনী", image_url: media("gallery-science-1"), event_name: "ART ODYSSEY", taken_on: "2026-01-15", sort_order: 1 },
  { id: "gal-sci-2", club_slug: "science", caption: "রসায়ন পরীক্ষার নির্দেশনা", image_url: media("gallery-science-2"), event_name: "সাপ্তাহিক চর্চা", taken_on: "2026-02-05", sort_order: 2 },
  { id: "gal-sci-3", club_slug: "science", caption: "গণিত অলিম্পিয়াডের পুরস্কার", image_url: media("gallery-science-3"), event_name: "অলিম্পিয়াড", taken_on: "2025-12-10", sort_order: 3 },
  { id: "gal-sci-4", club_slug: "science", caption: "সৌরবিদ্যুৎ মডেল", image_url: media("gallery-science-4"), event_name: "ART ODYSSEY", taken_on: "2026-01-15", sort_order: 4 },
  { id: "gal-lang-1", club_slug: "language", caption: "কবিতার আসরে পাঠ", image_url: media("gallery-language-1"), event_name: "মাসিক আসর", taken_on: "2026-03-12", sort_order: 1 },
  { id: "gal-lang-2", club_slug: "language", caption: "স্কুল ম্যাগাজিন প্রকাশ", image_url: media("gallery-language-2"), event_name: "ম্যাগাজিন", taken_on: "2026-02-20", sort_order: 2 },
  { id: "gal-comp-1", club_slug: "computer", caption: "ওয়েব কর্মশালায় শিক্ষার্থীরা", image_url: media("gallery-computer-1"), event_name: "ওয়ার্কশপ", taken_on: "2026-04-18", sort_order: 1 },
  { id: "gal-comp-2", club_slug: "computer", caption: "প্রকল্প উপস্থাপনা", image_url: media("gallery-computer-2"), event_name: "আইসিটি মেলা", taken_on: "2026-01-30", sort_order: 2 },
  { id: "gal-sport-1", club_slug: "sports", caption: "বার্ষিক ক্রীড়ায় দৌড়", image_url: media("gallery-sports-1"), event_name: "ক্রীড়া প্রতিযোগিতা", taken_on: "2026-01-24", sort_order: 1 },
  { id: "gal-sport-2", club_slug: "sports", caption: "ফুটবল দলের অনুশীলন", image_url: media("gallery-sports-2"), event_name: "অনুশীলন", taken_on: "2026-02-11", sort_order: 2 },
  { id: "gal-sport-3", club_slug: "sports", caption: "কাবাডি দলকে অভিনন্দন", image_url: media("gallery-sports-3"), event_name: "পুরস্কার", taken_on: "2025-12-30", sort_order: 3 },
  { id: "gal-cul-1", club_slug: "culture", caption: "পথনাটকের অনুশীলন", image_url: media("gallery-culture-1"), event_name: "নাটক", taken_on: "2026-03-02", sort_order: 1 },
  { id: "gal-cul-2", club_slug: "culture", caption: "সাংস্কৃতিক সন্ধ্যার মঞ্চ", image_url: media("gallery-culture-2"), event_name: "সাংস্কৃতিক সন্ধ্যা", taken_on: "2025-12-20", sort_order: 2 },
  { id: "gal-jun-1", club_slug: "junior", caption: "রংতুলির আনন্দ", image_url: media("gallery-junior-1"), event_name: "চিত্রকর্ম", taken_on: "2026-02-14", sort_order: 1 },
];

const seedMembers = [
  { id: "mem-sci-1", club_slug: "science", name: "মোঃ রহমতুল্লাহ পিকে", role: "উপদেষ্টা", class_room: "সহকারী প্রধান শিক্ষক", achievement: "জাতীয় বিজ্ঞান শিক্ষক নেটওয়ার্কের সদস্য", bio: "পদার্থবিজ্ঞানে অনার্স; শিক্ষার্থীদের সঙ্গে নিয়ে নিজের হাতে মডেল বানান।", sort_order: 1 },
  { id: "mem-sci-2", club_slug: "science", name: "সাদিয়া আক্তার", role: "সভাপতি", class_room: "দশম শ্রেণি", achievement: "জেলা গণিত অলিম্পিয়াডে ৫ম", bio: "জ্যামিতি ও ধাঁধা তার প্রিয়; নতুন সদস্যদের কুইজে প্রস্তুত করেন।", sort_order: 2 },
  { id: "mem-sci-3", club_slug: "science", name: "তানভীর হাসান", role: "সাধারণ সম্পাদক", class_room: "নবম শ্রেণি", bio: "রসায়ন পরীক্ষার নিরাপত্তা তালিকা তৈরি করেছেন ক্লাবের জন্য।", sort_order: 3 },
  { id: "mem-sci-4", club_slug: "science", name: "নুসরাত জাহান", role: "তহবিল সম্পাদক", class_room: "নবম শ্রেণি", bio: "মেলা ও প্রতিযোগিতার হিসাব সামলান।", sort_order: 4 },
  { id: "mem-lang-1", club_slug: "language", name: "মোছাঃ ফাতেমা আক্তার", role: "উপদেষ্টা", class_room: "সহকারী শিক্ষিকা", bio: " বাংলা ভাষা ও সাহিত্যে এমএ; আবৃত্তি প্রশিক্ষিকা।", sort_order: 1 },
  { id: "mem-lang-2", club_slug: "language", name: "রাফি চৌধুরী", role: "সভাপতি", class_room: "অষ্টম শ্রেণি", achievement: "উপজেলা রচনা প্রতিযোগিতায় ১ম", bio: "গল্প লেখে, পড়তেও ভালোবাসে।", sort_order: 2 },
  { id: "mem-comp-1", club_slug: "computer", name: "মোঃ মেহেরুল ইসলাম", role: "উপদেষ্টা", class_room: "সহকারী শিক্ষক (আইসিটি)", bio: "ল্যাব পরিচালনা ও ওয়েব প্রকল্পের তত্ত্বাবধান।", sort_order: 1 },
  { id: "mem-comp-2", club_slug: "computer", name: "ইমরান হোসেন", role: "সাধারণ সম্পাদক", class_room: "দশম শ্রেণি", achievement: "স্কুলের ওয়েবসাইটে সহযোগী", bio: "HTML/CSS শিখিয়ে ছোটদের প্রথম পেজ বানায় সাহায্য করে।", sort_order: 2 },
  { id: "mem-sport-1", club_slug: "sports", name: "মোঃ আবুল কালাম আজাদ", role: "উপদেষ্টা", class_room: "শারীরিক শিক্ষক", bio: "১৫ বছর ধরে স্কুল দলকে অনুশীলন করচ্ছেন।", sort_order: 1 },
  { id: "mem-sport-2", club_slug: "sports", name: "সোহাগ মিয়া", role: "সভাপতি", class_room: "নবম শ্রেণি", achievement: "উপজেলা ফুটবলে সেরা খেলোয়াড়", sort_order: 2 },
  { id: "mem-cul-1", club_slug: "culture", name: "মোছাঃ রোজিনা আক্তার", role: "উপদেষ্টা", class_room: "সহকারী শিক্ষিকা", bio: "সংগীত ও আবৃত্তি পরিচালনা।", sort_order: 1 },
  { id: "mem-cul-2", club_slug: "culture", name: "ফারহানা ইয়াসমিন", role: "সভাপতি", class_room: "দশম শ্রেণি", achievement: "জেলা বিতর্ক প্রতিযোগিতায়_best_৩য়", sort_order: 2 },
  { id: "mem-jun-1", club_slug: "junior", name: "মোছাঃ শারমিন সুলতানা", role: "উপদেষ্টা", class_room: "প্রধান শিক্ষিকা (প্রি-প্রাইমারি)", bio: "ছোটদের খেলার ছালে শেখানোর অভ্যাস গড়ে তুলছেন।", sort_order: 1 },
];

const seedAchievements = [
  { id: "ach-sci-1", club_slug: "science", title: "জেলা বিজ্ঞান মেলায় প্রথম স্থান", description: "‘বন্যা পূর্বাভাসের সহজ সেন্সর’ প্রকল্প দিয়ে প্রথম স্থান ও শীল্ড।", awarded_to: "সাদিয়া আক্তার, তানভীর হাসান", achieved_on: "2026-02-18", level: "জেলা", position: "১ম স্থান", sort_order: 1 },
  { id: "ach-sci-2", club_slug: "science", title: "গণিত অলিম্পিয়াডে জেলা পর্যায়", description: "৯ জন শিক্ষার্থী জেলা পর্বে অংশ নেয়, ৩ জনের উল্লেখযোগ্য সাফল্য।", achieved_on: "2025-12-10", level: "জেলা", position: "৫ম স্থান", sort_order: 2 },
  { id: "ach-lang-1", club_slug: "language", title: "উপজেলা রচনা প্রতিযোগিতায় ১ম", description: "‘আমার স্কুল, আমার গর্ব’ শিরোনামে রচনা।", awarded_to: "রাফি চৌধুরী, সপ্তম শ্রেণি", achieved_on: "2026-02-21", level: "উপজেলা", position: "১ম স্থান", sort_order: 1 },
  { id: "ach-comp-1", club_slug: "computer", title: "জাতীয় আইসিটি প্রতিযোগিতা — আঞ্চলিক পর্ব", description: "ওয়েব ডিজাইন বিভাগে আঞ্চলিক পর্যন্ত উঠে এসেছে।", awarded_to: "ইমরান হোসেন", achieved_on: "2026-03-14", level: "জাতীয়", position: "আঞ্চলিক পর্ব", sort_order: 1 },
  { id: "ach-sport-1", club_slug: "sports", title: "উপজেলা স্কুল ফুটবল চ্যাম্পিয়ন", description: "ফাইনালে ২–১ ব্যবধানে জয়; দলের পক্ষে ৩ গোল।", achieved_on: "2026-01-28", level: "উপজেলা", position: "চ্যাম্পিয়ন", sort_order: 1 },
  { id: "ach-cul-1", club_slug: "culture", title: "জেলা বিতর্ক প্রতিযোগিতায় সেরা বক্তা", description: "যুক্তি ও উপস্থাপনে পৃথক পুরস্কার।", awarded_to: "ফারহানা ইয়াসমিন", achieved_on: "2026-02-05", level: "জেলা", position: "সেরা বক্তা", sort_order: 1 },
];

const seedPosts = [
  { id: "post-sci-fair-report", club_slug: "science", slug: "art-odyssey-2026-report", title: "ART ODYSSEY ২০২৬: ৪৩টি মডেল, একদিনের উৎসব", excerpt: "এ বছর বিজ্ঞান মেলায় সবচেয়ে বেশি প্রকল্প এসেছে পরিবেশ ও কৃষিবিষয়ক — যা দেখিয়ে দেয় আমাদের শিক্ষার্থীরা চারপাশের প্রশ্ন নিয়ে ভাবছে।", body: "সকাল নটায় ফিতা কাটা, তারপর একটানা বিকেল পর্যন্ত প্রদর্শনী।\n\nসবচেয়ে নজর কেড়েছে নবম শ্রেণির ‘বন্যা পূর্বাভাসের সহজ সেন্সর’ প্রকল্পটি, যা জেলার দুর্যোগ ব্যবস্থাপনা কার্যালয় থেকেও প্রশংসিত হয়েছে।\n\nমেলা শেষে বিচারকমণ্ডলী ঠিক করেছে — আগামী বছর থেকে প্রতিটি প্রকল্পের সঙ্গে একটি করে ২ মিনিটের ভিডিও রাখতে হবে, যাতে না আসতে পারা অভিভাবকরাও দেখতে পায়।", image_url: media("post-science-fair"), category: "রিপোর্ট", author: "বিজ্ঞান ক্লাব", note: "প্রদর্শনীর ছবি ক্লাব গ্যালারিতে আছে।", published_at: "2026-01-16T10:00", is_featured: 1 },
  { id: "post-sci-quiz", club_slug: "science", slug: "kothar-math-quiz-kit", title: "কোথায় শুরু করবেন: কুইজের প্রস্তুতির সহজ উপায়", excerpt: "অলিম্পিয়াডের প্রস্তুতি মানে ঘণ্টার পর ঘণ্টা অংক নয় — সঠিক ধাঁধা বেছে নেওয়া।", body: "প্রতিদিন ২০ মিনিট যথেষ্ট।\n\nআমাদের অভিজ্ঞতা থেকে তিনটি পরামর্শ: পুরোনো প্রশ্নপত্র সময় বেঁধে সমাধান করুন, ভুলগুলো আলাদা খাতায় লিখে রাখুন, এবং বন্ধুর সঙ্গে মিলে একে অপরকে প্রশ্ন করুন — পড়ানোই সবচেয়ে ভালো পড়া।", category: "টিউটোরিয়াল", author: "সাদিয়া আক্তার", published_at: "2026-02-02T09:00" },
  { id: "post-lang-magazine", club_slug: "language", slug: "khushvu-notun-kotha", title: "আমাদের ম্যাগাজিনের নতুন সংখ্যা প্রকাশিত", excerpt: "২৪টি রচনা, ৯টি কবিতা ও দুটি ছোট গল্প — সবই শিক্ষার্থীদের হাতে লেখা।", body: "সম্পাদকীয় বৈঠকে ঠিক হয়েছে এবার থেকে প্রতি প্রকাশনায় একটি করে ‘গ্রামের গল্প’ থাকবে, যেখানে স্থানীয় জ্যেষ্ঠদের স্মৃতি লিপিবদ্ধ করা হবে।\n\nপ্রতিলিপি শিক্ষার্থীদের মধ্যে বিনামূল্যে বিতরণ করা হয়েছে।", image_url: media("post-magazine"), category: "রিপোর্ট", author: "ভাষা ক্লাব", published_at: "2026-02-21T09:30" },
  { id: "post-comp-web", club_slug: "computer", title: "১৪ জন শিক্ষার্থী নিজেরা ওয়েবসাইট বানাল", excerpt: "চার সপ্তাহের কর্মশালা শেষে প্রত্যেকের একটি করে পরিচয়পাতা অনলাইনে।", body: "শুরুতে শুধু ট্যাগ আর স্টাইল। চতুর্থ সপ্তাহে অনেকেই ফর্ম, গ্যালারি আর মোবাইল রেসপন্সিভ ডিজাইন যোগ করেছে।\n\nপরবর্তী কর্মশালায় থাকবে ছোট প্রকল্প: স্কুলের নোটিশ বোর্ডের ডিজিটাল সংস্করণ।", image_url: media("post-webcamp"), category: "অভিজ্ঞতা", author: "ইমরান হোসেন", published_at: "2026-04-20T08:00", is_featured: 1 },
  { id: "post-sport-league", club_slug: "sports", title: "ক্রিকেট লিগের প্রস্তুতি শুরু", excerpt: "দৈনিক অনুশীলনের পাশাপাশি পুষ্টি ও ঘুম নিয়ে অভিভাবকদের সঙ্গে বৈঠক।", body: "অনুশীলন সকাল সাতটায়, তবে পরীক্ষার আগে দুই সপ্তাহ বন্ধ থাকবে — খেলার চেয়ে পড়া বড়, এইটাই আমাদের নিয়ম।", category: "রিপোর্ট", author: "সোহাগ মিয়া", published_at: "2026-03-05T06:30" },
  { id: "post-culture-debate", club_slug: "culture", title: "বিতর্কে আমাদের যুক্তি সাজানোর পদ্ধতি", excerpt: "প্রস্তাব বুঝে নেওয়া থেকে পাল্টা জবাব — ধাপে ধাপে।", body: "আমাদের অনুশীলনে প্রতিটি বক্তার হাতে ৩টি করে কার্ড থাকে: তথ্য, যুক্তি, উদাহরণ। শেষ ৩০ সেকেন্ডে শুধু সবচেয়ে জোরালো কথায় ফিরে আসতে হয়।", category: "টিউটোরিয়াল", author: "ফারহানা ইয়াসমিন", published_at: "2026-03-18T15:00" },
  { id: "post-junior-color", club_slug: "junior", title: "ছোটদের হাতে প্রথম রং", excerpt: "রংতুলি উৎসবে ৩৪টি আঁকা ছবি, সবই নার্সারি ও কিউট শ্রেণির শিক্ষার্থীদের।", body: "আঁকা শেষে প্রতিটি ছবি কর্নারে টাঙানো হয়েছে এবং অভিভাবকরা দেখেছেন। শিক্ষার্থীরা নিজের ছবি ঘরে নিয়ে যেতে পেরেছে — সেটাই ছিল দিনের সবচেয়ে বড় আনন্দ।", image_url: media("post-junior"), category: "রিপোর্ট", author: "নার্সারি ক্লাব", published_at: "2026-02-15T09:00" },
];

const seedNews = [
  { id: "news-science-fair", slug: "art-odyssey-science-fair", title: "ART ODYSSEY বিজ্ঞান মেলায় শিক্ষার্থীদের প্রাণবন্ত অংশগ্রহণ", excerpt: "বিজ্ঞান, ক্র্যাফটিং, নাটক, গান, কবিতা ও আইসিটি প্রোগ্রামিংয়ের মধ্য দিয়ে শিক্ষার্থীরা নিজেদের সৃজনশীলতা প্রকাশ করেছে।", body: "প্রতি বছর ওমর কিন্ডারগার্টেন স্কুলে অনুষ্ঠিত হয় ART ODYSSEY বিজ্ঞান মেলা। বিজ্ঞানের প্রতি আগ্রহ বাড়ানো ও জীবনের সাথে বিজ্ঞানের সম্পৃক্ততা তুলে ধরাই এই আয়োজনের লক্ষ্য।", image_url: media("news-science-fair"), category: "বিজ্ঞান মেলা", author: "ওমর কিন্ডারগার্টেন স্কুল", club_slug: "science", published_at: "2026-01-16T09:00:00.000Z", is_featured: 1 },
  { id: "news-clubs", slug: "club-registration-open", title: "নতুন শিক্ষাবর্ষে সব ক্লাবে সদস্য নিবন্ধন চলছে", excerpt: "বিজ্ঞান, ভাষা, কম্পিউটার, ক্রীড়া, সংস্কৃতি ও নার্সারি ক্লাবে চলে আসুন — প্রতিটি ক্লাবের নিজস্ব কার্যতালিকা ও সময়সূচি এখন ওয়েবসাইটে।", body: "এবার থেকে প্রতিটি ক্লাবের আয়োজন, সদস্য কমিটি, ছবি ও অর্জন সরাসরি ওয়েবসাইটে দেখা যাবে। ক্লাবের পাতায় গেলেই পরবর্তী অনুষ্ঠানের তারিখ ও যোগ দেওয়ার নিয়ম পাওয়া যাবে।", image_url: media("news-clubs"), category: "ক্যাম্পাস", author: "ওকেজিএস বার্তা", club_slug: "", published_at: "2026-09-27T09:00:00.000Z", is_featured: 0 },
  { id: "news-assembly", slug: "new-session-at-okgs", title: "নতুন শিক্ষাবর্ষে নতুন উদ্যম", excerpt: "শিক্ষার্থী, শিক্ষক ও অভিভাবকদের অংশগ্রহণে নতুন শিক্ষাবর্ষের প্রস্তুতি ও স্বাগত কার্যক্রম।", body: "নতুন শিক্ষাবর্ষে একাডেমিক ক্যালেন্ডার, নিয়মিত মূল্যায়ন ও সহশিক্ষা কার্যক্রমকে সামনে রেখে আমাদের পথচলা শুরু হয়েছে।", image_url: media("news-assembly"), category: "শিক্ষা", author: "ওমর কিন্ডারগার্টেন স্কুল", club_slug: "", published_at: "2026-09-10T09:00:00.000Z", is_featured: 0 },
];

const seedSlides = [
  { id: "slide-welcome", eyebrow: "ওমর কিন্ডারগার্টেন স্কুল", title: "শিক্ষায় গড়ি আলোকিত ভবিষ্যৎ", description: "২০০৩ সাল থেকে কালাই, জয়পুরহাটে মানসম্মত শিক্ষায় নিবেদিত।", cta_label: "ভর্তি তথ্য", cta_href: "#admission", image_url: media("hero-campus"), accent: "#d97706", sort_order: 1 },
  { id: "slide-clubs", eyebrow: "৬টি ক্লাব · প্রতিটি পূর্ণাঙ্গ তথ্যে", title: "ক্লাবের খবর এখন এক জায়গায়", description: "আয়োজন, সদস্য, গ্যালারি ও অর্জন — সব ক্লাবের তথ্য হালনাগাদ রাখা হয় অ্যাডমিন প্যানেল থেকে।", cta_label: "ক্লাব দেখুন", cta_href: "/clubs", image_url: media("hero-clubs"), accent: "#166534", sort_order: 2 },
  { id: "slide-science", eyebrow: "ART ODYSSEY — বিজ্ঞান মেলা", title: "শিক্ষার্থীর প্রতিটি সম্ভাবনায় পাশে", description: "বিজ্ঞান, সংস্কৃতি, খেলাধুলা ও প্রযুক্তির মাধ্যমে কৌতূহলী মনকে বিকশিত করি।", cta_label: "মেলার বিবরণ", cta_href: "/clubs/science", image_url: media("hero-science"), accent: "#15803d", sort_order: 3 },
];

const seedNotices = [
  { id: "notice-admission", title: "২০২৬ শিক্ষাবর্ষে ভর্তি চলছে", body: "প্লে থেকে দশম শ্রেণি পর্যন্ত আবাসিক ও অনাবাসিক ভর্তি চলছে।", type: "ভর্তি", club_slug: "", published_at: "2026-10-01T09:00:00.000Z" },
  { id: "notice-club-meet", title: "সব ক্লাবের বার্ষিক সভা আগামী বৃহস্পতিবার", body: "ক্লাব কমিটি নির্বাচন ও আগামী ছয় মাসের কার্যতালিকা ঠিক করা হবে মিলনায়তনে।", type: "কার্যক্রম", club_slug: "", published_at: "2026-09-29T09:00:00.000Z" },
  { id: "notice-science", title: "বিজ্ঞান মেলার প্রকল্প জমার শেষ তারিখ ১ ডিসেম্বর", body: "প্রতিটি প্রকল্পের সঙ্গে ২ মিনিটের ভিডিও ও সংক্ষিপ্ত লেখা জমা দিতে হবে।", type: "কার্যক্রম", club_slug: "science", published_at: "2026-09-26T09:00:00.000Z" },
];

const seedBanners = [
  { id: "banner-admission", label: "ভর্তি চলছে", title: "আপনার সন্তানের উজ্জ্বল ভবিষ্যৎ শুরু হোক", description: "প্রি-প্রাইমারিতে আবাকাস, স্পোকেন ইংলিশ, কম্পিউটার ও কুরআন শিক্ষায় বিশেষ গুরুত্ব।", cta_label: "ভর্তি সংক্রান্ত তথ্য", cta_href: "#admission", image_url: media("banner-admission"), accent: "#102d2a", sort_order: 1 },
  { id: "banner-clubs", label: "ক্লাব তথ্যকেন্দ্র", title: "প্রতিটি ক্লাবের খোঁজ রাখুন একসাথে", description: "আয়োজন, সদস্য, ছবি ও অর্জন — ক্লাবের সব তথ্য সহজে আপডেট করুন অ্যাডমিন প্যানেল থেকে।", cta_label: "ক্লাব তালিকা দেখুন", cta_href: "/clubs", image_url: media("banner-clubs"), accent: "#14532d", sort_order: 2 },
];

const seedUpdates = [
  { id: "update-01", title: "ভর্তি ও আবাসিক আসন সম্পর্কে যোগাযোগ করুন", description: "ভর্তি ও হোস্টেল সংক্রান্ত তথ্যের জন্য ০১৩২৯-৬২৫৭০০ নম্বরে যোগাযোগ করুন।", date: "2026-10-01", kind: "ভর্তি" },
  { id: "update-02", title: "ক্লাব কার্যক্রমে সদস্য নিবন্ধন চলছে", description: "বিজ্ঞান, ভাষা, কম্পিউটার, স্পোর্টিং, সংস্কৃতি ও নার্সারি ক্লাবে অংশ নিন।", date: "2026-09-27", kind: "ক্লাব" },
  { id: "update-03", title: "ক্লাব পাতায় আসছে নতুন ছবি", description: "আয়োজনের ছবি সরাসরি আপলোড করা যাচ্ছে এখন — অ্যাডমিন প্যানেল থেকেই।", date: "2026-09-22", kind: "ক্লাব" },
  { id: "update-04", title: "বার্ষিক বিজ্ঞান মেলার প্রস্তুতি", description: "ART ODYSSEY-তে শিক্ষার্থীদের প্রকল্প ও সৃজনশীল কাজ প্রদর্শিত হবে।", date: "2026-09-15", kind: "বিজ্ঞান" },
];

const seedTeachers = [
  { id: "teacher-principal", name: "ওমর আব্দুল আজিজ তালুকদার", role: "অধ্যক্ষ", subject: "গাণিতিক বিশ্লেষণ ও বিজ্ঞান", kind: "teacher", qualification: "এমএ, বিএড", bio: "প্রতিষ্ঠান চালুর শুরু থেকে আছেন; সহশিক্ষা ও ক্লাব কার্যক্রমের প্রধান পৃষ্ঠপোষক।", photo_url: media("teacher-principal"), sort_order: 1 },
  { id: "teacher-rahomotullah", name: "মোঃ রহমতুল্লাহ পিকে", role: "সহকারী প্রধান শিক্ষক", subject: "পদার্থবিজ্ঞান", kind: "teacher", qualification: "বিএসসি (সম্মান), বিএড", bio: "বিজ্ঞান ক্লাবের উপদেষ্টা ও ART ODYSSEY-র আহ্বায়ক।", photo_url: media("teacher-physics"), sort_order: 2 },
  { id: "teacher-meherul", name: "মোঃ মেহেরুল ইসলাম", role: "সহকারী শিক্ষক", subject: "তথ্য ও যোগাযোগ প্রযুক্তি", kind: "teacher", qualification: "বিএসসি (কম্পিউটার)", bio: "কম্পিউটার ল্যাব পরিচালনা ও ওয়েব কর্মশালার প্রশিক্ষক।", photo_url: media("teacher-ict"), sort_order: 3 },
  { id: "teacher-fatema", name: "মোছাঃ ফাতেমা আক্তার", role: "সহকারী শিক্ষিকা", subject: "বাংলা", kind: "female-teacher", qualification: "এমএ (বাংলা)", bio: "আবৃত্তি ও রচনা প্রতিযোগিতার প্রশিক্ষিকা।", photo_url: media("teacher-bangla"), sort_order: 4 },
  { id: "teacher-sharmin", name: "মোছাঃ শারমিন সুলতানা", role: "প্রধান শিক্ষিকা (প্রি-প্রাইমারি)", subject: "নার্সারি ও আবাকাস", kind: "female-teacher", qualification: "ডিপ্লোমা ইন নার্সারি এডুকেশন", bio: "ছোটদের খেলার ছালে শেখানোর কার্যক্রম পরিচালনা করেন।", photo_url: media("teacher-nursery"), sort_order: 5 },
  { id: "staff-rozina", name: "মোছাঃ রোজিনা আক্তার রোজি", role: "হিসাব কর্মকর্তা", subject: "অফিস ও হিসাব", kind: "staff", qualification: "এইচএসসি (ব্যবসায় শিক্ষা)", bio: "বেতন, ফি ও হিসাব রক্ষণাবেক্ষণ দেখেন।", photo_url: media("staff-office"), sort_order: 6 },
];

const seedFacilities = [
  { id: "fac-bus", title: "বাস সার্ভিস", description: "শিক্ষার্থীদের যাতায়াতের জন্য নিজস্ব বাসের ব্যবস্থা।", icon: "Sparkles", sort_order: 1 },
  { id: "fac-safety", title: "শিক্ষার্থীর নিরাপত্তা", description: "সি.সি ক্যামেরায় সার্বক্ষণিক তত্ত্বাবধান ও ইভটিজিং প্রতিরোধ সেল।", icon: "ShieldCheck", sort_order: 2 },
  { id: "fac-boarding", title: "আবাসিক ব্যবস্থা", description: "ছেলে ও মেয়েদের জন্য আলাদা, শান্ত ও নিরাপদ আবাসিক ভবন।", icon: "HeartHandshake", sort_order: 3 },
  { id: "fac-lab", title: "কম্পিউটার ল্যাব", description: "আধুনিক কম্পিউটার ল্যাব ও সবার জন্য কম্পিউটার শিক্ষা।", icon: "Monitor", sort_order: 4 },
  { id: "fac-library", title: "সমৃদ্ধ পাঠাগার", description: "দুই হাজারের বেশি বই নিয়ে নিজস্ব পাঠাগার।", icon: "BookOpen", sort_order: 5 },
  { id: "fac-canteen", title: "ক্যান্টিন", description: "স্কুল ক্যাম্পাসেই স্বাস্থ্যসম্মত খাবারের নিজস্ব ক্যান্টিন।", icon: "Sprout", sort_order: 6 },
];

const seedSiteGallery = [
  { id: "site-gal-1", caption: "স্কুলের মূল ভবন", image_url: media("campus-building"), event_name: "ক্যাম্পাস", taken_on: "2026-01-05", sort_order: 1 },
  { id: "site-gal-2", caption: "সকালিন এসেম্বলি", image_url: media("campus-assembly"), event_name: "দৈনদিন রুটিন", club_slug: "", taken_on: "2026-01-12", sort_order: 2 },
  { id: "site-gal-3", caption: "পাঞ্জাবি দিবসের আনন্দ", image_url: media("campus-punjabiday"), event_name: "সংস্কৃতি", taken_on: "2025-11-14", sort_order: 3 },
  { id: "site-gal-4", caption: "বার্ষিক বিজ্ঞান মেলা", image_url: media("campus-sciencefair"), event_name: "ART ODYSSEY", club_slug: "science", taken_on: "2026-01-15", sort_order: 4 },
  { id: "site-gal-5", caption: "স্কুল লাইব্রেরি", image_url: media("campus-library"), event_name: "সুবিধা", taken_on: "2026-02-02", sort_order: 5 },
  { id: "site-gal-6", caption: "মাঠে অনুশীলন", image_url: media("campus-ground"), event_name: "খেলাধুলা", club_slug: "sports", taken_on: "2026-02-09", sort_order: 6 },
  { id: "site-gal-7", caption: "কম্পিউটার ল্যাব", image_url: media("campus-lab"), event_name: "প্রযুক্তি", club_slug: "computer", taken_on: "2026-02-18", sort_order: 7 },
  { id: "site-gal-8", caption: "সাংস্কৃতিক সন্ধ্যার মঞ্চ", image_url: media("campus-stage"), event_name: "সংস্কৃতি", club_slug: "culture", taken_on: "2025-12-20", sort_order: 8 },
];

const seedStats = [
  { id: "stat-founded", label: "প্রতিষ্ঠা সাল", value: "২০০৩", note: "কালাই উপজেলা সদরে", icon: "Sparkles", sort_order: 1 },
  { id: "stat-students", label: "শিক্ষার্থী", value: "১১০০+", note: "প্লে থেকে দশম শ্রেণি", icon: "Users", sort_order: 2 },
  { id: "stat-teachers", label: "শিক্ষক-কর্মচারী", value: "৮০", note: "নিবেদিত প্রাণ টিম", icon: "BookOpen", sort_order: 3 },
  { id: "stat-pass", label: "পাবলিক পরীক্ষায় পাশ", value: "১০০%", note: "গত তিন বছরে", icon: "Award", sort_order: 4 },
  { id: "stat-clubs", label: "সক্রিয় ক্লাব", value: "০৬", note: "সহশিক্ষা কার্যক্রম", icon: "Trophy", sort_order: 5 },
];

const seedSettings = [
  { id: "setting-logo", key: "logo_url", label: "প্রতিষ্ঠানের লোগো", field_kind: "image", value: media("school-logo"), description: "হেডার ও ফুটারে দেখানো হবে।" },
  { id: "setting-about-image", key: "about_image_url", label: "পরিচিতি অংশের ছবি", field_kind: "image", value: media("about-school"), description: "‘আমাদের পরিচিতি’ ব্লকের ছবি।" },
  { id: "setting-admission-image", key: "admission_image_url", label: "ভর্তি অংশের ছবি", field_kind: "image", value: media("admission-desk"), description: "ভর্তি সেকশনের ছবি।" },
  { id: "setting-about-extra", key: "about_extra", label: "পরিচিতির অতিরিক্ত লেখা", field_kind: "textarea", value: "আজ এখানে রয়েছে নিজস্ব পাঠাগার, আধুনিক কম্পিউটার ল্যাব, আবাসিক ব্যবস্থা ও স্কুল বাস।", description: "পরিচিতি অংশের দ্বিতীয় অনুচ্ছেদ।" },
  { id: "setting-admission-note", key: "admission_note", label: "ভর্তি অংশের লেখা", field_kind: "textarea", value: "প্লে থেকে দশম শ্রেণি পর্যন্ত আবাসিক ও অনাবাসিক ভর্তি চলছে। প্রি-প্রাইমারিতে আবাকাস, স্পোকেন ইংলিশ, কম্পিউটার ও কুরআন শিক্ষায় বিশেষ গুরুত্ব দেওয়া হয়।", description: "ভর্তি সেকশনের মূল লেখা।" },
  { id: "setting-gallery-note", key: "gallery_note", label: "গ্যালারির টীকা", field_kind: "textarea", value: "ART ODYSSEY — প্রতি বছর আয়োজিত বিজ্ঞান মেলা, ক্র্যাফটিং, নাটক, গান, কবিতা ও আইসিটি প্রতিযোগিতা।", description: "গ্যালারির নিচে দেখানো হবে।" },
  { id: "setting-quote-text", key: "quote_text", label: "উদ্ধৃতি", value: "বাংলাদেশের অন্যতম সেরা শিক্ষা প্রতিষ্ঠান।", description: "হোমপেজের উদ্ধৃতি অংশ।" },
  { id: "setting-quote-author", key: "quote_author", value: "— একজন অভিভাবক", description: "উদ্ধৃতির উৎস।" },
  { id: "setting-badge-year", key: "hero_badge_year", label: "হিরো ব্যাজ: সাল", value: "২০০৩", description: "স্লাইডারের ডান পাশের ব্যাজ।" },
  { id: "setting-badge-place", key: "hero_badge_place", label: "হিরো ব্যাজ: স্থান", value: "কালাই, জয়পুরহাট", description: "স্লাইডারের ব্যাজে দেখানো হবে।" },
  { id: "setting-site-name", key: "site_name", label: "প্রতিষ্ঠানের নাম", value: "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি", description: "ওয়েবসাইটে প্রদর্শিত প্রতিষ্ঠানের নাম।" },
  { id: "setting-site-short", key: "short_name", label: "সংক্ষিপ্ত নাম", value: "ওকেজিএস", description: "মেনু, ফুটার ও লোগোতে ব্যবহৃত নাম।" },
  { id: "setting-tagline", key: "tagline", label: "সংক্ষিপ্ত পরিচিতি", value: "২০০৩ সাল থেকে কালাই, জয়পুরহাটে মানসম্মত শিক্ষায় নিবেদিত।", description: "হেডার ও ফুটারে প্রদর্শিত পরিচিতি।" },
  { id: "setting-about", key: "about", label: "প্রতিষ্ঠান সম্পর্কে", value: "ওমর কিন্ডারগার্টেন স্কুল ও ওমর গার্টেন একাডেমি জয়পুরহাট জেলার কালাই উপজেলা সদরে অবস্থিত একটি স্বনামধন্য শিক্ষা প্রতিষ্ঠান। ২০০৩ সালের ১লা জানুয়ারি বিশিষ্ট শিক্ষানুরাগী আলহাজ্ব আব্দুর রশিদ তালুকদার প্রতিষ্ঠানটি প্রতিষ্ঠা করেন।", description: "হোমপেজের সংক্ষিপ্ত পরিচিতি।" },
  { id: "setting-mission", key: "mission", label: "লক্ষ্য", value: "মানসম্মত শিক্ষা, শৃঙ্খলা ও মানবিক মূল্যবোধে গড়ে তুলি আগামী প্রজন্ম।", description: "পরিচিতি অংশে প্রদর্শিত লক্ষ্য।" },
  { id: "setting-club-mission", key: "club_mission", label: "ক্লাব তথ্যকেন্দ্রের পরিচিতি", value: "স্কুলের সব ক্লাবের আয়োজন, সদস্য, ছবি ও অর্জন — একটিই জায়গায়, সবার জন্য উন্মুক্ত।", description: "/clubs পাতার ভূমিকা লেখা।" },
  { id: "setting-email", key: "email", label: "ইমেইল", value: "okgs2003@gmail.com", description: "প্রধান যোগাযোগ ইমেইল।" },
  { id: "setting-phone", key: "phone", label: "হেল্পলাইন", value: "01711857205", description: "প্রধান হেল্পলাইন নম্বর।" },
  { id: "setting-admission-phone", key: "admission_phone", label: "ভর্তি ও হোস্টেল নম্বর", value: "01329625700", description: "ভর্তি ও আবাসিক তথ্যের নম্বর।" },
  { id: "setting-secondary-phone", key: "phone_secondary", label: "অফিস নম্বর", value: "05725-56351-52", description: "অতিরিক্ত অফিস যোগাযোগ নম্বর।" },
  { id: "setting-address", key: "address", label: "ঠিকানা", value: "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি, কালাই সদর, জয়পুরহাট", description: "ফুটারে প্রদর্শিত ঠিকানা।" },
  { id: "setting-hours", key: "office_hours", label: "অফিস সময়", value: "রবি – বৃহস্পতি, সকাল ৮টা – দুপুর ২টা", description: "যোগাযোগ পাতার অফিস সময়।" },
  { id: "setting-facebook", key: "facebook_url", label: "ফেসবুক পেজ", value: "https://www.facebook.com/omarkgschool/", description: "ফুটার ও যোগাযোগে দেখানো হবে।" },
  { id: "setting-youtube", key: "youtube_url", label: "ইউটিউব চ্যানেল", value: "https://www.youtube.com/channel/UCE-VL9Ap-kLeKuvM1D3mmYA", description: "ফুটার ও যোগাযোগে দেখানো হবে।" },
  { id: "setting-founders", key: "founder", label: "প্রতিষ্ঠাতা", value: "আলহাজ্ব আব্দুর রশিদ তালুকদার — প্রতিষ্ঠা: ১লা জানুয়ারি ২০০৩", description: "পরিচিতি অংশে দেখানো হবে।" },
  { id: "setting-principal", key: "principal", label: "প্রধান শিক্ষক / অধ্যক্ষ", value: "ওমর আব্দুল আজিজ তালুকদার", description: "শিক্ষক পরিচিতি অংশে দেখানো হবে।" },
];

interface SeedPlan {
  resource: ResourceName;
  rows: Array<Record<string, string | number>>;
}

const seeds: SeedPlan[] = [
  { resource: "clubs", rows: seedClubs as unknown as Record<string, string | number>[] },
  { resource: "slides", rows: seedSlides as unknown as Record<string, string | number>[] },
  { resource: "notices", rows: seedNotices as unknown as Record<string, string | number>[] },
  { resource: "banners", rows: seedBanners as unknown as Record<string, string | number>[] },
  { resource: "news", rows: seedNews as unknown as Record<string, string | number>[] },
  { resource: "updates", rows: seedUpdates as unknown as Record<string, string | number>[] },
  { resource: "club_events", rows: seedEvents as unknown as Record<string, string | number>[] },
  { resource: "club_posts", rows: seedPosts as unknown as Record<string, string | number>[] },
  { resource: "club_gallery", rows: seedGallery as unknown as Record<string, string | number>[] },
  { resource: "club_members", rows: seedMembers as unknown as Record<string, string | number>[] },
  { resource: "club_achievements", rows: seedAchievements as unknown as Record<string, string | number>[] },
  { resource: "facilities", rows: seedFacilities as unknown as Record<string, string | number>[] },
  { resource: "teachers", rows: seedTeachers as unknown as Record<string, string | number>[] },
  { resource: "gallery", rows: seedSiteGallery as unknown as Record<string, string | number>[] },
  { resource: "stats", rows: seedStats as unknown as Record<string, string | number>[] },
  { resource: "settings", rows: seedSettings as unknown as Record<string, string | number>[] },
];

async function seedTable(resource: ResourceName, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const table = resourceTables[resource];
  const countResult = await db.execute(`SELECT COUNT(*) as count FROM ${wrap(table)}`);
  if (Number(countResult.rows[0]?.count ?? 0) > 0) return;

  // `id` is not a schema field, so it has to be carried explicitly — otherwise
  // seeded rows end up with a NULL primary key and cannot be edited from the studio.
  const columns = ["id", ...columnsFor(resource).map((column) => column.name), "created_at", "updated_at"];
  const createdAt = now();
  const statements: InStatement[] = rows.map((row, index) => {
    const values = columns.map((column) => {
      if (column === "created_at" || column === "updated_at") return createdAt;
      if (column === "id") return String(row.id ?? `${resource}-${index}`);
      const field = fieldsFor(resource).find((item) => item.name === column);
      const raw = row[column] ?? (field ? coerceFieldValue(field, defaultValueFor(field)) : "");
      return raw as string | number;
    });
    return {
      sql: `INSERT OR IGNORE INTO ${wrap(table)} (${columns.map(wrap).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      args: values,
    };
  });
  await db.batch(statements, "write");
}

async function bootstrap() {
  await db.batch(schemaStatements(), "write");
  for (const resource of resourceOrder) {
    await migrateTable(resource);
  }
  for (const plan of seeds) {
    await seedTable(plan.resource, plan.rows);
  }
}

export async function ensureDatabase() {
  if (!globalForDb.okgsDbReady) {
    globalForDb.okgsDbReady = bootstrap().catch((error) => {
      globalForDb.okgsDbReady = undefined;
      throw error;
    });
  }
  await globalForDb.okgsDbReady;
}

/* ---------------------------------------------------------------- *
 * Generic CRUD used by the admin API and the public pages
 * ---------------------------------------------------------------- */

export function resourceTable(resource: ResourceName) {
  return resourceTables[resource];
}

function rowToRecord(row: Row) {
  const item: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    item[key] = normalizeRowFlags(key, value);
  }
  return item;
}

export function normalizeRows(rows: Row[]) {
  return rows.map(rowToRecord);
}

export interface ListOptions {
  activeOnly?: boolean;
  /** Filter by parent club slug — used by every club-scoped resource. */
  clubSlug?: string;
  limit?: number;
}

export async function listRows<T = Record<string, unknown>>(resource: ResourceName, options: ListOptions = {}) {
  await ensureDatabase();
  const table = resourceTables[resource];
  const filters: string[] = [];
  const args: (string | number)[] = [];
  const fields = fieldsFor(resource);

  if (options.activeOnly && fields.some((field) => field.name === "is_active")) filters.push("is_active = 1");
  if (options.clubSlug && fields.some((field) => field.name === "club_slug")) {
    filters.push("club_slug = ?");
    args.push(options.clubSlug);
  }

  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  const limit = options.limit ? ` LIMIT ${Number(options.limit)}` : "";
  const result = await db.execute({
    sql: `SELECT * FROM ${wrap(table)}${where} ORDER BY ${orderBy[resource]}${limit}`,
    args,
  });
  return normalizeRows(result.rows) as unknown as T[];
}

/** @deprecated kept for the existing admin route signature. */
export async function getResourceRows(resource: ResourceName, activeOnly = false) {
  return listRows(resource, { activeOnly });
}

export async function getRow(resource: ResourceName, id: string) {
  await ensureDatabase();
  const result = await db.execute({ sql: `SELECT * FROM ${wrap(resourceTables[resource])} WHERE id = ?`, args: [id] });
  const row = result.rows[0];
  return row ? (rowToRecord(row) as Record<string, unknown>) : null;
}

export async function rowExists(resource: ResourceName, column: string, value: string, exceptId?: string) {
  await ensureDatabase();
  const table = resourceTables[resource];
  const result = await db.execute({
    sql: `SELECT id FROM ${wrap(table)} WHERE ${wrap(column)} = ?${exceptId ? " AND id <> ?" : ""} LIMIT 1`,
    args: exceptId ? [value, exceptId] : [value],
  });
  return Boolean(result.rows[0]);
}

/** Build a slug that is not already taken in this table. */
/**
 * Pre-flight check for UNIQUE columns (e.g. a setting key) so the studio gets a
 * readable 409 instead of a database error surfacing as a 500.
 */
export async function findUniqueConflict(
  resource: ResourceName,
  values: Record<string, string | number>,
  id?: string,
): Promise<{ error: string; status: 409 } | null> {
  for (const column of uniqueColumns[resource] ?? []) {
    if (column === "slug") continue; // handled by resolveSlug
    if (!(column in values)) continue;
    const value = String(values[column] ?? "").trim();
    if (!value) continue;
    if (await rowExists(resource, column, value, id)) {
      const label = fieldDef(resource, column)?.label ?? column;
      return { error: `“${label}” মানটি আগেই ব্যবহৃত হয়েছে (${value})। অন্যটি দিন।`, status: 409 };
    }
  }
  return null;
}

/** Generate a slug that satisfies the resource's own pattern, if it has one. */
export function generateSlug(resource: ResourceName, source: unknown) {
  const text = String(source ?? "").trim();
  if (!text) return "";
  const base = slugify(text);
  const field = fieldDef(resource, "slug");
  if (field?.pattern && !new RegExp(field.pattern, "u").test(base)) {
    // Club slugs stay ASCII so they can double as `{club}.okgs.info` subdomains.
    return asciiSlug(String(source ?? ""), resource.replace(/_/g, "-"));
  }
  return base;
}

/**
 * Normalise a slug before validation runs:
 *  - a slug typed by the admin is kept, but a duplicate is rejected;
 *  - an empty one is generated from the title/name (ASCII-safe for club subdomains).
 */
export async function resolveSlug(
  resource: ResourceName,
  values: Record<string, string | number>,
  id?: string,
): Promise<{ error: string; status: 409 } | null> {
  if (!fieldDef(resource, "slug")) return null;
  // Only touch the slug when the payload actually carries it — a partial PATCH
  // (inline publish toggle, quick edit) must never rename a live URL.
  if (!("slug" in values)) return null;
  const provided = slugify(String(values.slug ?? ""));
  if (provided) {
    values.slug = provided;
    if (await rowExists(resource, "slug", provided, id)) {
      return { error: `“${provided}” স্লাগটি আগেই ব্যবহৃত হয়েছে, অন্যটি ব্যবহার করুন।`, status: 409 };
    }
    return null;
  }
  const generated = generateSlug(resource, values.name || values.title || values.label || "");
  if (!generated) return null;
  values.slug = await uniqueSlug(resource, generated, id);
  return null;
}

export async function uniqueSlug(resource: ResourceName, base: string, exceptId?: string) {
  const cleaned = slugify(base) || `item-${Date.now().toString(36)}`;
  if (!(await rowExists(resource, "slug", cleaned, exceptId))) return cleaned;
  for (let suffix = 2; suffix < 60; suffix += 1) {
    const candidate = `${cleaned}-${suffix}`;
    if (!(await rowExists(resource, "slug", candidate, exceptId))) return candidate;
  }
  return `${cleaned}-${Date.now().toString(36)}`;
}

export async function insertRow(resource: ResourceName, payload: Record<string, string | number>) {
  await ensureDatabase();
  const id = randomUUID();
  const timestamp = now();
  const data: Record<string, string | number> = { ...payload, id };
  if (resource !== "settings") data.created_at = timestamp;
  data.updated_at = timestamp;

  const columns = Object.keys(data).filter((column) => column === "id" || column === "created_at" || column === "updated_at" || fieldsFor(resource).some((field) => field.name === column));
  await db.execute({
    sql: `INSERT INTO ${wrap(resourceTables[resource])} (${columns.map(wrap).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    args: columns.map((column) => data[column]),
  });
  const created = await getRow(resource, id);
  if (!created) throw new Error("Row could not be read back after saving.");
  return created;
}

export async function updateRow(resource: ResourceName, id: string, payload: Record<string, string | number>) {
  await ensureDatabase();
  const allowed = new Set(fieldsFor(resource).map((field) => field.name));
  const entries = Object.entries(payload).filter(([column]) => allowed.has(column));
  if (!entries.length) return { updated: false as const, row: await getRow(resource, id) };

  const updates = entries.map(([column]) => `${wrap(column)} = ?`);
  const args = entries.map(([, value]) => value);
  updates.push("updated_at = ?");
  args.push(now(), id);

  const result = await db.execute({
    sql: `UPDATE ${wrap(resourceTables[resource])} SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
  if (Number(result.rowsAffected) === 0) return { updated: false as const, row: null };
  return { updated: true as const, row: await getRow(resource, id) };
}

export async function deleteRow(resource: ResourceName, id: string) {
  await ensureDatabase();
  const result = await db.execute({ sql: `DELETE FROM ${wrap(resourceTables[resource])} WHERE id = ?`, args: [id] });
  return Number(result.rowsAffected) > 0;
}

/** Bulk delete used when a club is removed, so no orphans are left behind. */
export async function deleteWhere(resource: ResourceName, column: string, value: string) {
  await ensureDatabase();
  if (!fieldsFor(resource).some((field) => field.name === column)) return 0;
  const result = await db.execute({
    sql: `DELETE FROM ${wrap(resourceTables[resource])} WHERE ${wrap(column)} = ?`,
    args: [value],
  });
  return Number(result.rowsAffected ?? 0);
}

export async function reorderRows(resource: ResourceName, ids: string[]) {
  await ensureDatabase();
  if (!fieldsFor(resource).some((field) => field.name === "sort_order")) return;
  const statements: InStatement[] = ids.map((id, index) => ({
    sql: `UPDATE ${wrap(resourceTables[resource])} SET sort_order = ? WHERE id = ?`,
    args: [index + 1, id],
  }));
  if (statements.length) await db.batch(statements, "write");
}

export async function countsByResource() {
  await ensureDatabase();
  const entries = await Promise.all(
    resourceOrder.map(async (resource) => {
      const hasActive = fieldsFor(resource).some((field) => field.name === "is_active");
      const sql = hasActive
        ? `SELECT COUNT(*) as total, COALESCE(SUM(${wrap("is_active")}), 0) as live FROM ${wrap(resourceTables[resource])}`
        : `SELECT COUNT(*) as total, COUNT(*) as live FROM ${wrap(resourceTables[resource])}`;
      const result = await db.execute(sql);
      return [resource, { total: Number(result.rows[0]?.total ?? 0), live: Number(result.rows[0]?.live ?? 0) }] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<ResourceName, { total: number; live: number }>;
}

/* ---------------------------------------------------------------- *
 * Public reads
 * ---------------------------------------------------------------- */

export async function getPublicContent(): Promise<PublicContent> {
  const entries = await Promise.all(resourceOrder.map((resource) => listRows(resource, { activeOnly: true })));
  return Object.fromEntries(resourceOrder.map((resource, index) => [resource, entries[index]])) as unknown as PublicContent;
}

export function clubResources(resource: ResourceName) {
  return ["club_events", "club_posts", "club_gallery", "club_members", "club_achievements"].includes(resource);
}

export { slugify };
export type { Club, ClubAchievement, ClubEvent, ClubGalleryItem, ClubMember, ClubPost };
