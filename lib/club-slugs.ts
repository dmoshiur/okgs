/**
 * The five OKGS clubs, as folder + subdomain slugs.
 *
 * Kept in its own module (no imports at all) so both the data layer and the
 * seeding code can use the list without creating an import cycle.
 * The club folders under `clubs/` are named after these slugs.
 */
export const DEFAULT_CLUB_SLUGS = ["alssm", "aypg", "alpcg", "aygsm", "artds"] as const;

export function isClubSlug(value: string): boolean {
  return (DEFAULT_CLUB_SLUGS as readonly string[]).includes(value);
}
