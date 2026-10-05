import type { FieldOption, ResourceName } from "@/lib/types";

/* ------------------------------------------------------------------ *
 * The single source of truth for OKGS content.
 *
 * Add a field here and it automatically appears in:
 *   - the SQLite/Turso schema (lib/db.ts reads these definitions)
 *   - the admin editor form, table + validation (schema-driven)
 *   - the public club pages
 * ------------------------------------------------------------------ */

export type { ResourceName };

const iconOptions: FieldOption[] = [
  { label: "Atom — বিজ্ঞান", value: "Atom" },
  { label: "BookOpen — সাহিত্য", value: "BookOpen" },
  { label: "Monitor — কম্পিউটার", value: "Monitor" },
  { label: "Trophy — খেলাধুলা", value: "Trophy" },
  { label: "MessagesSquare — বিতর্ক", value: "MessagesSquare" },
  { label: "Palette — চারুকলা", value: "Palette" },
  { label: "Sprout — নার্সারি", value: "Sprout" },
  { label: "Leaf — পরিবেশ", value: "Leaf" },
  { label: "Music — সংগীত", value: "Music" },
  { label: "HeartHandshake — সমাজসেবা", value: "HeartHandshake" },
  { label: "ShieldCheck — নিরাপত্তা", value: "ShieldCheck" },
  { label: "Sparkles — সাধারণ", value: "Sparkles" },
];

export const clubIconOptions = iconOptions;

/**
 * The five real OKGS clubs. The slug doubles as the folder name of the club's own
 * website (`clubs/<slug>/`) and as its subdomain prefix, so keep them short.
 */
const clubOptions: FieldOption[] = [
  { label: "ALSSM — ম্যাথ এন্ড সাইন্স ক্লাব", value: "alssm" },
  { label: "AYPG — ল্যাংগুয়েজ ক্লাব", value: "aypg" },
  { label: "ALPCG — কম্পিউটার ক্লাব", value: "alpcg" },
  { label: "AYGSM — স্পোর্টিং ক্লাব", value: "aygsm" },
  { label: "ARTDS — ART Debating Society", value: "artds" },
];

/** Live options are read from the database; these are the admin defaults. */
export const defaultClubOptions = clubOptions;

interface FieldDef {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "url"
    | "image"
    | "color"
    | "number"
    | "date"
    | "datetime"
    | "boolean"
    | "select"
    | "reference";
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: FieldOption[];
  /** Which table a `reference` points at. */
  reference?: "clubs" | "fairs";
  /** Renders as its own block in the editor instead of a two-column row. */
  full?: boolean;
  rows?: number;
  /** Fieldset heading inside the editor modal. */
  group?: string;
  /** Regex the stored value must match (validated in the API and the form). */
  pattern?: string;
  patternError?: string;
  default?: string | number | boolean;
  sql?: string;
}

export type { FieldDef };

const groupBasics = "মূল তথ্য";
const groupMedia = "ছবি ও মিডিয়া";
const groupContact = "যোগাযোগ ও লিংক";

const sortField: FieldDef = {
  name: "sort_order",
  label: "ক্রম",
  type: "number",
  group: groupBasics,
  help: "ছোট সংখ্যা আগে দেখানো হবে।",
  default: 0,
};

const activeField: FieldDef = {
  name: "is_active",
  label: "প্রকাশিত",
  type: "boolean",
  group: groupBasics,
  help: "বন্ধ করলে সাইটে দেখাবে না।",
  default: true,
};

export const isActiveField = activeField;

const featuredField: FieldDef = {
  name: "is_featured",
  label: "বিশেষ / হাইলাইট",
  type: "boolean",
  group: groupBasics,
  help: "ক্লাব পাতার উপরে প্রথম দেখানো হবে।",
  default: false,
};

const clubField: FieldDef = {
  name: "club_slug",
  label: "ক্লাব",
  type: "reference",
  reference: "clubs",
  required: true,
  group: groupBasics,
  help: "এই তথ্যটি কোন ক্লাবের — ক্লাবের নিজস্ব পাতায় দেখানো হবে।",
  options: clubOptions,
};

const fairOptions: FieldOption[] = [
  { label: "OKGS Science Fair 2026", value: "science-fair-2026" },
];

export const defaultFairOptions = fairOptions;

/** Rows that belong to a science fair (categories, schedule, collections). */
const fairField: FieldDef = {
  name: "fair_slug",
  label: "বিজ্ঞান মেলা",
  type: "reference",
  reference: "fairs",
  group: groupBasics,
  help: "কোন মেলার তথ্য — খালি রাখলে চলতি মেলা ধরে নেওয়া হবে।",
  options: fairOptions,
};

const publishDateField: FieldDef = {
  name: "published_at",
  label: "প্রকাশের তারিখ",
  type: "datetime",
  group: groupBasics,
};

