import { createClient, type Client, type Row } from "@libsql/client";
import type {
  AdminRecord,
  Banner,
  Club,
  NewsItem,
  Notice,
  PublicContent,
  ResourceName,
  SiteSetting,
  Slide,
  UpdateItem,
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
    ...(process.env.TURSO_AUTH_TOKEN
      ? { authToken: process.env.TURSO_AUTH_TOKEN }
      : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.okgsDb = db;
}

const now = () => new Date().toISOString();

const schema = [
  `CREATE TABLE IF NOT EXISTS slides (
    id TEXT PRIMARY KEY,
    eyebrow TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cta_label TEXT NOT NULL DEFAULT 'Discover OKGS',
    cta_href TEXT NOT NULL DEFAULT '#about',
    image_url TEXT NOT NULL DEFAULT '',
    accent TEXT NOT NULL DEFAULT '#e7c27e',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'Notice',
    published_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS banners (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cta_label TEXT NOT NULL DEFAULT 'Learn more',
    cta_href TEXT NOT NULL DEFAULT '#about',
    image_url TEXT NOT NULL DEFAULT '',
    accent TEXT NOT NULL DEFAULT '#102d2a',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS news (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Campus life',
    author TEXT NOT NULL DEFAULT 'OKGS editorial desk',
    published_at TEXT NOT NULL,
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS updates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'Update',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS clubs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    tagline TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    accent TEXT NOT NULL DEFAULT '#e7c27e',
    icon TEXT NOT NULL DEFAULT 'Sparkles',
    image_url TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`,
];

const officialImage = "https://omarkgschool.com/images";

const seedSlides = [
  {
    id: "slide-welcome",
    eyebrow: "ওমর কিন্ডারগার্টেন স্কুল",
    title: "শিক্ষায় গড়ি আলোকিত ভবিষ্যৎ",
    description: "২০০৩ সাল থেকে কালাই, জয়পুরহাটে মানসম্মত শিক্ষায় নিবেদিত।",
    cta_label: "ভর্তি তথ্য",
    cta_href: "#admission",
    image_url: `${officialImage}/mission.jpg`,
    accent: "#d97706",
    sort_order: 1,
  },
  {
    id: "slide-campus",
    eyebrow: "প্লে থেকে দশম শ্রেণি",
    title: "আবাসিক ও অনাবাসিক পাঠদান",
    description: "নিরাপদ পরিবেশে একাডেমিক শিক্ষা, শৃঙ্খলা ও সহশিক্ষা কার্যক্রমের সমন্বিত পথচলা।",
    cta_label: "আমাদের সম্পর্কে",
    cta_href: "#about",
    image_url: `${officialImage}/hero-assembly.jpg`,
    accent: "#166534",
    sort_order: 2,
  },
  {
    id: "slide-science",
    eyebrow: "ART ODYSSEY — বিজ্ঞান মেলা",
    title: "শিক্ষার্থীর প্রতিটি সম্ভাবনায় পাশে",
    description: "বিজ্ঞান, সংস্কৃতি, খেলাধুলা ও প্রযুক্তির মাধ্যমে কৌতূহলী মনকে বিকশিত করি।",
    cta_label: "ক্যাম্পাস দেখুন",
    cta_href: "#gallery",
    image_url: `${officialImage}/science-fair-1.jpg`,
    accent: "#15803d",
    sort_order: 3,
  },
];

const seedNotices = [
  {
    id: "notice-admission",
    title: "২০২৬ শিক্ষাবর্ষে ভর্তি চলছে",
    body: "প্লে থেকে দশম শ্রেণি পর্যন্ত আবাসিক ও অনাবাসিক ভর্তি চলছে।",
    type: "ভর্তি",
    published_at: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "notice-boarding",
    title: "আবাসিক শিক্ষার্থীদের নতুন সেশন শুরু",
    body: "ছেলে ও মেয়েদের জন্য আলাদা আবাসিক ভবনে সীমিত আসন রয়েছে।",
    type: "আবাসিক",
    published_at: "2026-09-26T09:00:00.000Z",
  },
  {
    id: "notice-science-fair",
    title: "ART ODYSSEY বিজ্ঞান মেলার প্রস্তুতি চলছে",
    body: "বিজ্ঞান মেলা, ক্র্যাফটিং, নাটক, গান ও আইসিটি প্রতিযোগিতায় শিক্ষার্থীরা অংশ নিচ্ছে।",
    type: "কার্যক্রম",
    published_at: "2026-09-20T09:00:00.000Z",
  },
];

const seedBanners = [
  {
    id: "banner-admission",
    label: "ভর্তি চলছে",
    title: "আপনার সন্তানের উজ্জ্বল ভবিষ্যৎ শুরু হোক",
    description: "প্রি-প্রাইমারিতে আবাকাস, স্পোকেন ইংলিশ, কম্পিউটার ও কুরআন শিক্ষায় বিশেষ গুরুত্ব।",
    cta_label: "ভর্তি সংক্রান্ত তথ্য",
    cta_href: "#admission",
    image_url: `${officialImage}/admission-notice.jpg`,
    accent: "#14532d",
    sort_order: 1,
  },
  {
    id: "banner-science",
    label: "বার্ষিক আয়োজন",
    title: "বিজ্ঞান মেলা ও সৃজনশীলতার উৎসব",
    description: "শিক্ষার সাথে জীবনের যোগ তৈরি করতে প্রতিবছর আমাদের ক্যাম্পাসে ART ODYSSEY আয়োজন করা হয়।",
    cta_label: "গ্যালারি দেখুন",
    cta_href: "#gallery",
    image_url: `${officialImage}/science-fair-2.jpg`,
    accent: "#166534",
    sort_order: 2,
  },
];

const seedNews = [
  {
    id: "news-science-fair",
    slug: "art-odyssey-science-fair",
    title: "ART ODYSSEY বিজ্ঞান মেলায় শিক্ষার্থীদের প্রাণবন্ত অংশগ্রহণ",
    excerpt: "বিজ্ঞান, ক্র্যাফটিং, নাটক, গান, কবিতা ও আইসিটি প্রোগ্রামিংয়ের মধ্য দিয়ে শিক্ষার্থীরা নিজেদের সৃজনশীলতা প্রকাশ করেছে।",
    body: "প্রতি বছর ওমর কিন্ডারগার্টেন স্কুলে অনুষ্ঠিত হয় ART ODYSSEY বিজ্ঞান মেলা। বিজ্ঞানের প্রতি আগ্রহ বাড়ানো ও জীবনের সাথে বিজ্ঞানের সম্পৃক্ততা তুলে ধরাই এই আয়োজনের লক্ষ্য।",
    image_url: `${officialImage}/science-fair-2.jpg`,
    category: "বিজ্ঞান মেলা",
    author: "ওমর কিন্ডারগার্টেন স্কুল",
    published_at: "2026-09-28T09:00:00.000Z",
    is_featured: 1,
  },
  {
    id: "news-campus",
    slug: "learning-beyond-classroom",
    title: "শ্রেণিকক্ষের বাইরে শেখার আনন্দ",
    excerpt: "শিক্ষা সফর, সাংস্কৃতিক অনুষ্ঠান, খেলাধুলা ও ক্লাব কার্যক্রমে শিক্ষার্থীদের বছরজুড়ে অংশগ্রহণ।",
    body: "আমাদের শিক্ষার্থীরা পড়াশোনার পাশাপাশি খেলাধুলা, শিক্ষা-সংস্কৃতি ও সামাজিক কার্যাবলীতে নিয়মিত অংশ নেয়।",
    image_url: `${officialImage}/gallery-3.jpg`,
    category: "ক্যাম্পাস",
    author: "ওকেজিএস বার্তা",
    published_at: "2026-09-18T09:00:00.000Z",
    is_featured: 0,
  },
  {
    id: "news-assembly",
    slug: "new-session-at-okgs",
    title: "নতুন শিক্ষাবর্ষে নতুন উদ্যম",
    excerpt: "শিক্ষার্থী, শিক্ষক ও অভিভাবকদের অংশগ্রহণে নতুন শিক্ষাবর্ষের প্রস্তুতি ও স্বাগত কার্যক্রম।",
    body: "নতুন শিক্ষাবর্ষে একাডেমিক ক্যালেন্ডার, নিয়মিত মূল্যায়ন ও সহশিক্ষা কার্যক্রমকে সামনে রেখে আমাদের পথচলা শুরু হয়েছে।",
    image_url: `${officialImage}/hero-assembly.jpg`,
    category: "শিক্ষা",
    author: "ওমর কিন্ডারগার্টেন স্কুল",
    published_at: "2026-09-10T09:00:00.000Z",
    is_featured: 0,
  },
];

const seedUpdates = [
  {
    id: "update-01",
    title: "ভর্তি ও আবাসিক আসন সম্পর্কে যোগাযোগ করুন",
    description: "ভর্তি ও হোস্টেল সংক্রান্ত তথ্যের জন্য ০১৩২৯-৬২৫৭০০ নম্বরে যোগাযোগ করুন।",
    date: "2026-10-01",
    kind: "ভর্তি",
  },
  {
    id: "update-02",
    title: "ক্লাব কার্যক্রমে সদস্য নিবন্ধন চলছে",
    description: "ম্যাথ, ভাষা, কম্পিউটার, স্পোর্টিং ও বিতর্ক-সংস্কৃতি ক্লাবে অংশ নিন।",
    date: "2026-09-27",
    kind: "ক্লাব",
  },
  {
    id: "update-03",
    title: "পাঠাগারে নতুন বই যুক্ত হয়েছে",
    description: "দুই হাজারের বেশি বইয়ের পাঠাগারে শিক্ষার্থীদের জন্য নতুন বই যোগ হয়েছে।",
    date: "2026-09-22",
    kind: "ক্যাম্পাস",
  },
  {
    id: "update-04",
    title: "বার্ষিক বিজ্ঞান মেলার প্রস্তুতি",
    description: "ART ODYSSEY-তে শিক্ষার্থীদের প্রকল্প ও সৃজনশীল কাজ প্রদর্শিত হবে।",
    date: "2026-09-15",
    kind: "বিজ্ঞান",
  },
];

const seedClubs = [
  {
    id: "club-science",
    name: "ম্যাথ এন্ড সাইন্স ক্লাব",
    slug: "science",
    tagline: "গণিত ও বিজ্ঞানে কৌতূহল",
    description: "গণিত ও বিজ্ঞানের ভয় দূর করা, কুইজ, বিজ্ঞান মেলা ও অলিম্পিয়াডের প্রস্তুতি।",
    accent: "#f59e0b",
    icon: "Atom",
    image_url: `${officialImage}/club-science-1.jpg`,
    domain: "https://science.okgs.info",
    sort_order: 1,
  },
  {
    id: "club-language",
    name: "ল্যাংগুয়েজ ক্লাব",
    slug: "language",
    tagline: "ভাষা ও সাহিত্যের চর্চা",
    description: "শুদ্ধ বাংলা, ইংরেজি গ্রামার, আবৃত্তি, বক্তৃতা ও বিতর্কের নিয়মিত আয়োজন।",
    accent: "#f97316",
    icon: "BookOpen",
    image_url: `${officialImage}/club-language-1.jpg`,
    domain: "https://language.okgs.info",
    sort_order: 2,
  },
  {
    id: "club-computer",
    name: "কম্পিউটার ক্লাব",
    slug: "computer",
    tagline: "প্রযুক্তিতে দক্ষতার শুরু",
    description: "আইসিটি, প্রোগ্রামিং, ওয়েব ডেভেলপমেন্ট ও তথ্য খোঁজার দক্ষতা গড়ে তোলা।",
    accent: "#0ea5e9",
    icon: "Monitor",
    image_url: `${officialImage}/club-computer-1.jpg`,
    domain: "https://computer.okgs.info",
    sort_order: 3,
  },
  {
    id: "club-sports",
    name: "স্পোর্টিং ক্লাব",
    slug: "sports",
    tagline: "খেলাধুলায় সুস্থ শরীর",
    description: "মোবাইল আসক্তি দূর করে খেলাধুলায় উৎসাহ এবং স্থানীয় থেকে জাতীয় পর্যায়ে অংশগ্রহণ।",
    accent: "#22c55e",
    icon: "Trophy",
    image_url: `${officialImage}/club-sports-1.jpg`,
    domain: "https://sports.okgs.info",
    sort_order: 4,
  },
  {
    id: "club-culture",
    name: "বিতর্ক ও সংস্কৃতি ক্লাব",
    slug: "culture",
    tagline: "কথা, সংস্কৃতি ও নেতৃত্ব",
    description: "বিতর্ক, কবিতা, গান, নাটক ও সাংস্কৃতিক কার্যক্রমে আত্মবিশ্বাসী হওয়ার সুযোগ।",
    accent: "#a855f7",
    icon: "MessagesSquare",
    image_url: `${officialImage}/club-language-2.jpg`,
    domain: "https://culture.okgs.info",
    sort_order: 5,
  },
];

const seedSettings = [
  {
    id: "setting-site-name",
    key: "site_name",
    label: "প্রতিষ্ঠানের নাম",
    value: "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি",
    description: "ওয়েবসাইটে প্রদর্শিত প্রতিষ্ঠানের নাম।",
  },
  {
    id: "setting-tagline",
    key: "tagline",
    label: "সংক্ষিপ্ত পরিচিতি",
    value: "২০০৩ সাল থেকে কালাই, জয়পুরহাটে মানসম্মত শিক্ষায় নিবেদিত।",
    description: "হেডার ও ফুটারে প্রদর্শিত পরিচিতি।",
  },
  {
    id: "setting-about",
    key: "about",
    label: "প্রতিষ্ঠান সম্পর্কে",
    value: "ওমর কিন্ডারগার্টেন স্কুল ও ওমর গার্টেন একাডেমি জয়পুরহাট জেলার কালাই উপজেলা সদরে অবস্থিত একটি স্বনামধন্য শিক্ষা প্রতিষ্ঠান। ২০০৩ সালের ১লা জানুয়ারি বিশিষ্ট শিক্ষানুরাগী আলহাজ্ব আব্দুর রশিদ তালুকদার প্রতিষ্ঠানটি প্রতিষ্ঠা করেন।",
    description: "হোমপেজের সংক্ষিপ্ত পরিচিতি।",
  },
  {
    id: "setting-mission",
    key: "mission",
    label: "লক্ষ্য",
    value: "মানসম্মত শিক্ষা, শৃঙ্খলা ও মানবিক মূল্যবোধে গড়ে তুলি আগামী প্রজন্ম।",
    description: "পরিচিতি অংশে প্রদর্শিত লক্ষ্য।",
  },
  {
    id: "setting-email",
    key: "email",
    label: "ইমেইল",
    value: "okgs2003@gmail.com",
    description: "প্রধান যোগাযোগ ইমেইল।",
  },
  {
    id: "setting-phone",
    key: "phone",
    label: "হেল্পলাইন",
    value: "01711857205",
    description: "প্রধান হেল্পলাইন নম্বর।",
  },
  {
    id: "setting-admission-phone",
    key: "admission_phone",
    label: "ভর্তি ও হোস্টেল নম্বর",
    value: "01329625700",
    description: "ভর্তি ও আবাসিক তথ্যের নম্বর।",
  },
  {
    id: "setting-secondary-phone",
    key: "phone_secondary",
    label: "অফিস নম্বর",
    value: "05725-56351-52",
    description: "অতিরিক্ত অফিস যোগাযোগ নম্বর।",
  },
  {
    id: "setting-address",
    key: "address",
    label: "ঠিকানা",
    value: "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি, কালাই সদর, জয়পুরহাট",
    description: "ফুটারে প্রদর্শিত ঠিকানা।",
  },
];

const seedTable = async (
  table: string,
  rows: Record<string, string | number>[],
  columns: string[],
) => {
  const countResult = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
  const count = Number(countResult.rows[0]?.count ?? 0);
  if (count > 0 || rows.length === 0) return;

  const statements = rows.map((row) => {
    const values = columns.map((column) => row[column] ?? "");
    const placeholders = columns.map(() => "?").join(", ");
    return {
      sql: `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      args: values,
    };
  });
  await db.batch(statements, "write");
};

async function bootstrap() {
  await db.batch(schema, "write");
  const createdAt = now();
  await seedTable(
    "slides",
    seedSlides.map((row) => ({ ...row, is_active: 1, created_at: createdAt, updated_at: createdAt })),
    [
      "id",
      "eyebrow",
      "title",
      "description",
      "cta_label",
      "cta_href",
      "image_url",
      "accent",
      "sort_order",
      "is_active",
      "created_at",
      "updated_at",
    ],
  );
  await seedTable(
    "notices",
    seedNotices.map((row) => ({ ...row, is_active: 1, created_at: createdAt, updated_at: createdAt })),
    ["id", "title", "body", "type", "published_at", "is_active", "created_at", "updated_at"],
  );
  await seedTable(
    "banners",
    seedBanners.map((row) => ({ ...row, is_active: 1, created_at: createdAt, updated_at: createdAt })),
    [
      "id",
      "label",
      "title",
      "description",
      "cta_label",
      "cta_href",
      "image_url",
      "accent",
      "sort_order",
      "is_active",
      "created_at",
      "updated_at",
    ],
  );
  await seedTable(
    "news",
    seedNews.map((row) => ({ ...row, is_active: 1, created_at: createdAt, updated_at: createdAt })),
    [
      "id",
      "slug",
      "title",
      "excerpt",
      "body",
      "image_url",
      "category",
      "author",
      "published_at",
      "is_featured",
      "is_active",
      "created_at",
      "updated_at",
    ],
  );
  await seedTable(
    "updates",
    seedUpdates.map((row) => ({ ...row, is_active: 1, created_at: createdAt, updated_at: createdAt })),
    ["id", "title", "description", "date", "kind", "is_active", "created_at", "updated_at"],
  );
  await seedTable(
    "clubs",
    seedClubs.map((row) => ({ ...row, is_active: 1, created_at: createdAt, updated_at: createdAt })),
    [
      "id",
      "name",
      "slug",
      "tagline",
      "description",
      "accent",
      "icon",
      "image_url",
      "domain",
      "sort_order",
      "is_active",
      "created_at",
      "updated_at",
    ],
  );
  await seedTable(
    "settings",
    seedSettings.map((row) => ({ ...row, updated_at: createdAt })),
    ["id", "key", "label", "value", "description", "updated_at"],
  );
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

const resourceTables: Record<ResourceName, string> = {
  slides: "slides",
  notices: "notices",
  banners: "banners",
  news: "news",
  updates: "updates",
  clubs: "clubs",
  settings: "settings",
};

const orderBy: Record<ResourceName, string> = {
  slides: "sort_order ASC, created_at DESC",
  notices: "published_at DESC",
  banners: "sort_order ASC, created_at DESC",
  news: "published_at DESC",
  updates: "date DESC",
  clubs: "sort_order ASC, created_at DESC",
  settings: "label ASC",
};

const booleanFields = new Set(["is_active", "is_featured"]);

export function normalizeRows(rows: Row[]) {
  return rows.map((row) => {
    const item: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      item[key] = booleanFields.has(key) ? Number(value) === 1 : value;
    }
    return item;
  });
}

export async function getResourceRows(resource: ResourceName, activeOnly = false) {
  await ensureDatabase();
  const table = resourceTables[resource];
  const where = activeOnly && resource !== "settings" ? " WHERE is_active = 1" : "";
  const result = await db.execute(`SELECT * FROM ${table}${where} ORDER BY ${orderBy[resource]}`);
  return normalizeRows(result.rows) as unknown as AdminRecord[];
}

export async function getPublicContent(): Promise<PublicContent> {
  const [slides, notices, banners, news, updates, clubs, settings] = await Promise.all([
    getResourceRows("slides", true),
    getResourceRows("notices", true),
    getResourceRows("banners", true),
    getResourceRows("news", true),
    getResourceRows("updates", true),
    getResourceRows("clubs", true),
    getResourceRows("settings"),
  ]);

  return {
    slides: slides as Slide[],
    notices: notices as Notice[],
    banners: banners as Banner[],
    news: news as NewsItem[],
    updates: updates as UpdateItem[],
    clubs: clubs as Club[],
    settings: settings as SiteSetting[],
  };
}

export function resourceTable(resource: ResourceName) {
  return resourceTables[resource];
}

export const dashboardResources: ResourceName[] = [
  "slides",
  "notices",
  "banners",
  "news",
  "updates",
  "clubs",
  "settings",
];
