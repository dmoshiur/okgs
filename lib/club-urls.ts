/**
 * Where a club's own site actually lives.
 *
 * Every club is hosted on its own subdomain — `alssm.okgs.info`, `aypg.okgs.info`
 * … — never on a path of the school site. This module is intentionally free of
 * Node imports so the same rules run on the server (metadata, cards, the studio
 * header) and in the browser (the club studio's "open live site" button).
 *
 * Resolution order:
 *   1. an explicit `website` / `domain` saved for the club (custom domain),
 *   2. the club's `subdomain` field (`alssm.okgs.info`),
 *   3. the slug plus the configured base domain (`alssm.okgs.info`).
 */

/** Base domain used when a club has no explicit subdomain yet. */
export const CLUB_SITE_BASE_DOMAIN = (
  process.env.NEXT_PUBLIC_CLUB_SITE_DOMAIN || "okgs.info"
)
  .trim()
  .replace(/^https?:\/\//i, "")
  .replace(/\/.*$/, "")
  .replace(/^\.+|\.+$/g, "") || "okgs.info";

export interface ClubUrlInput {
  slug: string;
  /** `alssm.okgs.info` (may arrive with a scheme or a trailing slash). */
  subdomain?: string | null;
  /** Explicit site address, if one was saved. */
  website?: string | null;
  /** Legacy alias for `website` from the clubs table. */
  domain?: string | null;
}

/** `alssm` → `alssm.okgs.info`. Never returns a scheme. */
export function clubSiteHost(
  slug: string,
  subdomain?: string | null,
): string {
  const clean = String(subdomain || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^\.+|\.+$/g, "");
  if (clean) return clean;
  const base = String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return base ? `${base}.${CLUB_SITE_BASE_DOMAIN}` : CLUB_SITE_BASE_DOMAIN;
}

/** Absolute `https://…` address of a club site. */
export function clubSiteUrl(input: ClubUrlInput): string {
  const explicit = String(input.website || input.domain || "").trim();
  if (/^https?:\/\//i.test(explicit)) return explicit.replace(/\/+$/, "");
  return `https://${clubSiteHost(input.slug, input.subdomain)}`;
}

/** The pretty label printed on buttons: `alssm.okgs.info`. */
export function clubSiteLabel(input: ClubUrlInput): string {
  const explicit = String(input.website || "").trim();
  if (/^https?:\/\//i.test(explicit)) {
    try {
      return new URL(explicit).host;
    } catch {
      /* fall through to the subdomain rules */
    }
  }
  return clubSiteHost(input.slug, input.subdomain);
}
