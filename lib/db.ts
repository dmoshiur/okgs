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

const seedSlides = [
  {
    id: "slide-welcome",
    eyebrow: "A school shaped by wonder",
    title: "Big ideas begin with small, brave questions.",
    description:
      "At OKGS, childhood is the starting point for a life of curiosity, character and confident contribution.",
    cta_label: "Explore our story",
    cta_href: "#about",
    image_url:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=2000&q=88",
    accent: "#e8be74",
    sort_order: 1,
  },
  {
    id: "slide-community",
    eyebrow: "Learning in every direction",
    title: "A joyful campus for every kind of learner.",
    description:
      "From the first hello in the morning to the final club session, our days are designed to make belonging visible.",
    cta_label: "See life at OKGS",
    cta_href: "#clubs",
    image_url:
      "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=2000&q=88",
    accent: "#f3d6a1",
    sort_order: 2,
  },
  {
    id: "slide-future",
    eyebrow: "The OKGS promise",
    title: "Ready for tomorrow. Rooted in what matters.",
    description:
      "We pair ambitious learning with empathy, making room for every voice to grow into its own bright direction.",
    cta_label: "Meet the community",
    cta_href: "#community",
    image_url:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=2000&q=88",
    accent: "#b8d5c2",
    sort_order: 3,
  },
];

const seedNotices = [
  {
    id: "notice-open-day",
    title: "Open campus morning — Saturday, 18 October",
    body: "Come and experience a morning at OKGS. Tours begin at 9:30 and places are limited.",
    type: "Admissions",
    published_at: "2026-09-28T09:00:00.000Z",
  },
  {
    id: "notice-term-one",
    title: "Term one learning snapshots are now live",
    body: "Families can explore classroom moments, progress notes and upcoming learning goals in the family portal.",
    type: "Family note",
    published_at: "2026-09-22T09:00:00.000Z",
  },
  {
    id: "notice-sports-week",
    title: "Club discovery week starts Monday",
    body: "All five student clubs will be hosting taster sessions across the campus this week.",
    type: "Campus life",
    published_at: "2026-09-16T09:00:00.000Z",
  },
];

const seedBanners = [
  {
    id: "banner-join",
    label: "Admissions 2027",
    title: "Give curiosity room to grow.",
    description:
      "Applications for our next academic year are now open. Start with a conversation about your child.",
    cta_label: "Begin a conversation",
    cta_href: "mailto:hello@okgs.info",
    image_url:
      "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1400&q=85",
    accent: "#173e3a",
    sort_order: 1,
  },
  {
    id: "banner-family",
    label: "The OKGS journal",
    title: "Small moments. Lasting stories.",
    description:
      "Read notes from our classrooms, clubs and the people who make this community feel like home.",
    cta_label: "Read the latest",
    cta_href: "#news",
    image_url:
      "https://images.unsplash.com/photo-1501349800519-48093d60bde0?auto=format&fit=crop&w=1400&q=85",
    accent: "#785e3c",
    sort_order: 2,
  },
];

const seedNews = [
  {
    id: "news-makers",
    slug: "the-makers-behind-the-magic",
    title: "The makers behind the magic",
    excerpt:
      "Inside our creative studio, students are turning recycled materials, wild ideas and patient teamwork into something entirely new.",
    body: "Inside our creative studio, students are turning recycled materials, wild ideas and patient teamwork into something entirely new.",
    image_url:
      "https://images.unsplash.com/photo-1560785496-3c9d27877182?auto=format&fit=crop&w=1400&q=85",
    category: "Learning",
    author: "Nadia Rahman",
    published_at: "2026-09-25T09:00:00.000Z",
    is_featured: 1,
  },
  {
    id: "news-kindness-lab",
    slug: "inside-the-kindness-lab",
    title: "Inside the kindness lab",
    excerpt:
      "Our youngest learners are discovering that empathy is not just a feeling — it is a practice we can build together.",
    body: "Our youngest learners are discovering that empathy is not just a feeling — it is a practice we can build together.",
    image_url:
      "https://images.unsplash.com/photo-1607453998774-d533f65dac99?auto=format&fit=crop&w=1200&q=85",
    category: "Community",
    author: "OKGS editorial desk",
    published_at: "2026-09-18T09:00:00.000Z",
    is_featured: 0,
  },
  {
    id: "news-garden",
    slug: "a-garden-that-teaches-us-back",
    title: "A garden that teaches us back",
    excerpt:
      "Our growing garden is a living classroom — from first shoots to shared harvests and questions no worksheet could hold.",
    body: "Our growing garden is a living classroom — from first shoots to shared harvests and questions no worksheet could hold.",
    image_url:
      "https://images.unsplash.com/photo-1599685315640-5c8e1b7a46b0?auto=format&fit=crop&w=1200&q=85",
    category: "Outdoors",
    author: "Farhan Karim",
    published_at: "2026-09-11T09:00:00.000Z",
    is_featured: 0,
  },
];

