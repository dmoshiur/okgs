export type ResourceName =
  | "slides"
  | "notices"
  | "banners"
  | "news"
  | "updates"
  | "clubs"
  | "settings";

export interface Slide {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  cta_label: string;
  cta_href: string;
  image_url: string;
  accent: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  type: string;
  published_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Banner {
  id: string;
  label: string;
  title: string;
  description: string;
  cta_label: string;
  cta_href: string;
  image_url: string;
  accent: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  image_url: string;
  category: string;
  author: string;
  published_at: string;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateItem {
  id: string;
  title: string;
  description: string;
  date: string;
  kind: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  accent: string;
  icon: string;
  image_url: string;
  domain: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteSetting {
  id: string;
  key: string;
  label: string;
  value: string;
  description: string;
  updated_at: string;
}

export interface PublicContent {
  slides: Slide[];
  notices: Notice[];
  banners: Banner[];
  news: NewsItem[];
  updates: UpdateItem[];
  clubs: Club[];
  settings: SiteSetting[];
}

export type AdminRecord =
  | Slide
  | Notice
  | Banner
  | NewsItem
  | UpdateItem
  | Club
  | SiteSetting;
