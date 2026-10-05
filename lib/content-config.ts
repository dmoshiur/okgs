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
  { label: "Atom — Science", value: "Atom" },
  { label: "BookOpen — Literature", value: "BookOpen" },
  { label: "Monitor — Computer", value: "Monitor" },
  { label: "Trophy — Sports", value: "Trophy" },
  { label: "MessagesSquare — Debate", value: "MessagesSquare" },
  { label: "Palette — Fine arts", value: "Palette" },
  { label: "Sprout — Nursery", value: "Sprout" },
  { label: "Leaf — Environment", value: "Leaf" },
  { label: "Music — Music", value: "Music" },
  { label: "HeartHandshake — Social service", value: "HeartHandshake" },
  { label: "ShieldCheck — Safety", value: "ShieldCheck" },
  { label: "Sparkles — General", value: "Sparkles" },
];

export const clubIconOptions = iconOptions;

/**
 * The five real OKGS clubs. The slug doubles as the folder name of the club's own
 * website (`clubs/<slug>/`) and as its subdomain prefix, so keep them short.
 */
const clubOptions: FieldOption[] = [
  { label: "ALSSM — Math and Science Club", value: "alssm" },
  { label: "AYPG — Language Club", value: "aypg" },
  { label: "ALPCG — Computer Club", value: "alpcg" },
  { label: "AYGSM — Sporting Club", value: "aygsm" },
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

/* Field-group headings shown in the English admin studio. */
const groupBasics = "Basic details";
const groupMedia = "Images & media";
const groupContact = "Contact & links";

const sortField: FieldDef = {
  name: "sort_order",
  label: "Order",
  type: "number",
  group: groupBasics,
  help: "Smaller numbers are shown first.",
  default: 0,
};

const activeField: FieldDef = {
  name: "is_active",
  label: "Published",
  type: "boolean",
  group: groupBasics,
  help: "Turn it off and it disappears from the site.",
  default: true,
};

export const isActiveField = activeField;

const featuredField: FieldDef = {
  name: "is_featured",
  label: "Featured / highlight",
  type: "boolean",
  group: groupBasics,
  help: "Pinned to the top of the club page.",
  default: false,
};

const clubField: FieldDef = {
  name: "club_slug",
  label: "Club",
  type: "reference",
  reference: "clubs",
  required: true,
  group: groupBasics,
  help: "Which club this belongs to — it is shown on that club's own page.",
  options: clubOptions,
};

const fairOptions: FieldOption[] = [
  { label: "OKGS Science Fair 2026", value: "science-fair-2026" },
];

export const defaultFairOptions = fairOptions;

/** Rows that belong to a science fair (categories, schedule, collections). */
const fairField: FieldDef = {
  name: "fair_slug",
  label: "Science Fair",
  type: "reference",
  reference: "fairs",
  group: groupBasics,
  help: "Which fair this belongs to — empty means the current fair.",
  options: fairOptions,
};

const publishDateField: FieldDef = {
  name: "published_at",
  label: "Publish date",
  type: "datetime",
  group: groupBasics,
};

export const resourceSchema: Record<ResourceName, FieldDef[]> = {
  slides: [
    { name: "eyebrow", label: "Top label", type: "text", group: groupBasics, placeholder: "Omar Kindergarten School" },
    { name: "title", label: "Title", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "Description", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "cta_label", label: "Button label", type: "text", group: groupBasics, default: "ভর্তি তথ্য" },
    { name: "cta_href", label: "Button link", type: "text", group: groupBasics, placeholder: "#admission or /clubs", default: "#admission" },
    { name: "image_url", label: "Slide image", type: "image", full: true, group: groupMedia },
    { name: "accent", label: "Accent colour", type: "color", group: groupBasics, default: "#e7c27e" },
    { ...clubField, required: false, help: "Which club the photo belongs to — tags the slide and enables club filtering." },
    sortField,
    activeField,
  ],
  notices: [
    { ...clubField, required: false, help: "Optionally tie it to a club (empty means a general school notice)." },
    { name: "title", label: "Notice title", type: "text", required: true, full: true, group: groupBasics },
    { name: "body", label: "Details", type: "textarea", full: true, group: groupBasics, rows: 5 },
    {
      name: "type",
      label: "Notice type",
      type: "select",
      group: groupBasics,
      default: "সাধারণ",
      options: [
        { label: "General", value: "সাধারণ" },
        { label: "Admission", value: "ভর্তি" },
        { label: "Residential", value: "আবাসিক" },
        { label: "Experiment", value: "পরীক্ষা" },
        { label: "Programme", value: "কার্যক্রম" },
        { label: "Urgent", value: "জরুরি" },
      ],
    },
    publishDateField,
    activeField,
  ],
  banners: [
    { name: "label", label: "Small label", type: "text", group: groupBasics },
    { name: "title", label: "Title", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "Description", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "cta_label", label: "Button label", type: "text", group: groupBasics, default: "বিস্তারিত" },
    { name: "cta_href", label: "Button link", type: "text", group: groupBasics, default: "#admission" },
    { name: "image_url", label: "Banner image", type: "image", full: true, group: groupMedia },
    { name: "accent", label: "Accent colour", type: "color", group: groupBasics, default: "#102d2a" },
    sortField,
    activeField,
  ],
  news: [
    { name: "title", label: "Title", type: "text", required: true, full: true, group: groupBasics },
    {
      name: "slug",
      label: "URL slug",
      type: "text",
      group: groupBasics,
      help: "Leave empty to generate it from the title.",
      pattern: "^[\\p{Letter}\\p{Number}][\\p{Letter}\\p{Number}-]{1,80}$",
      patternError: "A slug cannot contain spaces or the characters / \ ? #",
    },
    { ...clubField, required: false, help: "Pick a club and the story also appears on that club's page." },
    { name: "excerpt", label: "Short text", type: "textarea", full: true, group: groupBasics, rows: 2 },
    { name: "body", label: "Detailed text", type: "textarea", full: true, group: groupBasics, rows: 8 },
    { name: "image_url", label: "Image", type: "image", full: true, group: groupMedia },
    {
      name: "category",
      label: "Department",
      type: "select",
      group: groupBasics,
      default: "ক্যাম্পাস",
      options: [
        { label: "Campus", value: "ক্যাম্পাস" },
        { label: "Education", value: "শিক্ষা" },
        { label: "Science Fair", value: "বিজ্ঞান মেলা" },
        { label: "Cultural", value: "সাংস্কৃতিক" },
        { label: "Sports", value: "খেলাধুলা" },
        { label: "Service", value: "সেবা" },
      ],
    },
    { name: "author", label: "Written by", type: "text", group: groupBasics, default: "ওকেজিএস বার্তা" },
    publishDateField,
    featuredField,
    activeField,
  ],
  updates: [
    { name: "title", label: "Title", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "Description", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "date", label: "Date", type: "date", group: groupBasics },
    {
      name: "kind",
      label: "Type",
      type: "select",
      group: groupBasics,
      default: "কার্যক্রম",
      options: [
        { label: "Admission", value: "ভর্তি" },
        { label: "Club", value: "ক্লাব" },
        { label: "Campus", value: "ক্যাম্পাস" },
        { label: "Science", value: "বিজ্ঞান" },
        { label: "Result", value: "ফলাফল" },
      ],
    },
    activeField,
  ],
  clubs: [
    { name: "name", label: "Club name", type: "text", required: true, full: true, group: groupBasics, placeholder: "Math and Science Club" },
    {
      name: "slug",
      label: "URL slug",
      type: "text",
      required: true,
      group: groupBasics,
      help: "The page will live at /clubs/this-slug — lowercase English letters, numbers or hyphens.",
      pattern: "^[a-z0-9][a-z0-9-]{1,40}$",
      patternError: "Write the slug in lowercase English letters, numbers or hyphens (-), e.g. science or math-club.",
    },
    { name: "tagline", label: "Tagline", type: "text", full: true, group: groupBasics },
    { name: "description", label: "Short introduction", type: "textarea", full: true, group: groupBasics, rows: 3, help: "Shown on the homepage cards and in the club directory." },
    { name: "history", label: "Club history", type: "textarea", full: true, group: groupBasics, rows: 6, help: "Shown in the “About” block of the club page." },
    { name: "mission", label: "Mission and goals", type: "textarea", full: true, group: groupBasics, rows: 4 },
    {
      name: "objectives",
      label: "Core activities (one per line)",
      type: "textarea",
      full: true,
      group: groupBasics,
      rows: 5,
      help: "Each line becomes a bullet point.",
    },
    { name: "name_en", label: "Club name (English)", type: "text", full: true, group: groupBasics, placeholder: "Association Of Little Scientists And Math Maniacs", help: "Used on the club's own site and on certificates." },
    { name: "short_code", label: "Short code", type: "text", group: groupBasics, placeholder: "ALSSM", help: "Subdomain and club folder name (e.g. alssm.okgs.info → clubs/alssm)." },
    { name: "motto", label: "Slogan", type: "text", full: true, group: groupBasics, placeholder: "Explore · Experiment · Excel" },
    { name: "icon", label: "Icon", type: "select", group: groupBasics, default: "Atom", options: iconOptions },
    { name: "accent", label: "Own colour", type: "color", group: groupBasics, default: "#e7c27e", help: "This colour is used on cards, headers and tabs." },
    { name: "logo_url", label: "Club logo", type: "image", full: true, group: groupMedia, help: "Upload a PNG or SVG logo — the preview appears and the accent colour is extracted from the logo automatically." },
    { name: "image_url", label: "Card image", type: "image", full: true, group: groupMedia, help: "Images on the homepage and the club directory." },
    { name: "cover_image_url", label: "Cover / hero image", type: "image", full: true, group: groupMedia, help: "The large cover image at the top of the club page." },
    { name: "gallery_urls", label: "Slider/gallery image URL", type: "textarea", full: true, group: groupMedia, rows: 3, help: "One image URL per line — rotates in the club page slider." },
    { name: "founded_year", label: "Started (year)", type: "number", group: groupBasics, default: 0 },
    { name: "member_count", label: "Member count", type: "number", group: groupBasics, default: 0 },
    { name: "meeting_day", label: "Meeting day", type: "text", group: groupBasics, placeholder: "Every Thursday" },
    { name: "meeting_time", label: "Meeting time", type: "text", group: groupBasics, placeholder: "4:00 pm – 5:00 pm" },
    { name: "meeting_place", label: "Meeting venue", type: "text", group: groupBasics, placeholder: "School lab / auditorium" },
    { name: "coordinator", label: "Adviser teacher", type: "text", group: groupContact },
    { name: "coordinator_phone", label: "Adviser phone", type: "text", group: groupContact },
    { name: "president", label: "President (student)", type: "text", group: groupContact },
    { name: "secretary", label: "General secretary", type: "text", group: groupContact },
    { name: "vice_president", label: "Vice-president", type: "text", group: groupContact },
    { name: "vice_secretary", label: "Joint secretary", type: "text", group: groupContact },
    { name: "email", label: "Club email", type: "text", group: groupContact },
    { name: "facebook_url", label: "Facebook page", type: "url", full: true, group: groupContact },
    { name: "facebook_group_url", label: "Facebook group", type: "url", full: true, group: groupContact },
    { name: "domain", label: "Own website (link)", type: "url", full: true, group: groupContact, help: "Link the club's own site if it has one; empty hides the link." },
    { name: "subdomain", label: "Subdomain", type: "text", group: groupContact, placeholder: "alssm.okgs.info", help: "A separate site already lives in the clubs/<slug>/ folder for this address." },
    { name: "youtube_url", label: "YouTube channel", type: "url", full: true, group: groupContact },
    { name: "club_folder", label: "Project folder", type: "text", group: groupContact, placeholder: "clubs/alssm", help: "Folder that holds this club's sub-site (useful when deploying)." },
    { name: "join_info", label: "How to join", type: "textarea", full: true, group: groupContact, rows: 3 },
    sortField,
    activeField,
  ],
  club_events: [
    clubField,
    { name: "title", label: "Event title", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "Description", type: "textarea", full: true, group: groupBasics, rows: 4 },
    { name: "event_date", label: "Date", type: "date", required: true, group: groupBasics },
    { name: "event_time", label: "Time", type: "text", group: groupBasics, placeholder: "10:00 am" },
    { name: "venue", label: "Venue", type: "text", group: groupBasics, placeholder: "School auditorium" },
    {
      name: "event_type",
      label: "Type",
      type: "select",
      group: groupBasics,
      default: "আয়োজন",
      options: [
        { label: "Event", value: "আয়োজন" },
        { label: "Workshop", value: "ওয়ার্কশপ" },
        { label: "Competition", value: "প্রতিযোগিতা" },
        { label: "Guest of honour", value: "বিশেষ অতিথি" },
        { label: "Exhibition", value: "প্রদর্শনী" },
        { label: "Meeting", value: "সভা" },
      ],
    },
    { name: "registration_deadline", label: "Registration deadline", type: "date", group: groupBasics },
    { name: "registration_link", label: "Registration link", type: "url", full: true, group: groupContact },
    { name: "image_url", label: "Poster / photo", type: "image", full: true, group: groupMedia },
    featuredField,
    sortField,
    activeField,
  ],
  club_posts: [
    clubField,
    { name: "title", label: "Title", type: "text", required: true, full: true, group: groupBasics },
    {
      name: "slug",
      label: "URL slug",
      type: "text",
      group: groupBasics,
      help: "Leave empty to generate it from the title.",
      pattern: "^[\\p{Letter}\\p{Number}][\\p{Letter}\\p{Number}-]{1,80}$",
      patternError: "A slug cannot contain spaces or the characters / \ ? #",
    },
    { name: "excerpt", label: "Short text", type: "textarea", full: true, group: groupBasics, rows: 2 },
    { name: "body", label: "Detailed text", type: "textarea", full: true, group: groupBasics, rows: 10, help: "Separate paragraphs with a blank line." },
    { name: "image_url", label: "Image", type: "image", full: true, group: groupMedia },
    {
      name: "category",
      label: "Department",
      type: "select",
      group: groupBasics,
      default: "রিপোর্ট",
      options: [
        { label: "Report", value: "রিপোর্ট" },
        { label: "Tutorial", value: "টিউটোরিয়াল" },
        { label: "Experience", value: "অভিজ্ঞতা" },
        { label: "Editorial", value: "সম্পাদকীয়" },
        { label: "Result", value: "ফলাফল" },
      ],
    },
    { name: "author", label: "Written by", type: "text", group: groupBasics },
    { name: "note", label: "Club note", type: "text", full: true, group: groupBasics, help: "Shown under the article." },
    publishDateField,
    featuredField,
    activeField,
  ],
  club_gallery: [
    clubField,
    { name: "caption", label: "Image caption", type: "text", full: true, group: groupBasics },
    { name: "image_url", label: "Image", type: "image", required: true, full: true, group: groupMedia },
    { name: "event_name", label: "Which event", type: "text", group: groupBasics, placeholder: "Annual Science Fair" },
    { name: "taken_on", label: "Taken on", type: "date", group: groupBasics },
    sortField,
    activeField,
  ],
  club_members: [
    clubField,
    { name: "name", label: "Name", type: "text", required: true, group: groupBasics },
    {
      name: "role",
      label: "Designation",
      type: "select",
      required: true,
      group: groupBasics,
      default: "সদস্য",
      help: "The president/secretary photo and details are featured on the club committee card.",
      options: [
        { label: "Chief patron", value: "প্রধান পৃষ্ঠপোষক" },
        { label: "Adviser", value: "উপদেষ্টা" },
        { label: "President", value: "সভাপতি" },
        { label: "Vice-president", value: "সহ-সভাপতি" },
        { label: "General secretary", value: "সাধারণ সম্পাদক" },
        { label: "Joint secretary", value: "যুগ্ম সম্পাদক" },
        { label: "Organising secretary", value: "সাংগঠনিক সম্পাদক" },
        { label: "Office secretary", value: "দপ্তর সম্পাদক" },
        { label: "Publicity secretary", value: "প্রচার সম্পাদক" },
        { label: "Treasurer", value: "তহবিল সম্পাদক" },
        { label: "Executive member", value: "নির্বাহী সদস্য" },
        { label: "Member", value: "সদস্য" },
      ],
    },
    { name: "class_room", label: "Class / responsibility", type: "text", group: groupBasics, placeholder: "Class Ten" },
    { name: "section", label: "Section", type: "text", group: groupBasics, placeholder: "A" },
    { name: "member_no", label: "Member number", type: "text", group: groupBasics },
    { name: "session_year", label: "Committee / session", type: "text", group: groupBasics, placeholder: "2026" },
    { name: "photo_url", label: "Image", type: "image", full: true, group: groupMedia, help: "A passport-size photo looks best." },
    { name: "bio", label: "Short introduction", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "achievement", label: "Achievement / speciality", type: "text", full: true, group: groupBasics },
    { name: "phone", label: "Mobile (optional)", type: "text", group: groupContact },
    { name: "email", label: "Email (optional)", type: "text", group: groupContact },
    { name: "facebook_url", label: "Facebook profile", type: "url", full: true, group: groupContact },
    sortField,
    activeField,
  ],
  club_achievements: [
    clubField,
    { name: "title", label: "Achievement title", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "Description", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "awarded_to", label: "Received", type: "text", group: groupBasics, placeholder: "Md. Sakib Hasan, Class Eight" },
    { name: "achieved_on", label: "Date / year", type: "date", group: groupBasics },
    {
      name: "level",
      label: "Stage",
      type: "select",
      group: groupBasics,
      default: "উপজেলা",
      options: [
        { label: "School", value: "স্কুল" },
        { label: "Upazila", value: "উপজেলা" },
        { label: "District", value: "জেলা" },
        { label: "National", value: "জাতীয়" },
        { label: "International", value: "আন্তর্জাতিক" },
      ],
    },
    { name: "position", label: "Location", type: "text", group: groupBasics, placeholder: "1st place / shield" },
    { name: "certificate_url", label: "Photo / certificate", type: "image", full: true, group: groupMedia },
    sortField,
    activeField,
  ],
  facilities: [
    { name: "title", label: "Facility name", type: "text", required: true, group: groupBasics, placeholder: "Bus service" },
    { name: "description", label: "Description", type: "textarea", full: true, group: groupBasics, rows: 2 },
    { name: "icon", label: "Icon", type: "select", group: groupBasics, default: "Sparkles", options: iconOptions },
    { name: "image_url", label: "Photo (optional)", type: "image", full: true, group: groupMedia },
    sortField,
    activeField,
  ],
  teachers: [
    { name: "name", label: "Name", type: "text", required: true, group: groupBasics },
    { name: "role", label: "Designation", type: "text", required: true, group: groupBasics, placeholder: "Assistant Head Teacher" },
    { name: "subject", label: "Subject / responsibility", type: "text", group: groupBasics },
    {
      name: "kind",
      label: "List",
      type: "select",
      group: groupBasics,
      default: "teacher",
      help: "Teachers and staff — all shown in one grid on the homepage.",
      options: [
        { label: "Teachers", value: "teacher" },
        { label: "Teacher (female)", value: "female-teacher" },
        { label: "Staff", value: "staff" },
        { label: "Governing body", value: "governor" },
      ],
    },
    { name: "photo_url", label: "Image", type: "image", full: true, group: groupMedia },
    { name: "bio", label: "Short introduction", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "qualification", label: "Educational qualification", type: "text", full: true, group: groupBasics },
    { name: "phone", label: "Contact number", type: "text", group: groupContact },
    { name: "email", label: "Email", type: "text", group: groupContact },
    sortField,
    activeField,
  ],
  gallery: [
    { name: "caption", label: "Image caption", type: "text", full: true, group: groupBasics },
    { name: "image_url", label: "Image", type: "image", required: true, full: true, group: groupMedia },
    { name: "event_name", label: "Which event", type: "text", group: groupBasics, placeholder: "Annual Science Fair" },
    { ...clubField, required: false, help: "Optionally tie it to a club — it then also appears in that club's gallery." },
    { name: "taken_on", label: "Taken on", type: "date", group: groupBasics },
    sortField,
    activeField,
  ],
  stats: [
    { name: "label", label: "Subject", type: "text", required: true, group: groupBasics, placeholder: "Total students" },
    { name: "value", label: "Value", type: "text", required: true, group: groupBasics, placeholder: "1100+" },
    { name: "note", label: "Comment", type: "text", full: true, group: groupBasics },
    { name: "icon", label: "Icon", type: "select", group: groupBasics, default: "Sparkles", options: iconOptions },
    sortField,
    activeField,
  ],
  /* ---------------------------- বিজ্ঞান মেলা ---------------------------- */
  fairs: [
    { name: "name", label: "Fair name", type: "text", required: true, full: true, group: groupBasics, placeholder: "OKGS Science Fair 2026" },
    { name: "name_en", label: "Name (English)", type: "text", full: true, group: groupBasics },
    {
      name: "slug",
      label: "URL slug",
      type: "text",
      required: true,
      group: groupBasics,
      pattern: "^[a-z0-9][a-z0-9-]{1,40}$",
      patternError: "Write the slug in lowercase English, e.g. science-fair-2026.",
      help: "The fair site will live at /fair/this-slug.",
    },
    { name: "edition", label: "Edition", type: "text", group: groupBasics, placeholder: "3rd" },
    { name: "tagline", label: "Slogan / tagline", type: "text", full: true, group: groupBasics },
    { name: "description", label: "Short introduction", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "about", label: "Detailed text", type: "textarea", full: true, group: groupBasics, rows: 6 },
    { name: "starts_on", label: "Start date", type: "date", group: groupBasics },
    { name: "ends_on", label: "End date", type: "date", group: groupBasics },
    { name: "registration_deadline", label: "Registration deadline", type: "date", group: groupBasics },
    { name: "intro_time", label: "Schedule (text)", type: "text", group: groupBasics, placeholder: "9:00 am – 5:00 pm" },
    { name: "venue", label: "Venue", type: "text", group: groupBasics, placeholder: "School field and science lab" },
    { name: "city", label: "City / upazila", type: "text", group: groupBasics, placeholder: "Kalai, Joypurhat" },
    { name: "chief_guest", label: "Chief guest", type: "text", full: true, group: groupBasics },
    { name: "fee", label: "Registration fee (BDT)", type: "number", group: groupBasics, default: 0 },
    { name: "contact_email", label: "Contact email", type: "text", group: groupContact },
    { name: "contact_phone", label: "Contact mobile", type: "text", group: groupContact },
    { name: "accent", label: "Fair primary colour", type: "color", group: groupBasics, default: "#7c3aed" },
    { name: "accent_2", label: "Secondary colour", type: "color", group: groupBasics, default: "#06b6d4" },
    { name: "logo_url", label: "Fair logo", type: "image", full: true, group: groupMedia },
    { name: "cover_image_url", label: "Cover image", type: "image", full: true, group: groupMedia },
    { name: "poster_url", label: "Poster", type: "image", full: true, group: groupMedia },
    { name: "gallery_urls", label: "Slider images (one URL per line)", type: "textarea", full: true, group: groupMedia, rows: 4 },
    {
      name: "results_note",
      label: "Result / announcement",
      type: "textarea",
      full: true,
      group: groupBasics,
      rows: 3,
      help: "Shown as a “result” on the homepage banner.",
    },
    featuredField,
    sortField,
    activeField,
  ],
  fair_categories: [
    fairField,
    { name: "name", label: "Category name", type: "text", required: true, full: true, group: groupBasics, placeholder: "Robotics and automation" },
    { name: "code", label: "Code", type: "text", group: groupBasics, placeholder: "ROBO" },
    {
      name: "kind",
      label: "Type",
      type: "select",
      group: groupBasics,
      default: "প্রজেক্ট",
      options: [
        { label: "Project / model", value: "প্রজেক্ট" },
        { label: "Experiments", value: "পরীক্ষা" },
        { label: "Robotics", value: "রোবোটিক্স" },
        { label: "Quiz", value: "কুইজ" },
        { label: "Debate", value: "বিতর্ক" },
        { label: "Artwork", value: "চিত্রকর্ম" },
        { label: "Programming", value: "প্রোগ্রামিং" },
        { label: "Other", value: "অন্যান্য" },
      ],
    },
    { name: "description", label: "Description", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "rules", label: "Rules (one per line)", type: "textarea", full: true, group: groupBasics, rows: 4 },
    { name: "classes", label: "For which class", type: "text", full: true, group: groupBasics, placeholder: "Class Six – Ten" },
    { name: "team_size", label: "Team members", type: "number", group: groupBasics, default: 2 },
    { name: "fee", label: "Fee (BDT)", type: "number", group: groupBasics, default: 0 },
    { name: "icon", label: "Icon", type: "select", group: groupBasics, default: "Atom", options: iconOptions },
    { name: "color", label: "Colour", type: "color", group: groupBasics, default: "#7c3aed" },
    { name: "image_url", label: "Image", type: "image", full: true, group: groupMedia },
    sortField,
    activeField,
  ],
  fair_schedule: [
    fairField,
    { name: "title", label: "Session title", type: "text", required: true, full: true, group: groupBasics },
    { name: "description", label: "Description", type: "textarea", full: true, group: groupBasics, rows: 3 },
    { name: "starts_at", label: "Starts", type: "datetime", group: groupBasics },
    { name: "ends_at", label: "Ends", type: "datetime", group: groupBasics },
    { name: "venue", label: "Venue", type: "text", group: groupBasics },
    { name: "host", label: "Presenter / in charge", type: "text", group: groupBasics },
    {
      name: "kind",
      label: "Type",
      type: "select",
      group: groupBasics,
      default: "প্রতিযোগিতা",
      options: [
        { label: "Opening", value: "উদ্বোধন" },
        { label: "Competition", value: "প্রতিযোগিতা" },
        { label: "Seminar", value: "সেমিনার" },
        { label: "Exhibition", value: "প্রদর্শনী" },
        { label: "Cultural", value: "সাংস্কৃতিক" },
        { label: "Prize giving", value: "পুরস্কার" },
        { label: "Break / refreshments", value: "বিরতি" },
        { label: "Other", value: "অন্যান্য" },
      ],
    },
    sortField,
    activeField,
  ],
  fair_collections: [
    fairField,
    { name: "title", label: "Project / collection title", type: "text", required: true, full: true, group: groupBasics },
    { name: "category", label: "Category", type: "text", full: true, group: groupBasics, placeholder: "Robotics and automation" },
    { name: "description", label: "Description", type: "textarea", full: true, group: groupBasics, rows: 4 },
    {
      name: "project_type",
      label: "Type",
      type: "select",
      group: groupBasics,
      default: "মডেল",
      options: [
        { label: "Model", value: "মডেল" },
        { label: "Experiment", value: "পরীক্ষা" },
        { label: "Robotics", value: "রোবোটিক্স" },
        { label: "Poster", value: "পোস্টার" },
        { label: "Digital / software", value: "ডিজিটাল" },
        { label: "Artwork", value: "চিত্রকর্ম" },
      ],
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      group: groupBasics,
      default: "প্রদর্শিত",
      options: [
        { label: "Registered", value: "নিবন্ধিত" },
        { label: "Final", value: "চূড়ান্ত" },
        { label: "Displayed", value: "প্রদর্শিত" },
        { label: "Winner", value: "বিজয়ী" },
      ],
    },
    { name: "position", label: "Position / prize", type: "text", group: groupBasics, placeholder: "1st place" },
    { name: "score", label: "Score", type: "number", group: groupBasics, default: 0 },
    { name: "student_name", label: "Student name", type: "text", group: groupBasics },
    { name: "student_id", label: "School ID", type: "text", group: groupBasics },
    { name: "class_level", label: "Class", type: "text", group: groupBasics },
    { name: "section", label: "Section", type: "text", group: groupBasics },
    { name: "team_members", label: "Team / other members", type: "textarea", full: true, group: groupBasics, rows: 2 },
    { name: "club_slug", label: "Club", type: "reference", reference: "clubs", group: groupBasics, options: clubOptions, help: "Choose a club if the project belongs to one." },
    { name: "image_url", label: "Project image", type: "image", full: true, group: groupMedia },
    { name: "gallery_urls", label: "Other images (one URL per line)", type: "textarea", full: true, group: groupMedia, rows: 3 },
    { name: "video_url", label: "Video link", type: "url", full: true, group: groupMedia },
    { name: "certificate_url", label: "Certificate", type: "image", full: true, group: groupMedia },
    { name: "note", label: "Note", type: "text", full: true, group: groupBasics },
    featuredField,
    sortField,
    activeField,
  ],
  /* ------------------------------ থিম ------------------------------ */
  themes: [
    { name: "name", label: "Theme name", type: "text", required: true, group: groupBasics, placeholder: "Midnight Lab" },
    {
      name: "key",
      label: "Theme key",
      type: "text",
      required: true,
      group: groupBasics,
      pattern: "^[a-z0-9][a-z0-9-]{1,40}$",
      patternError: "Use lowercase letters, numbers or hyphens in the key.",
    },
    { name: "description", label: "Description", type: "text", full: true, group: groupBasics },
    {
      name: "mode",
      label: "Mode",
      type: "select",
      group: groupBasics,
      default: "light",
      options: [
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
      ],
    },
    { name: "accent", label: "Accent colour", type: "color", group: groupBasics, default: "#7c3aed" },
    { name: "accent_2", label: "Secondary colour", type: "color", group: groupBasics, default: "#06b6d4" },
    { name: "surface", label: "Surface colour", type: "color", group: groupBasics, default: "#ffffff" },
    { name: "ink", label: "Text colour", type: "color", group: groupBasics, default: "#0f172a" },
    {
      name: "hero_style",
      label: "Hero style",
      type: "select",
      group: groupBasics,
      default: "glass",
      options: [
        { label: "Glass card", value: "glass" },
        { label: "Full-bleed", value: "full" },
        { label: "Gradient", value: "gradient" },
        { label: "Minimal", value: "minimal" },
      ],
    },
    {
      name: "font_pair",
      label: "Font pair",
      type: "select",
      group: groupBasics,
      default: "hind-noto",
      options: [
        { label: "Hind Siliguri + Noto Serif", value: "hind-noto" },
        { label: "Hind Siliguri only", value: "hind" },
        { label: "Noto Serif Bengali", value: "noto" },
        { label: "Baloo Da + HS", value: "baloo" },
      ],
    },
    { name: "radius", label: "Card corner radius (px)", type: "number", group: groupBasics, default: 18 },
    {
      name: "custom_css",
      label: "Custom CSS (template)",
      type: "textarea",
      full: true,
      group: groupMedia,
      rows: 12,
      help: "This CSS is appended to the whole site — wrap selectors in .okgs-scope to stay safe.",
    },
    { name: "custom_head", label: "Code added to <head> (optional)", type: "textarea", full: true, group: groupMedia, rows: 4 },
    { name: "preview_image_url", label: "Preview image", type: "image", full: true, group: groupMedia },
    { name: "is_default", label: "Active theme", type: "boolean", group: groupBasics, help: "Tick one theme and it becomes the active theme for the whole site.", default: false },
    activeField,
  ],
  settings: [
    {
      name: "key",
      label: "Setting key",
      type: "text",
      required: true,
      group: groupBasics,
      placeholder: "site_name",
      pattern: "^[a-z0-9_]{2,40}$",
      patternError: "Use lowercase letters, numbers or underscores (_) in the key.",
    },
    { name: "label", label: "Visible label", type: "text", required: true, group: groupBasics },
    {
      name: "field_kind",
      label: "Value type",
      type: "select",
      group: groupBasics,
      default: "text",
      help: "Pick “Image” and the value cell uploads straight to Cloudinary.",
      options: [
        { label: "Short text", value: "text" },
        { label: "Long text", value: "textarea" },
        { label: "Image (upload)", value: "image" },
        { label: "Link", value: "url" },
      ],
    },
    { name: "value", label: "Value", type: "textarea", full: true, group: groupBasics, rows: 4 },
    { name: "description", label: "Usage", type: "text", full: true, group: groupBasics },
    { name: "image_url", label: "Image (e.g. logo)", type: "image", full: true, group: groupMedia },
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
  slides: { label: "Hero slides", singular: "Slide", icon: "Images", group: "site", description: "The slider at the top of the homepage.", titleField: "title", reorderable: true },
  notices: { label: "Notices", singular: "Notices", icon: "BellRing", group: "site", description: "School and club notices.", titleField: "title" },
  banners: { label: "Banners", singular: "Banners", icon: "Megaphone", group: "site", description: "Promotional banners on the homepage.", titleField: "title", reorderable: true },
  news: { label: "News", singular: "News", icon: "Newspaper", group: "site", description: "School news and reports.", titleField: "title" },
  updates: { label: "Latest updates", singular: "Update", icon: "Activity", group: "site", description: "The short update list on the homepage.", titleField: "title" },
  clubs: { label: "Clubs", singular: "Club", icon: "Trophy", group: "clubs", description: "Create clubs, sort them and fill in the full profile.", titleField: "name", reorderable: true },
  club_events: { label: "Club events", singular: "Event", icon: "CalendarDays", group: "clubs", description: "Every club's events and competitions.", titleField: "title", parent: "clubs", reorderable: true },
  club_posts: { label: "Club posts", singular: "Article", icon: "FileText", group: "clubs", description: "Club magazines, reports and tutorials.", titleField: "title", parent: "clubs" },
  club_gallery: { label: "Club gallery", singular: "Image", icon: "Image", group: "clubs", description: "Club photos — upload straight to Cloudinary.", titleField: "caption", parent: "clubs", reorderable: true },
  club_members: { label: "Club members", singular: "Member", icon: "Users", group: "clubs", description: "Club committee and member list.", titleField: "name", parent: "clubs", reorderable: true },
  club_achievements: { label: "Club achievements", singular: "Achievement", icon: "Award", group: "clubs", description: "Prizes, shields and results.", titleField: "title", parent: "clubs", reorderable: true },
  facilities: { label: "Campus facilities", singular: "Facility", icon: "ShieldCheck", group: "school", description: "The homepage “a beautiful place to learn” cards.", titleField: "title", reorderable: true },
  teachers: { label: "Teachers & Staff", singular: "Teachers", icon: "Users", group: "school", description: "The teaching faculty and staff list.", titleField: "name", reorderable: true },
  gallery: { label: "School gallery", singular: "Image", icon: "Image", group: "school", description: "Campus photos for the homepage.", titleField: "caption", reorderable: true },
  stats: { label: "Statistics", singular: "Number", icon: "Activity", group: "school", description: "The homepage statistics band (students, pass rate).", titleField: "label", reorderable: true },
  settings: { label: "School information", singular: "Setting", icon: "Settings2", group: "school", description: "Core site details: name, phone, address.", titleField: "label" },
  fairs: { label: "Science Fair", singular: "Fair", icon: "FlaskConical", group: "fair", description: "OKGS Science Fair — dates, logo, posters and announcements.", titleField: "name", reorderable: true },
  fair_categories: { label: "Fair categories", singular: "Category", icon: "ListTree", group: "fair", description: "Projects, quizzes, robotics — sliders and registration per category.", titleField: "name", parent: "fairs", reorderable: true },
  fair_schedule: { label: "Fair schedule", singular: "Session", icon: "CalendarClock", group: "fair", description: "Day-by-day programme — shown on the fair site.", titleField: "title", parent: "fairs", reorderable: true },
  fair_collections: { label: "Fair collections", singular: "Collection", icon: "Boxes", group: "fair", description: "Permanent archive of fair projects and collections (photo + team + result).", titleField: "title", parent: "fairs", reorderable: true },
  themes: { label: "Template themes", singular: "Theme", icon: "Palette", group: "site", description: "The site's colours, fonts and custom CSS — switch them in one click.", titleField: "name" },
};

export const resourceOrder = Object.keys(resourceSchema) as ResourceName[];

export const studioGroups: { id: "site" | "clubs" | "school" | "fair"; label: string; resources: ResourceName[] }[] = [
  { id: "fair", label: "Science Fair 2026", resources: ["fairs", "fair_categories", "fair_schedule", "fair_collections"] },
  { id: "clubs", label: "Club information centre", resources: ["clubs", "club_events", "club_posts", "club_gallery", "club_members", "club_achievements"] },
  { id: "site", label: "Homepage & publishing", resources: ["slides", "notices", "banners", "news", "updates", "themes"] },
  { id: "school", label: "Institution", resources: ["settings", "teachers", "facilities", "gallery", "stats"] },
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
