import type { ResourceName } from "@/lib/types";

export const resourceFields: Record<ResourceName, string[]> = {
  slides: [
    "eyebrow",
    "title",
    "description",
    "cta_label",
    "cta_href",
    "image_url",
    "accent",
    "sort_order",
    "is_active",
  ],
  notices: ["title", "body", "type", "published_at", "is_active"],
  banners: [
    "label",
    "title",
    "description",
    "cta_label",
    "cta_href",
    "image_url",
    "accent",
    "sort_order",
    "is_active",
  ],
  news: [
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
  ],
  updates: ["title", "description", "date", "kind", "is_active"],
  clubs: [
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
  ],
  settings: ["key", "label", "value", "description"],
};

export const resourceLabels: Record<ResourceName, string> = {
  slides: "Hero slides",
  notices: "Notices",
  banners: "Banners",
  news: "News",
  updates: "Latest updates",
  clubs: "Clubs",
  settings: "School profile",
};

export const resourceSingular: Record<ResourceName, string> = {
  slides: "slide",
  notices: "notice",
  banners: "banner",
  news: "story",
  updates: "update",
  clubs: "club",
  settings: "setting",
};

export const resourceRequired: Record<ResourceName, string[]> = {
  slides: ["title"],
  notices: ["title"],
  banners: ["title"],
  news: ["title"],
  updates: ["title"],
  clubs: ["name", "slug"],
  settings: ["key", "label"],
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normalizeClubDomain(domain: string, slug: string) {
  const value = domain.trim() || `${slug}.okgs.info`;
  return /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/\//, "")}`;
}