const seedUpdates = [
  {
    id: "update-01",
    title: "Admissions conversations are open",
    description: "Our admissions team is ready to talk through your questions and help you find your next step.",
    date: "2026-09-30",
    kind: "Admissions",
  },
  {
    id: "update-02",
    title: "Five new club pathways for autumn",
    description: "Students can now join a taster session for any of our five clubs during discovery week.",
    date: "2026-09-26",
    kind: "Student life",
  },
  {
    id: "update-03",
    title: "Family learning snapshots",
    description: "Term one snapshots are being shared with families through the secure family portal.",
    date: "2026-09-22",
    kind: "Family note",
  },
  {
    id: "update-04",
    title: "The library is open late on Thursdays",
    description: "Drop in after school for quiet reading, story circles and a little more time with a good book.",
    date: "2026-09-15",
    kind: "Campus life",
  },
];

const seedClubs = [
  {
    id: "club-arts",
    name: "Arts & Culture",
    slug: "arts",
    tagline: "Make room for the unexpected.",
    description: "A studio for young voices, visual thinkers, performers and makers.",
    accent: "#e6a75f",
    icon: "Palette",
    image_url:
      "https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1000&q=85",
    domain: "https://arts.okgs.info",
    sort_order: 1,
  },
  {
    id: "club-science",
    name: "Science & Discovery",
    slug: "science",
    tagline: "Ask better questions.",
    description: "A hands-on lab for experiments, observations and wonderfully messy thinking.",
    accent: "#8fb6a3",
    icon: "Atom",
    image_url:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1000&q=85",
    domain: "https://science.okgs.info",
    sort_order: 2,
  },
  {
    id: "club-sports",
    name: "Sports & Wellness",
    slug: "sports",
    tagline: "Find your rhythm.",
    description: "Movement, teamwork and the confidence that comes from trying again.",
    accent: "#d78678",
    icon: "Trophy",
    image_url:
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1000&q=85",
    domain: "https://sports.okgs.info",
    sort_order: 3,
  },
  {
    id: "club-debate",
    name: "Debate & Leadership",
    slug: "debate",
    tagline: "Speak with purpose.",
    description: "A generous forum for ideas, listening, collaboration and brave first drafts.",
    accent: "#c3a6d4",
    icon: "MessagesSquare",
    image_url:
      "https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=1000&q=85",
    domain: "https://debate.okgs.info",
    sort_order: 4,
  },
  {
    id: "club-green",
    name: "Green Futures",
    slug: "green",
    tagline: "Care changes everything.",
    description: "Growing practical hope through gardens, stewardship and community action.",
    accent: "#9ebd78",
    icon: "Sprout",
    image_url:
      "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1000&q=85",
    domain: "https://green.okgs.info",
    sort_order: 5,
  },
];

const seedSettings = [
  {
    id: "setting-site-name",
    key: "site_name",
    label: "School name",
    value: "Omar Kindergarten School",
    description: "The name shown across the public site.",
  },
  {
    id: "setting-tagline",
    key: "tagline",
    label: "Site tagline",
    value: "A bright beginning for every possibility.",
    description: "Short line used in the navigation and footer.",
  },
  {
    id: "setting-about",
    key: "about",
    label: "About the school",
    value:
      "OKGS is a warm, future-facing school where children learn to notice deeply, make bravely and care generously. Our classrooms connect rigorous foundations with the freedom to wonder.",
    description: "The main school story shown in the About section.",
  },
  {
    id: "setting-mission",
    key: "mission",
    label: "Mission statement",
    value: "Grow curious minds. Grounded hearts. Generous futures.",
    description: "The short mission line used in the community section.",
  },
  {
    id: "setting-email",
    key: "email",
    label: "Contact email",
    value: "hello@okgs.info",
    description: "Primary public contact email.",
  },
  {
    id: "setting-address",
    key: "address",
    label: "Campus address",
    value: "12 Orchard Lane, Dhaka 1212",
    description: "The address shown in the footer.",
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