export const resourceSchema: Record<ResourceName, FieldDef[]> = {
  slides: [
    { name: "eyebrow", label: "উপরের লেবেল", type: "text", group: groupBasics, placeholder: "ওমর কিন্ডারগার্টেন স্কুল" },
    { name: "title", label: "শিরোনাম", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "বিবরণ", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "cta_label", label: "বোতামের লেখা", type: "text", group: groupBasics, default: "ভর্তি তথ্য" },
    { name: "cta_href", label: "বোতামের লিংক", type: "text", group: groupBasics, placeholder: "#admission বা /clubs", default: "#admission" },
    { name: "image_url", label: "স্লাইডের ছবি", type: "image", full: true, group: groupMedia },
    { name: "accent", label: "অ্যাকসেন্ট রং", type: "color", group: groupBasics, default: "#e7c27e" },
    { ...clubField, required: false, help: "কোন ক্লাবের ছবি — দিলে স্লাইডারটি ক্লাব-অনুযায়ী ফিল্টার/লেবেল হয়।" },
    sortField,
    activeField,
  ],
  notices: [
    { ...clubField, required: false, help: "চাইলে কোনো ক্লাবের সাথে যুক্ত করুন (খালি রাখলে স্কুলের সাধারণ নোটিশ)।" },
    { name: "title", label: "নোটিশের শিরোনাম", type: "text", required: true, full: true, group: groupBasics },
    { name: "body", label: "বিস্তারিত", type: "textarea", full: true, group: groupBasics, rows: 5 },
    {
      name: "type",
      label: "নোটিশের ধরন",
      type: "select",
      group: groupBasics,
      default: "সাধারণ",
      options: [
        { label: "সাধারণ", value: "সাধারণ" },
        { label: "ভর্তি", value: "ভর্তি" },
        { label: "আবাসিক", value: "আবাসিক" },
        { label: "পরীক্ষা", value: "পরীক্ষা" },
        { label: "কার্যক্রম", value: "কার্যক্রম" },
        { label: "জরুরি", value: "জরুরি" },
      ],
    },
    publishDateField,
    activeField,
  ],
  banners: [
    { name: "label", label: "ছোট লেবেল", type: "text", group: groupBasics },
    { name: "title", label: "শিরোনাম", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "বিবরণ", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "cta_label", label: "বোতামের লেখা", type: "text", group: groupBasics, default: "বিস্তারিত" },
    { name: "cta_href", label: "বোতামের লিংক", type: "text", group: groupBasics, default: "#admission" },
    { name: "image_url", label: "ব্যানারের ছবি", type: "image", full: true, group: groupMedia },
    { name: "accent", label: "অ্যাকসেন্ট রং", type: "color", group: groupBasics, default: "#102d2a" },
    sortField,
    activeField,
  ],
  news: [
    { name: "title", label: "শিরোনাম", type: "text", required: true, full: true, group: groupBasics },
    {
      name: "slug",
      label: "ইউআরএল স্লাগ",
      type: "text",
      group: groupBasics,
      help: "খালি রাখলে শিরোনাম থেকে তৈরি হবে।",
      pattern: "^[\\p{Letter}\\p{Number}][\\p{Letter}\\p{Number}-]{1,80}$",
      patternError: "স্লাগে স্পেস বা / \ ? # চিহ্ন দেওয়া যাবে না।",
    },
    { ...clubField, required: false, help: "কোনো ক্লাব বেছে নিলে সংবাদটি সেই ক্লাবের পাতায়ও দেখাবে।" },
    { name: "excerpt", label: "সংক্ষিপ্ত লেখা", type: "textarea", full: true, group: groupBasics, rows: 2 },
    { name: "body", label: "বিস্তারিত লেখা", type: "textarea", full: true, group: groupBasics, rows: 8 },
    { name: "image_url", label: "ছবি", type: "image", full: true, group: groupMedia },
    {
      name: "category",
      label: "বিভাগ",
      type: "select",
      group: groupBasics,
      default: "ক্যাম্পাস",
      options: [
        { label: "ক্যাম্পাস", value: "ক্যাম্পাস" },
        { label: "শিক্ষা", value: "শিক্ষা" },
        { label: "বিজ্ঞান মেলা", value: "বিজ্ঞান মেলা" },
        { label: "সাংস্কৃতিক", value: "সাংস্কৃতিক" },
        { label: "খেলাধুলা", value: "খেলাধুলা" },
        { label: "সেবা", value: "সেবা" },
      ],
    },
    { name: "author", label: "লিখেছে", type: "text", group: groupBasics, default: "ওকেজিএস বার্তা" },
    publishDateField,
    featuredField,
    activeField,
  ],
  updates: [
    { name: "title", label: "শিরোনাম", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "বিবরণ", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "date", label: "তারিখ", type: "date", group: groupBasics },
    {
      name: "kind",
      label: "ধরন",
      type: "select",
      group: groupBasics,
      default: "কার্যক্রম",
      options: [
        { label: "ভর্তি", value: "ভর্তি" },
        { label: "ক্লাব", value: "ক্লাব" },
        { label: "ক্যাম্পাস", value: "ক্যাম্পাস" },
        { label: "বিজ্ঞান", value: "বিজ্ঞান" },
        { label: "ফলাফল", value: "ফলাফল" },
      ],
    },
    activeField,
  ],
  clubs: [
    { name: "name", label: "ক্লাবের নাম", type: "text", required: true, full: true, group: groupBasics, placeholder: "ম্যাথ এন্ড সাইন্স ক্লাব" },
    {
      name: "slug",
      label: "ইউআরএল স্লাগ",
      type: "text",
      required: true,
      group: groupBasics,
      help: "/clubs/এই-স্লাগ ঠিকানায় পাতাটি তৈরি হবে — ইংরেজি ছোট হাতের অক্ষর, সংখ্যা বা হাইফেন।",
      pattern: "^[a-z0-9][a-z0-9-]{1,40}$",
      patternError: "স্লাগ ইংরেজি ছোট হাতের অক্ষর, সংখ্যা বা হাইফেন (-) দিয়ে লিখুন, যেমন science বা math-club।",
    },
    { name: "tagline", label: "ট্যাগলাইন", type: "text", full: true, group: groupBasics },
    { name: "description", label: "সংক্ষিপ্ত পরিচিতি", type: "textarea", full: true, group: groupBasics, rows: 3, help: "হোমপেজের কার্ড ও ক্লাব তালিকায় দেখানো হবে।" },
    { name: "history", label: "ক্লাবের ইতিহাস", type: "textarea", full: true, group: groupBasics, rows: 6, help: "ক্লাব পাতার ‘পরিচিতি’ অংশে দেখানো হবে।" },
    { name: "mission", label: "লক্ষ্য ও উদ্দেশ্য", type: "textarea", full: true, group: groupBasics, rows: 4 },
    {
      name: "objectives",
      label: "মূল কার্যক্রম (এক লাইনে একটি)",
      type: "textarea",
      full: true,
      group: groupBasics,
      rows: 5,
      help: "প্রতিটি লাইন একটি করে বুলেট পয়েন্ট হিসেবে দেখানো হবে।",
    },
    { name: "name_en", label: "ক্লাবের নাম (ইংরেজি)", type: "text", full: true, group: groupBasics, placeholder: "Association Of Little Scientists And Math Maniacs", help: "ক্লাবের নিজস্ব সাইট ও সার্টিফিকেটে এই নাম ব্যবহৃত হয়।" },
    { name: "short_code", label: "সংক্ষিপ্ত কোড", type: "text", group: groupBasics, placeholder: "ALSSM", help: "সাবডোমেইন ও ক্লাব ফোল্ডারের নাম (যেমন alssm.okgs.info → clubs/alssm)।" },
    { name: "motto", label: "স্লোগান", type: "text", full: true, group: groupBasics, placeholder: "Explore · Experiment · Excel" },
    { name: "icon", label: "আইকন", type: "select", group: groupBasics, default: "Atom", options: iconOptions },
    { name: "accent", label: "নিজস্ব রং", type: "color", group: groupBasics, default: "#e7c27e", help: "কার্ড, হেডার ও ট্যাবে এই রং ব্যবহৃত হবে।" },
    { name: "logo_url", label: "ক্লাবের লোগো", type: "image", full: true, group: groupMedia, help: "PNG বা SVG লোগো আপলোড করুন — প্রিভিউ দেখাবে, অ্যাকসেন্ট রং স্বয়ংক্রিয়ভাবে লোগো থেকে নেওয়া হবে।" },
    { name: "image_url", label: "কার্ডের ছবি", type: "image", full: true, group: groupMedia, help: "হোমপেজ ও ক্লাব তালিকার ছবি।" },
    { name: "cover_image_url", label: "কভার / হিরো ছবি", type: "image", full: true, group: groupMedia, help: "ক্লাব পাতার উপরের বড় ছবি।" },
    { name: "gallery_urls", label: "সলিডার/গ্যালারি ছবির লিংক", type: "textarea", full: true, group: groupMedia, rows: 3, help: "প্রতি লাইনে একটি ছবির লিংক — ক্লাব পাতার স্লাইডারে ঘুরে ঘুরে দেখাবে।" },
    { name: "founded_year", label: "যাত্রা শুরু (সাল)", type: "number", group: groupBasics, default: 0 },
    { name: "member_count", label: "সদস্য সংখ্যা", type: "number", group: groupBasics, default: 0 },
    { name: "meeting_day", label: "সভার দিন", type: "text", group: groupBasics, placeholder: "প্রতি বৃহস্পতিবার" },
    { name: "meeting_time", label: "সভার সময়", type: "text", group: groupBasics, placeholder: "বিকাল ৪টা – ৫টা" },
    { name: "meeting_place", label: "সভার স্থান", type: "text", group: groupBasics, placeholder: "স্কুল ল্যাব / মিলনায়তন" },
    { name: "coordinator", label: "উপদেষ্টা শিক্ষক", type: "text", group: groupContact },
    { name: "coordinator_phone", label: "উপদেষ্টার মোবাইল", type: "text", group: groupContact },
    { name: "president", label: "সভাপতি (শিক্ষার্থী)", type: "text", group: groupContact },
    { name: "secretary", label: "সাধারণ সম্পাদক", type: "text", group: groupContact },
    { name: "vice_president", label: "সহ-সভাপতি", type: "text", group: groupContact },
    { name: "vice_secretary", label: "যুগ্ম সম্পাদক", type: "text", group: groupContact },
    { name: "email", label: "ক্লাবের ইমেইল", type: "text", group: groupContact },
    { name: "facebook_url", label: "ফেসবুক পেজ", type: "url", full: true, group: groupContact },
    { name: "facebook_group_url", label: "ফেসবুক গ্রুপ", type: "url", full: true, group: groupContact },
    { name: "domain", label: "নিজস্ব ওয়েবসাইট (লিংক)", type: "url", full: true, group: groupContact, help: "ক্লাবের আলাদা সাইট থাকলে লিংক দিন; খালি রাখলে লিংক দেখাবে না।" },
    { name: "subdomain", label: "সাবডোমেইন", type: "text", group: groupContact, placeholder: "alssm.okgs.info", help: "এই ঠিকানার জন্য clubs/<স্লাগ>/ ফোল্ডারে আলাদা সাইট তৈরি করা আছে।" },
    { name: "youtube_url", label: "ইউটিউব চ্যানেল", type: "url", full: true, group: groupContact },
    { name: "club_folder", label: "প্রজেক্ট ফোল্ডার", type: "text", group: groupContact, placeholder: "clubs/alssm", help: "এই ক্লাবের সাবসাইট কোন ফোল্ডারে আছে (deploy করার সময় কাজে লাগবে)।" },
    { name: "join_info", label: "কীভাবে যোগ দেবেন", type: "textarea", full: true, group: groupContact, rows: 3 },
    sortField,
    activeField,
  ],
  club_events: [
    clubField,
    { name: "title", label: "আয়োজনের নাম", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "বিবরণ", type: "textarea", full: true, group: groupBasics, rows: 4 },
    { name: "event_date", label: "তারিখ", type: "date", required: true, group: groupBasics },
    { name: "event_time", label: "সময়", type: "text", group: groupBasics, placeholder: "সকাল ১০টা" },
    { name: "venue", label: "স্থান", type: "text", group: groupBasics, placeholder: "স্কুল মিলনায়তন" },
    {
      name: "event_type",
      label: "ধরন",
      type: "select",
      group: groupBasics,
      default: "আয়োজন",
      options: [
        { label: "আয়োজন", value: "আয়োজন" },
        { label: "ওয়ার্কশপ", value: "ওয়ার্কশপ" },
        { label: "প্রতিযোগিতা", value: "প্রতিযোগিতা" },
        { label: "বিশেষ অতিথি", value: "বিশেষ অতিথি" },
        { label: "প্রদর্শনী", value: "প্রদর্শনী" },
        { label: "সভা", value: "সভা" },
      ],
    },
    { name: "registration_deadline", label: "নিবন্ধনের শেষ তারিখ", type: "date", group: groupBasics },
    { name: "registration_link", label: "নিবন্ধনের লিংক", type: "url", full: true, group: groupContact },
    { name: "image_url", label: "পোস্টার / ছবি", type: "image", full: true, group: groupMedia },
    featuredField,
    sortField,
    activeField,
  ],
  club_posts: [
    clubField,
    { name: "title", label: "শিরোনাম", type: "text", required: true, full: true, group: groupBasics },
    {
      name: "slug",
      label: "ইউআরএল স্লাগ",
      type: "text",
      group: groupBasics,
      help: "খালি রাখলে শিরোনাম থেকে তৈরি হবে।",
      pattern: "^[\\p{Letter}\\p{Number}][\\p{Letter}\\p{Number}-]{1,80}$",
      patternError: "স্লাগে স্পেস বা / \ ? # চিহ্ন দেওয়া যাবে না।",
    },
    { name: "excerpt", label: "সংক্ষিপ্ত লেখা", type: "textarea", full: true, group: groupBasics, rows: 2 },
    { name: "body", label: "বিস্তারিত লেখা", type: "textarea", full: true, group: groupBasics, rows: 10, help: "ফাঁকা লাইন দিয়ে অনুচ্ছেদ আলাদা করুন।" },
    { name: "image_url", label: "ছবি", type: "image", full: true, group: groupMedia },
    {
      name: "category",
      label: "বিভাগ",
      type: "select",
      group: groupBasics,
      default: "রিপোর্ট",
      options: [
        { label: "রিপোর্ট", value: "রিপোর্ট" },
        { label: "টিউটোরিয়াল", value: "টিউটোরিয়াল" },
        { label: "অভিজ্ঞতা", value: "অভিজ্ঞতা" },
        { label: "সম্পাদকীয়", value: "সম্পাদকীয়" },
        { label: "ফলাফল", value: "ফলাফল" },
      ],
    },
    { name: "author", label: "লিখেছে", type: "text", group: groupBasics },
    { name: "note", label: "ক্লাবের নোট", type: "text", full: true, group: groupBasics, help: "লেখার নিচে দেখানো হবে।" },
    publishDateField,
    featuredField,
    activeField,
  ],
  club_gallery: [
    clubField,
    { name: "caption", label: "ছবির বিবরণ", type: "text", full: true, group: groupBasics },
    { name: "image_url", label: "ছবি", type: "image", required: true, full: true, group: groupMedia },
    { name: "event_name", label: "কোন আয়োজন", type: "text", group: groupBasics, placeholder: "বার্ষিক বিজ্ঞান মেলা" },
    { name: "taken_on", label: "তোলা হয়েছে", type: "date", group: groupBasics },
    sortField,
    activeField,
  ],
  club_members: [
    clubField,
    { name: "name", label: "নাম", type: "text", required: true, group: groupBasics },
    {
      name: "role",
      label: "পদবি",
      type: "select",
      required: true,
      group: groupBasics,
      default: "সদস্য",
      help: "সভাপতি/সম্পাদকের ছবি ও তথ্য ক্লাব পাতার কমিটি কার্ডে বড় করে দেখানো হয়।",
      options: [
        { label: "প্রধান পৃষ্ঠপোষক", value: "প্রধান পৃষ্ঠপোষক" },
        { label: "উপদেষ্টা", value: "উপদেষ্টা" },
        { label: "সভাপতি", value: "সভাপতি" },
        { label: "সহ-সভাপতি", value: "সহ-সভাপতি" },
        { label: "সাধারণ সম্পাদক", value: "সাধারণ সম্পাদক" },
        { label: "যুগ্ম সম্পাদক", value: "যুগ্ম সম্পাদক" },
        { label: "সাংগঠনিক সম্পাদক", value: "সাংগঠনিক সম্পাদক" },
        { label: "দপ্তর সম্পাদক", value: "দপ্তর সম্পাদক" },
        { label: "প্রচার সম্পাদক", value: "প্রচার সম্পাদক" },
        { label: "তহবিল সম্পাদক", value: "তহবিল সম্পাদক" },
        { label: "নির্বাহী সদস্য", value: "নির্বাহী সদস্য" },
        { label: "সদস্য", value: "সদস্য" },
      ],
    },
    { name: "class_room", label: "শ্রেণি / দায়িত্ব", type: "text", group: groupBasics, placeholder: "দশম শ্রেণি" },
    { name: "section", label: "শাখা", type: "text", group: groupBasics, placeholder: "ক" },
    { name: "member_no", label: "সদস্য নম্বর", type: "text", group: groupBasics },
    { name: "session_year", label: "কমিটি/সেশন", type: "text", group: groupBasics, placeholder: "২০২৬" },
    { name: "photo_url", label: "ছবি", type: "image", full: true, group: groupMedia, help: "পাসপোর্ট সাইজ ছবি সবচেয়ে ভালো দেখায়।" },
    { name: "bio", label: "সংক্ষিপ্ত পরিচিতি", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "achievement", label: "অর্জন / বিশেষত্ব", type: "text", full: true, group: groupBasics },
    { name: "phone", label: "মোবাইল (ঐচ্ছিক)", type: "text", group: groupContact },
    { name: "email", label: "ইমেইল (ঐচ্ছিক)", type: "text", group: groupContact },
    { name: "facebook_url", label: "ফেসবুক প্রোফাইল", type: "url", full: true, group: groupContact },
    sortField,
    activeField,
  ],
  club_achievements: [
    clubField,
    { name: "title", label: "অর্জনের নাম", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "বিবরণ", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "awarded_to", label: "পেয়েছেন", type: "text", group: groupBasics, placeholder: "মোঃ সাকিব হাসান, অষ্টম শ্রেণি" },
    { name: "achieved_on", label: "তারিখ / সাল", type: "date", group: groupBasics },
    {
      name: "level",
      label: "পর্যায়",
      type: "select",
      group: groupBasics,
      default: "উপজেলা",
      options: [
        { label: "স্কুল", value: "স্কুল" },
        { label: "উপজেলা", value: "উপজেলা" },
        { label: "জেলা", value: "জেলা" },
        { label: "জাতীয়", value: "জাতীয়" },
        { label: "আন্তর্জাতিক", value: "আন্তর্জাতিক" },
      ],
    },
    { name: "position", label: "অবস্থান", type: "text", group: groupBasics, placeholder: "১ম স্থান / শীল্ড" },
    { name: "certificate_url", label: "ছবি / সনদ", type: "image", full: true, group: groupMedia },
    sortField,
    activeField,
  ],
  facilities: [
    { name: "title", label: "সুবিধার নাম", type: "text", required: true, group: groupBasics, placeholder: "বাস সার্ভিস" },
    { name: "description", label: "বিবরণ", type: "textarea", full: true, group: groupBasics, rows: 2 },
    { name: "icon", label: "আইকন", type: "select", group: groupBasics, default: "Sparkles", options: iconOptions },
    { name: "image_url", label: "ছবি (ঐচ্ছিক)", type: "image", full: true, group: groupMedia },
    sortField,
    activeField,
  ],
  teachers: [
    { name: "name", label: "নাম", type: "text", required: true, group: groupBasics },
    { name: "role", label: "পদবি", type: "text", required: true, group: groupBasics, placeholder: "সহকারী প্রধান শিক্ষক" },
    { name: "subject", label: "বিষয় / দায়িত্ব", type: "text", group: groupBasics },
    {
      name: "kind",
      label: "তালিকা",
      type: "select",
      group: groupBasics,
      default: "teacher",
      help: "শিক্ষক, শিক্ষিকা বা কর্মচারী — হোমপেজে একই গ্রিডে দেখানো হবে।",
      options: [
        { label: "শিক্ষক", value: "teacher" },
        { label: "শিক্ষিকা", value: "female-teacher" },
        { label: "কর্মচারী", value: "staff" },
        { label: "গভর্নিং বডি", value: "governor" },
      ],
    },
    { name: "photo_url", label: "ছবি", type: "image", full: true, group: groupMedia },
    { name: "bio", label: "সংক্ষিপ্ত পরিচিতি", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "qualification", label: "শিক্ষাগত যোগ্যতা", type: "text", full: true, group: groupBasics },
    { name: "phone", label: "যোগাযোগ নম্বর", type: "text", group: groupContact },
    { name: "email", label: "ইমেইল", type: "text", group: groupContact },
    sortField,
    activeField,
  ],
  gallery: [
    { name: "caption", label: "ছবির বিবরণ", type: "text", full: true, group: groupBasics },
    { name: "image_url", label: "ছবি", type: "image", required: true, full: true, group: groupMedia },
    { name: "event_name", label: "কোন আয়োজন", type: "text", group: groupBasics, placeholder: "বার্ষিক বিজ্ঞান মেলা" },
    { ...clubField, required: false, help: "চাইলে কোনো ক্লাবের সঙ্গে যুক্ত করুন — সেই ক্লাবের গ্যালারিতেও দেখাবে।" },
    { name: "taken_on", label: "তোলা হয়েছে", type: "date", group: groupBasics },
    sortField,
    activeField,
  ],
  stats: [
    { name: "label", label: "বিষয়", type: "text", required: true, group: groupBasics, placeholder: "মোট শিক্ষার্থী" },
    { name: "value", label: "মান", type: "text", required: true, group: groupBasics, placeholder: "১১০০+" },
    { name: "note", label: "টিপ্পনী", type: "text", full: true, group: groupBasics },
    { name: "icon", label: "আইকন", type: "select", group: groupBasics, default: "Sparkles", options: iconOptions },
    sortField,
    activeField,
  ],
  /* ---------------------------- বিজ্ঞান মেলা ---------------------------- */
  fairs: [
    { name: "name", label: "মেলার নাম", type: "text", required: true, full: true, group: groupBasics, placeholder: "OKGS Science Fair 2026" },
    { name: "name_en", label: "নাম (ইংরেজি)", type: "text", full: true, group: groupBasics },
    {
      name: "slug",
      label: "ইউআরএল স্লাগ",
      type: "text",
      required: true,
      group: groupBasics,
      pattern: "^[a-z0-9][a-z0-9-]{1,40}$",
      patternError: "স্লাগ ইংরেজি ছোট হাতের অক্ষরে লিখুন, যেমন science-fair-2026।",
      help: "/fair/এই-স্লাগ ঠিকানায় মেলার সাইট তৈরি হবে।",
    },
    { name: "edition", label: "সংস্করণ", type: "text", group: groupBasics, placeholder: "৩য়" },
    { name: "tagline", label: "স্লোগান / ট্যাগলাইন", type: "text", full: true, group: groupBasics },
    { name: "description", label: "সংক্ষিপ্ত পরিচিতি", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "about", label: "বিস্তারিত লেখা", type: "textarea", full: true, group: groupBasics, rows: 6 },
    { name: "starts_on", label: "শুরুর তারিখ", type: "date", group: groupBasics },
    { name: "ends_on", label: "শেষের তারিখ", type: "date", group: groupBasics },
    { name: "registration_deadline", label: "নিবন্ধনের শেষ তারিখ", type: "date", group: groupBasics },
    { name: "intro_time", label: "সময়সূচি (লেখা)", type: "text", group: groupBasics, placeholder: "সকাল ৯টা – বিকাল ৫টা" },
    { name: "venue", label: "স্থান", type: "text", group: groupBasics, placeholder: "স্কুল মাঠ ও বিজ্ঞানাগার" },
    { name: "city", label: "শহর / উপজেলা", type: "text", group: groupBasics, placeholder: "কালাই, জয়পুরহাট" },
    { name: "chief_guest", label: "প্রধান অতিথি", type: "text", full: true, group: groupBasics },
    { name: "fee", label: "নিবন্ধন ফি (টাকা)", type: "number", group: groupBasics, default: 0 },
    { name: "contact_email", label: "যোগাযোগের ইমেইল", type: "text", group: groupContact },
    { name: "contact_phone", label: "যোগাযোগের মোবাইল", type: "text", group: groupContact },
    { name: "accent", label: "মেলার মূল রং", type: "color", group: groupBasics, default: "#7c3aed" },
    { name: "accent_2", label: "দ্বিতীয় রং", type: "color", group: groupBasics, default: "#06b6d4" },
    { name: "logo_url", label: "মেলার লোগো", type: "image", full: true, group: groupMedia },
    { name: "cover_image_url", label: "কভার ছবি", type: "image", full: true, group: groupMedia },
    { name: "poster_url", label: "পোস্টার", type: "image", full: true, group: groupMedia },
    { name: "gallery_urls", label: "স্লাইডারের ছবি (প্রতি লাইনে একটি)", type: "textarea", full: true, group: groupMedia, rows: 4 },
    {
      name: "results_note",
      label: "ফলাফল / ঘোষণা",
      type: "textarea",
      full: true,
      group: groupBasics,
      rows: 3,
      help: "হোমপেজের বড় ব্যানারে ‘ফলাফল’ হিসেবে দেখানো হবে।",
    },
    featuredField,
    sortField,
    activeField,
  ],
  fair_categories: [
    fairField,
    { name: "name", label: "ক্যাটাগরির নাম", type: "text", required: true, full: true, group: groupBasics, placeholder: "রোবোটিক্স ও অটোমেশন" },
    { name: "code", label: "কোড", type: "text", group: groupBasics, placeholder: "ROBO" },
    {
      name: "kind",
      label: "ধরন",
      type: "select",
      group: groupBasics,
      default: "প্রজেক্ট",
      options: [
        { label: "প্রজেক্ট / মডেল", value: "প্রজেক্ট" },
        { label: "পরীক্ষা-নিরীক্ষা", value: "পরীক্ষা" },
        { label: "রোবোটিক্স", value: "রোবোটিক্স" },
        { label: "কুইজ", value: "কুইজ" },
        { label: "বিতর্ক", value: "বিতর্ক" },
        { label: "চিত্রকর্ম", value: "চিত্রকর্ম" },
        { label: "প্রোগ্রামিং", value: "প্রোগ্রামিং" },
        { label: "অন্যান্য", value: "অন্যান্য" },
      ],
    },
    { name: "description", label: "বিবরণ", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "rules", label: "নিয়মাবলি (এক লাইনে একটি)", type: "textarea", full: true, group: groupBasics, rows: 4 },
    { name: "classes", label: "কোন শ্রেণির জন্য", type: "text", full: true, group: groupBasics, placeholder: "ষষ্ঠ – দশম শ্রেণি" },
    { name: "team_size", label: "দল সদস্য", type: "number", group: groupBasics, default: 2 },
    { name: "fee", label: "ফি (টাকা)", type: "number", group: groupBasics, default: 0 },
    { name: "icon", label: "আইকন", type: "select", group: groupBasics, default: "Atom", options: iconOptions },
    { name: "color", label: "রং", type: "color", group: groupBasics, default: "#7c3aed" },
    { name: "image_url", label: "ছবি", type: "image", full: true, group: groupMedia },
    sortField,
    activeField,
  ],
  fair_schedule: [
    fairField,
    { name: "title", label: "পর্বের নাম", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "বিবরণ", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "starts_at", label: "শুরু", type: "datetime", group: groupBasics },
    { name: "ends_at", label: "শেষ", type: "datetime", group: groupBasics },
    { name: "venue", label: "স্থান", type: "text", group: groupBasics },
    { name: "host", label: "উপস্থাপক / দায়িত্বে", type: "text", group: groupBasics },
    {
      name: "kind",
      label: "ধরন",
      type: "select",
      group: groupBasics,
      default: "প্রতিযোগিতা",
      options: [
        { label: "উদ্বোধন", value: "উদ্বোধন" },
        { label: "প্রতিযোগিতা", value: "প্রতিযোগিতা" },
        { label: "সেমিনার", value: "সেমিনার" },
        { label: "প্রদর্শনী", value: "প্রদর্শনী" },
        { label: "সাংস্কৃতিক", value: "সাংস্কৃতিক" },
        { label: "পুরস্কার বিতরণ", value: "পুরস্কার" },
        { label: "বিরতি / খাবার", value: "বিরতি" },
        { label: "অন্যান্য", value: "অন্যান্য" },
      ],
    },
    sortField,
    activeField,
  ],
  fair_collections: [
    fairField,
    { name: "title", label: "প্রকল্প / সংগ্রহীর নাম", type: "text", required: true, full: true, group: groupBasics },
    { name: "category", label: "ক্যাটাগরি", type: "text", full: true, group: groupBasics, placeholder: "রোবোটিক্স ও অটোমেশন" },
    { name: "description", label: "বিবরণ", type: "textarea", full: true, group: groupBasics, rows: 4 },
    {
      name: "project_type",
      label: "ধরন",
      type: "select",
      group: groupBasics,
      default: "মডেল",
      options: [
        { label: "মডেল", value: "মডেল" },
        { label: "পরীক্ষা", value: "পরীক্ষা" },
        { label: "রোবোটিক্স", value: "রোবোটিক্স" },
        { label: "পোস্টার", value: "পোস্টার" },
        { label: "ডিজিটাল / সফটওয়্যার", value: "ডিজিটাল" },
        { label: "চিত্রকর্ম", value: "চিত্রকর্ম" },
      ],
    },
    {
      name: "status",
      label: "অবস্থা",
      type: "select",
      group: groupBasics,
      default: "প্রদর্শিত",
      options: [
        { label: "নিবন্ধিত", value: "নিবন্ধিত" },
        { label: "চূড়ান্ত", value: "চূড়ান্ত" },
        { label: "প্রদর্শিত", value: "প্রদর্শিত" },
        { label: "বিজয়ী", value: "বিজয়ী" },
      ],
    },
    { name: "position", label: "স্থান / পুরস্কার", type: "text", group: groupBasics, placeholder: "১ম স্থান" },
    { name: "score", label: "স্কোর", type: "number", group: groupBasics, default: 0 },
    { name: "student_name", label: "শিক্ষার্থীর নাম", type: "text", group: groupBasics },
    { name: "student_id", label: "আইডি নম্বর", type: "text", group: groupBasics },
    { name: "class_level", label: "শ্রেণি", type: "text", group: groupBasics },
    { name: "section", label: "শাখা", type: "text", group: groupBasics },
    { name: "team_members", label: "দল / অন্যান্য সদস্য", type: "textarea", full: true, group: groupBasics, rows: 2 },
    { name: "club_slug", label: "ক্লাব", type: "reference", reference: "clubs", group: groupBasics, options: clubOptions, help: "কোন ক্লাবের প্রকল্প হলে বেছে নিন।" },
    { name: "image_url", label: "প্রকল্পের ছবি", type: "image", full: true, group: groupMedia },
    { name: "gallery_urls", label: "অন্যান্য ছবি (প্রতি লাইনে একটি)", type: "textarea", full: true, group: groupMedia, rows: 3 },
    { name: "video_url", label: "ভিডিও লিংক", type: "url", full: true, group: groupMedia },
    { name: "certificate_url", label: "সনদ / সার্টিফিকেট", type: "image", full: true, group: groupMedia },
    { name: "note", label: "নোট", type: "text", full: true, group: groupBasics },
    featuredField,
    sortField,
    activeField,
  ],
  /* ------------------------------ থিম ------------------------------ */
  themes: [
    { name: "name", label: "থিমের নাম", type: "text", required: true, group: groupBasics, placeholder: "Midnight Lab" },
    {
      name: "key",
      label: "থিম কী",
      type: "text",
      required: true,
      group: groupBasics,
      pattern: "^[a-z0-9][a-z0-9-]{1,40}$",
      patternError: "কী-তে ছোট হাতের অক্ষর, সংখ্যা বা হাইফেন দিন।",
    },
    { name: "description", label: "বিবরণ", type: "text", full: true, group: groupBasics },
    {
      name: "mode",
      label: "মোড",
      type: "select",
      group: groupBasics,
      default: "light",
      options: [
        { label: "লাইট", value: "light" },
        { label: "ডার্ক", value: "dark" },
      ],
    },
    { name: "accent", label: "অ্যাকসেন্ট রং", type: "color", group: groupBasics, default: "#7c3aed" },
    { name: "accent_2", label: "দ্বিতীয় রং", type: "color", group: groupBasics, default: "#06b6d4" },
    { name: "surface", label: "পৃষ্ঠের রং", type: "color", group: groupBasics, default: "#ffffff" },
    { name: "ink", label: "লেখার রং", type: "color", group: groupBasics, default: "#0f172a" },
    {
      name: "hero_style",
      label: "হিরো স্টাইল",
      type: "select",
      group: groupBasics,
      default: "glass",
      options: [
        { label: "গ্লাস কার্ড", value: "glass" },
        { label: "ফুল-ব্লিড", value: "full" },
        { label: "গ্রেডিয়েন্ট", value: "gradient" },
        { label: "মিনিমাল", value: "minimal" },
      ],
    },
    {
      name: "font_pair",
      label: "ফন্ট জোড়া",
      type: "select",
      group: groupBasics,
      default: "hind-noto",
      options: [
        { label: "হিন্দ সিলিগুড়ি + নোটো সেরিফ", value: "hind-noto" },
        { label: "শুধু হিন্দ সিলিগুড়ি", value: "hind" },
        { label: "নোটো সেরিফ বাংলা", value: "noto" },
        { label: "বালু দা + এইচএস", value: "baloo" },
      ],
    },
    { name: "radius", label: "কার্ডের কোণ (px)", type: "number", group: groupBasics, default: 18 },
    {
      name: "custom_css",
      label: "কাস্টম CSS (টেমপ্লেট)",
      type: "textarea",
      full: true,
      group: groupMedia,
      rows: 12,
      help: "এখানে লেখা CSS পুরো সাইটে যুক্ত হবে — .okgs-scope এর ভেতরে লিখলে নিরাপদ থাকে।",
    },
    { name: "custom_head", label: "হেডে যোগ করার কোড (ঐচ্ছিক)", type: "textarea", full: true, group: groupMedia, rows: 4 },
    { name: "preview_image_url", label: "প্রিভিউ ছবি", type: "image", full: true, group: groupMedia },
    { name: "is_default", label: "সক্রিয় থিম", type: "boolean", group: groupBasics, help: "একটি থিমে টিক দিলে সেটিই পুরো সাইটে চালু হয়।", default: false },
    activeField,
  ],
  settings: [
    {
      name: "key",
      label: "সেটিং কী",
      type: "text",
      required: true,
      group: groupBasics,
      placeholder: "site_name",
      pattern: "^[a-z0-9_]{2,40}$",
      patternError: "কী-তে ছোট হাতের অক্ষর, সংখ্যা বা আন্ডারস্কোর (_) ব্যবহার করুন।",
    },
    { name: "label", label: "দৃশ্যমান নাম", type: "text", required: true, group: groupBasics },
    {
      name: "field_kind",
      label: "মানের ধরন",
      type: "select",
      group: groupBasics,
      default: "text",
      help: "‘ছবি’ বেছে নিলে মান ঘরে সরাসরি Cloudinary-তে আপলোড করা যাবে।",
      options: [
        { label: "সংক্ষিপ্ত লেখা", value: "text" },
        { label: "দীর্ঘ লেখা", value: "textarea" },
        { label: "ছবি (আপলোড)", value: "image" },
        { label: "লিংক", value: "url" },
      ],
    },
    { name: "value", label: "মান", type: "textarea", full: true, group: groupBasics, rows: 4 },
    { name: "description", label: "ব্যবহার", type: "text", full: true, group: groupBasics },
    { name: "image_url", label: "ছবি (যেমন লোগো)", type: "image", full: true, group: groupMedia },
  ],
};

