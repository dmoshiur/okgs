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
  is_featured: boolean;
  is_active: boolean;
}

export interface UpdateItem extends BaseRow {
  title: string;
  description: string;
  date: string;
  kind: string;
  is_active: boolean;
}

export interface Club extends BaseRow {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  history: string;
  mission: string;
  objectives: string;
  accent: string;
  icon: string;
  image_url: string;
  cover_image_url: string;
  founded_year: number;
  member_count: number;
  meeting_day: string;
  meeting_time: string;
  meeting_place: string;
  coordinator: string;
  coordinator_phone: string;
  president: string;
  email: string;
  facebook_url: string;
  domain: string;
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
  photo_url: string;
  bio: string;
  achievement: string;
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
  | SiteSetting;

/** Loose record used by the schema-driven admin studio. */
export type StudioItem = Record<string, string | number | boolean | null> & { id: string };
