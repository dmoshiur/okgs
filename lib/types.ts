export type ResourceName =
  | "slides"
  | "notices"
  | "banners"
  | "news"
  | "updates"
  | "clubs"
  | "club_events"
  | "club_posts"
  | "club_gallery"
  | "club_members"
  | "club_achievements"
  | "teachers"
  | "facilities"
  | "gallery"
  | "stats"
  | "fairs"
  | "fair_categories"
  | "fair_schedule"
  | "fair_collections"
  | "themes"
  | "settings";

export interface FieldOption {
  label: string;
  value: string;
}

interface BaseRow {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Slide extends BaseRow {
  club_slug: string;
  eyebrow: string;
  title: string;
  description: string;
  cta_label: string;
  cta_href: string;
  image_url: string;
  accent: string;
  sort_order: number;
  is_active: boolean;
}

export interface Notice extends BaseRow {
  club_slug: string;
  title: string;
  body: string;
  type: string;
  published_at: string;
  audience?: string;
  email_notify?: boolean;
  is_active: boolean;
}

export interface Banner extends BaseRow {
  label: string;
  title: string;
  description: string;
  cta_label: string;
  cta_href: string;
  image_url: string;
  accent: string;
  sort_order: number;
  is_active: boolean;
}

export interface NewsItem extends BaseRow {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  image_url: string;
  category: string;
  author: string;
  club_slug: string;
  published_at: string;
  audience?: string;
  email_notify?: boolean;
  is_featured: boolean;
  is_active: boolean;
}

export interface UpdateItem extends BaseRow {
  title: string;
  description: string;
  date: string;
  kind: string;
  audience?: string;
  email_notify?: boolean;
  is_active: boolean;
}

export interface Club extends BaseRow {
  name: string;
  name_en: string;
  short_code: string;
  slug: string;
  motto: string;
  tagline: string;
  description: string;
  history: string;
  mission: string;
  objectives: string;
  accent: string;
  icon: string;
  logo_url: string;
  image_url: string;
  cover_image_url: string;
  gallery_urls: string;
  founded_year: number;
  member_count: number;
  meeting_day: string;
  meeting_time: string;
  meeting_place: string;
  coordinator: string;
  coordinator_phone: string;
  president: string;
  secretary: string;
  vice_president: string;
  vice_secretary: string;
  email: string;
  facebook_url: string;
  facebook_group_url: string;
  domain: string;
  subdomain: string;
  youtube_url: string;
  club_folder: string;
  join_info: string;
  sort_order: number;
  is_active: boolean;
}

export interface ClubEvent extends BaseRow {
  club_slug: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  venue: string;
  event_type: string;
  registration_deadline: string;
  registration_link: string;
  image_url: string;
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface ClubPost extends BaseRow {
  club_slug: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  image_url: string;
  category: string;
  author: string;
  note: string;
  published_at: string;
  is_featured: boolean;
  is_active: boolean;
}

export interface ClubGalleryItem extends BaseRow {
  club_slug: string;
  caption: string;
  image_url: string;
  event_name: string;
  taken_on: string;
  sort_order: number;
  is_active: boolean;
}

export interface ClubMember extends BaseRow {
  club_slug: string;
  name: string;
  role: string;
  class_room: string;
  section: string;
  member_no: string;
  session_year: string;
  photo_url: string;
  bio: string;
  achievement: string;
  phone: string;
  email: string;
  facebook_url: string;
  sort_order: number;
  is_active: boolean;
}

export interface ClubAchievement extends BaseRow {
  club_slug: string;
  title: string;
  description: string;
  awarded_to: string;
  achieved_on: string;
  level: string;
  position: string;
  certificate_url: string;
  sort_order: number;
  is_active: boolean;
}

export interface Fair extends BaseRow {
  name: string;
  name_en: string;
  slug: string;
  edition: string;
  tagline: string;
  description: string;
  about: string;
  starts_on: string;
  ends_on: string;
  registration_deadline: string;
  intro_time: string;
  venue: string;
  city: string;
  chief_guest: string;
  fee: number;
  contact_email: string;
  contact_phone: string;
  accent: string;
  accent_2: string;
  logo_url: string;
  cover_image_url: string;
  poster_url: string;
  gallery_urls: string;
  results_note: string;
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface FairCategory extends BaseRow {
  fair_slug: string;
  name: string;
  code: string;
  kind: string;
  description: string;
  rules: string;
  classes: string;
  team_size: number;
  fee: number;
  icon: string;
  color: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

export interface FairScheduleItem extends BaseRow {
  fair_slug: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  host: string;
  kind: string;
  sort_order: number;
  is_active: boolean;
}

export interface FairCollection extends BaseRow {
  fair_slug: string;
  title: string;
  category: string;
  description: string;
  project_type: string;
  status: string;
  position: string;
  score: number;
  student_name: string;
  student_id: string;
  class_level: string;
  section: string;
  team_members: string;
  club_slug: string;
  image_url: string;
  gallery_urls: string;
  video_url: string;
  certificate_url: string;
  note: string;
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface SiteTheme extends BaseRow {
  name: string;
  key: string;
  description: string;
  mode: string;
  accent: string;
  accent_2: string;
  surface: string;
  ink: string;
  hero_style: string;
  font_pair: string;
  radius: number;
  custom_css: string;
  custom_head: string;
  preview_image_url: string;
  is_default: boolean;
  is_active: boolean;
}

export interface Teacher extends BaseRow {
  name: string;
  role: string;
  subject: string;
  kind: string;
  photo_url: string;
  bio: string;
  qualification: string;
  phone: string;
  email: string;
  sort_order: number;
  is_active: boolean;
}

export interface SiteGalleryItem extends BaseRow {
  caption: string;
  image_url: string;
  event_name: string;
  club_slug: string;
  taken_on: string;
  sort_order: number;
  is_active: boolean;
}

export interface StatItem extends BaseRow {
  label: string;
  value: string;
  note: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface Facility extends BaseRow {
  title: string;
  description: string;
  icon: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

export interface SiteSetting extends BaseRow {
  key: string;
  label: string;
  field_kind: string;
  value: string;
  description: string;
  image_url: string;
}

/** Anything that belongs to exactly one club. */
export interface ClubScoped {
  club_slug: string;
}

export interface FairContent {
  fair: Fair;
  categories: FairCategory[];
  schedule: FairScheduleItem[];
  collections: FairCollection[];
}

export interface ClubContent {
  club: Club;
  events: ClubEvent[];
  upcomingEvents: ClubEvent[];
  pastEvents: ClubEvent[];
  posts: ClubPost[];
  gallery: ClubGalleryItem[];
  members: ClubMember[];
  achievements: ClubAchievement[];
  notices: Notice[];
  news: NewsItem[];
}

export interface PublicContent {
  slides: Slide[];
  notices: Notice[];
  banners: Banner[];
  news: NewsItem[];
  updates: UpdateItem[];
  clubs: Club[];
  club_events: ClubEvent[];
  club_posts: ClubPost[];
  club_gallery: ClubGalleryItem[];
  club_members: ClubMember[];
  club_achievements: ClubAchievement[];
  teachers: Teacher[];
  facilities: Facility[];
  gallery: SiteGalleryItem[];
  stats: StatItem[];
  fairs: Fair[];
  fair_categories: FairCategory[];
  fair_schedule: FairScheduleItem[];
  fair_collections: FairCollection[];
  themes: SiteTheme[];
  settings: SiteSetting[];
}

export type AdminRecord =
  | Slide
  | Notice
  | Banner
  | NewsItem
  | UpdateItem
  | Club
  | ClubEvent
  | ClubPost
  | ClubGalleryItem
  | ClubMember
  | ClubAchievement
  | Teacher
  | Facility
  | SiteGalleryItem
  | StatItem
  | Fair
  | FairCategory
  | FairScheduleItem
  | FairCollection
  | SiteTheme
  | SiteSetting;

/** Loose record used by the schema-driven admin studio. */
export type StudioItem = Record<string, string | number | boolean | null> & { id: string };