export const resourceMeta: Record<
  ResourceName,
  {
    label: string;
    singular: string;
    icon: string;
    group: "site" | "clubs" | "school" | "fair";
    description: string;
    titleField: string;
    parent?: "clubs" | "fairs";
    reorderable?: boolean;
  }
> = {
  slides: { label: "হিরো স্লাইড", singular: "স্লাইড", icon: "Images", group: "site", description: "হোমপেজের উপরের স্লাইডার।", titleField: "title", reorderable: true },
  notices: { label: "নোটিশ", singular: "নোটিশ", icon: "BellRing", group: "site", description: "স্কুল ও ক্লাবের নোটিশ।", titleField: "title" },
  banners: { label: "ব্যানার", singular: "ব্যানার", icon: "Megaphone", group: "site", description: "হোমপেজের প্রচার ব্যানার।", titleField: "title", reorderable: true },
  news: { label: "সংবাদ", singular: "সংবাদ", icon: "Newspaper", group: "site", description: "স্কুলের সংবাদ ও প্রতিবেদন।", titleField: "title" },
  updates: { label: "সর্বশেষ আপডেট", singular: "আপডেট", icon: "Activity", group: "site", description: "হোমপেজের ছোট আপডেট লিস্ট।", titleField: "title" },
  clubs: { label: "ক্লাব তালিকা", singular: "ক্লাব", icon: "Trophy", group: "clubs", description: "ক্লাব তৈরি করুন, সাজান ও পূর্ণ তথ্য দিন।", titleField: "name", reorderable: true },
  club_events: { label: "ক্লাব আয়োজন", singular: "আয়োজন", icon: "CalendarDays", group: "clubs", description: "প্রতিটি ক্লাবের অনুষ্ঠান ও প্রতিযোগিতা।", titleField: "title", parent: "clubs", reorderable: true },
  club_posts: { label: "ক্লাব লেখা", singular: "লেখা", icon: "FileText", group: "clubs", description: "ক্লাবের ম্যাগাজিন, রিপোর্ট ও টিউটোরিয়াল।", titleField: "title", parent: "clubs" },
  club_gallery: { label: "ক্লাব গ্যালারি", singular: "ছবি", icon: "Image", group: "clubs", description: "ক্লাবের ছবি — সরাসরি Cloudinary-তে আপলোড করুন।", titleField: "caption", parent: "clubs", reorderable: true },
  club_members: { label: "ক্লাব সদস্য", singular: "সদস্য", icon: "Users", group: "clubs", description: "ক্লাব কমিটি ও সদস্য তালিকা।", titleField: "name", parent: "clubs", reorderable: true },
  club_achievements: { label: "ক্লাব অর্জন", singular: "অর্জন", icon: "Award", group: "clubs", description: "পুরস্কার, শীল্ড ও সাফল্যের তালিকা।", titleField: "title", parent: "clubs", reorderable: true },
  facilities: { label: "ক্যাম্পাস সুবিধা", singular: "সুবিধা", icon: "ShieldCheck", group: "school", description: "হোমপেজের ‘শেখার জন্য সুন্দর পরিবেশ’ কার্ডগুলো।", titleField: "title", reorderable: true },
  teachers: { label: "শিক্ষক-কর্মচারী", singular: "শিক্ষক", icon: "Users", group: "school", description: "শিক্ষকমণ্ডলী ও স্টাফের তালিকা।", titleField: "name", reorderable: true },
  gallery: { label: "স্কুল গ্যালারি", singular: "ছবি", icon: "Image", group: "school", description: "হোমপেজের ক্যাম্পাস ছবি।", titleField: "caption", reorderable: true },
  stats: { label: "পরিসংখ্যান", singular: "সংখ্যা", icon: "Activity", group: "school", description: "হোমপেজের সংখ্যা-ব্যান্ড (শিক্ষার্থী, পাশের হার)।", titleField: "label", reorderable: true },
  settings: { label: "স্কুল তথ্য", singular: "সেটিং", icon: "Settings2", group: "school", description: "নাম, ফোন, ঠিকানা সহ সাইটের মূল তথ্য।", titleField: "label" },
  fairs: { label: "বিজ্ঞান মেলা", singular: "মেলা", icon: "FlaskConical", group: "fair", description: "OKGS Science Fair — তারিখ, লোগো, পোস্টার ও ঘোষণা।", titleField: "name", reorderable: true },
  fair_categories: { label: "মেলার ক্যাটাগরি", singular: "ক্যাটাগরি", icon: "ListTree", group: "fair", description: "প্রজেক্ট, কুইজ, রোবোটিক্স — ক্যাটাগরি অনুযায়ী স্লাইডার ও নিবন্ধন।", titleField: "name", parent: "fairs", reorderable: true },
  fair_schedule: { label: "মেলার রুটিন", singular: "পর্ব", icon: "CalendarClock", group: "fair", description: "দিন-ভিত্তিক অনুষ্ঠানসূচি — মেলার সাইটে দেখা যায়।", titleField: "title", parent: "fairs", reorderable: true },
  fair_collections: { label: "মেলার সংগ্রহ", singular: "সংগ্রহ", icon: "Boxes", group: "fair", description: "মেলার প্রকল্প ও সংগ্রহের স্থায়ী আর্কাইভ (ছবি + দল + ফলাফল)।", titleField: "title", parent: "fairs", reorderable: true },
  themes: { label: "টেমপ্লেট থিম", singular: "থিম", icon: "Palette", group: "site", description: "সাইটের রং, ফন্ট ও কাস্টম CSS — এক ক্লিকে বদলান।", titleField: "name" },
};

export const resourceOrder = Object.keys(resourceSchema) as ResourceName[];

export const studioGroups: { id: "site" | "clubs" | "school" | "fair"; label: string; resources: ResourceName[] }[] = [
  { id: "fair", label: "বিজ্ঞান মেলা ২০২৬", resources: ["fairs", "fair_categories", "fair_schedule", "fair_collections"] },
  { id: "clubs", label: "ক্লাব তথ্যকেন্দ্র", resources: ["clubs", "club_events", "club_posts", "club_gallery", "club_members", "club_achievements"] },
  { id: "site", label: "হোমপেজ ও প্রকাশনা", resources: ["slides", "notices", "banners", "news", "updates", "themes"] },
  { id: "school", label: "প্রতিষ্ঠান", resources: ["settings", "teachers", "facilities", "gallery", "stats"] },
];

/** Roles that make up a club's working committee — shown first, with photos. */
export const committeeRoles = [
  "প্রধান পৃষ্ঠপোষক",
  "উপদেষ্টা",
  "সভাপতি",
  "সহ-সভাপতি",
  "সাধারণ সম্পাদক",
  "যুগ্ম সম্পাদক",
  "সাংগঠনিক সম্পাদক",
  "দপ্তর সম্পাদক",
  "প্রচার সম্পাদক",
  "তহবিল সম্পাদক",
  "নির্বাহী সদস্য",
];

export const leadershipRoles = ["সভাপতি", "সহ-সভাপতি", "সাধারণ সম্পাদক", "যুগ্ম সম্পাদক"];

/** Legacy/simple accessors kept so existing code keeps working. */
export const resourceFields: Record<ResourceName, string[]> = Object.fromEntries(
  resourceOrder.map((resource) => [resource, resourceSchema[resource].map((field) => field.name)]),
) as Record<ResourceName, string[]>;

export const resourceLabels: Record<ResourceName, string> = Object.fromEntries(
  resourceOrder.map((resource) => [resource, resourceMeta[resource].label]),
) as Record<ResourceName, string>;

export const resourceSingular: Record<ResourceName, string> = Object.fromEntries(
  resourceOrder.map((resource) => [resource, resourceMeta[resource].singular]),
) as Record<ResourceName, string>;

export const resourceRequired: Record<ResourceName, string[]> = Object.fromEntries(
  resourceOrder.map((resource) => [resource, resourceSchema[resource].filter((field) => field.required).map((field) => field.name)]),
) as Record<ResourceName, string[]>;

export function fieldsFor(resource: ResourceName) {
  return resourceSchema[resource] ?? [];
}

export function fieldDef(resource: ResourceName, name: string): FieldDef | undefined {
  return fieldsFor(resource).find((field) => field.name === name);
}

export const booleanFieldNames = new Set(
  resourceOrder.flatMap((resource) => fieldsFor(resource).filter((field) => field.type === "boolean").map((field) => field.name)),
);

export const numberFieldNames = new Set(
  resourceOrder.flatMap((resource) => fieldsFor(resource).filter((field) => field.type === "number").map((field) => field.name)),
);

export const imageFieldNames = new Set(
  resourceOrder.flatMap((resource) => fieldsFor(resource).filter((field) => field.type === "image").map((field) => field.name)),
);

export const dateFieldNames = new Set(
  resourceOrder.flatMap((resource) =>
    fieldsFor(resource).filter((field) => field.type === "date" || field.type === "datetime").map((field) => field.name),
  ),
);

export function isBooleanField(field: string) {
  return booleanFieldNames.has(field);
}

/** SQLite stores 0/1 and NULL — turn a raw row value into something UI-friendly. */
export function normalizeRowFlags(key: string, value: unknown) {
  if (booleanFieldNames.has(key)) return Number(value) === 1;
  if (numberFieldNames.has(key)) return Number(value ?? 0);
  return value === null || value === undefined ? "" : value;
}

export function coerceFieldValue(field: FieldDef, value: unknown): string | number {
  if (field.type === "boolean") return value === true || value === 1 || value === "1" || value === "true" || value === "on" ? 1 : 0;
  if (field.type === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (field.type === "date") return text.slice(0, 10);
  if (field.type === "datetime") return text.slice(0, 16);
  if (field.type === "url") return text ? ensureProtocol(text) : "";
  return text;
}

export function defaultValueFor(field: FieldDef): string | number {
  if (field.default !== undefined) return field.default as string | number;
  if (field.type === "boolean") return field.name === "is_active" ? 1 : 0;
  if (field.type === "number") return 0;
  if (field.type === "date") return new Date().toISOString().slice(0, 10);
  if (field.type === "datetime") return new Date().toISOString().slice(0, 16);
  return "";
}

/** SQL fragment for the column, derived from the field type and its default. */
export function columnSql(field: FieldDef): string {
  const seed = field.default !== undefined ? field.default : field.type === "boolean" ? field.name === "is_active" : "";
  const fallback = String(coerceFieldValue(field, seed));
  if (field.type === "boolean" || field.type === "number") {
    // A newly added is_active column must not hide existing live rows.
    return `INTEGER NOT NULL DEFAULT ${fallback === "1" ? 1 : 0}`;
  }
  return `TEXT NOT NULL DEFAULT '${fallback.replace(/'/g, "''")}'`;
}

export function ensureProtocol(value: string) {
  const text = value.trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text.replace(/^\/+/, "")}`;
}

/** Club "domain" is now optional — an empty value means "no separate website". */
export function normalizeClubDomain(domain: string) {
  return ensureProtocol(domain);
}

export function slugify(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    // \p{M} keeps combining signs (Bengali মাত্রা/হলান্ত) attached to their letter,
    // otherwise “বার্ষিক” would slugify to “ব-র-ষ-ক”.
    .replace(/\u200c|\u200d/g, "")
    .replace(/[^\p{Letter}\p{Number}\p{M}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/* --- Bengali → Latin transliteration, used to suggest ASCII slugs --- */

const bnConsonants: Record<string, string> = {
  ক: "k", খ: "kh", গ: "g", ঘ: "gh", ঙ: "ng",
  চ: "ch", ছ: "chh", জ: "j", ঝ: "jh", ঞ: "n",
  ট: "t", ঠ: "th", ড: "d", ঢ: "dh", ণ: "n",
  ত: "t", দ: "d", ধ: "dh", ন: "n",
  প: "p", ফ: "ph", ব: "b", ভ: "bh", ম: "m",
  য: "j", র: "r", ল: "l", শ: "sh", ষ: "sh", স: "s", হ: "h",
  ড়: "r", ঢ়: "rh", য়: "y", ফ়: "f", জ়: "z",
};

const bnVowels: Record<string, string> = {
  অ: "o", আ: "a", ই: "i", ঈ: "i", উ: "u", ঊ: "u", ঋ: "ri", এ: "e", ঐ: "oi", ও: "o", ঔ: "ou",
  অা: "a",
};

const bnMatras: Record<string, string> = {
  "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ৃ": "ri",
  "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou",
};

/**
 * Approximate but deterministic — enough to turn “ম্যাথ এন্ড সাইন্স ক্লাব” into a
 * usable URL slug (`math-end-sains-club`) instead of forcing the admin to invent one.
 */
export function transliterateBn(value: string) {
  const chars = Array.from(String(value));
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const next = chars[i + 1] ?? "";
    if (char === "ৎ") { out.push("t"); continue; }
    if (char === "ং") { out.push("ng"); continue; }
    if (char === "ঃ") { continue; }
    if (char === "্") { continue; }
    if (char === "়") { continue; }
    const consonant = bnConsonants[char];
    if (consonant) {
      if (next === "্") { out.push(consonant); i += 1; continue; }
      const matra = bnMatras[next];
      if (matra) { out.push(consonant + matra); i += 1; continue; }
      // A bare consonant carries Bengali's inherent vowel.
      out.push(`${consonant}a`);
      continue;
    }
    const vowel = bnVowels[char];
    if (vowel) { out.push(vowel); continue; }
    const matra = bnMatras[char];
    if (matra) { out.push(matra); continue; }
    if (/[০-৯]/.test(char)) { out.push(String("০১২৩৪৫৬৭৮৯".indexOf(char))); continue; }
    if (/[0-9a-zA-Z]/.test(char)) { out.push(char.toLowerCase()); continue; }
    out.push(" ");
  }
  return out.join("").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

/** Slug that is guaranteed to satisfy the club-slug pattern. */
export function asciiSlug(value: string, fallback = "club") {
  const slug = transliterateBn(value).replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug.length >= 3 ? slug : `${fallback}-${Date.now().toString(36).slice(-5)}`;
}

/** Lines of a textarea become a list on the public site (club objectives). */
export function toLines(value: unknown) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

export function paragraphs(value: unknown) {
  return String(value ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}
