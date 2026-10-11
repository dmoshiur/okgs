/**
 * Fixed branding for the Science Fair entry ticket.
 *
 * The ticket redesign pins these values: the institution pair in the header,
 * the Scholars logo on the right, the fair president's signature above the
 * footer line, and the validity date. They live here — not in the component —
 * so the single A6 print and the 4-per-page A4 sheet can never drift apart.
 */

/** Main header line of every ticket. */
export const TICKET_SCHOOL_NAME = "Omar Kindergarten School";

/** Sub-header printed directly under the school name. */
export const TICKET_SUB_HEADER = "Scholars Residential School";

/** Right-hand logo of the ticket header (Scholars Residential School). */
export const SCHOLARS_LOGO_URL = "https://i.postimg.cc/J7f1pBcs/SCHOLARS-Logo-(English).png";

/** Fair President's signature image, printed bottom-right above the footer. */
export const FAIR_PRESIDENT_SIGNATURE_URL =
  "https://see.fontimg.com/api/rf5/DOLnW/ZTAyODAyZDM3MWUyNDVjNjg0ZWRmYTRjMjNlOTE3ODUub3Rm/UnViZWw/autography.png?r=fs&h=81&w=1250&fg=000000&bg=FFFFFF&tb=1&s=65";

/** The ticket's validity date — printed strictly as 31 December 2026. */
export const TICKET_VALID_UNTIL_ISO = "2026-12-31";

/** Event tagline printed directly under the fair title on every ticket. */
export const TICKET_TAGLINE = "Exploring The Universe Of Science";

/** Official website printed under the club logos. */
export const TICKET_WEBSITE = "okgs.info";

/**
 * The three official contact numbers printed under the website. The label
 * key is looked up in `ticketText(lang).labels`, so the wording follows the
 * sheet's language while the digits stay exactly as issued.
 */
export const TICKET_CONTACTS = [
  { key: "telephone", number: "05725-56351-52" },
  { key: "president", number: "01329-625713" },
  { key: "helpLine", number: "01711-857205" },
] as const;

export type TicketContactKey = (typeof TICKET_CONTACTS)[number]["key"];

/**
 * The five OKGS clubs, in the order they appear on the ticket. `fallbackLogo`
 * is the bundled club artwork, used only when the club record is missing from
 * the database; a club that exists but has no logo prints as a short-code
 * monogram instead.
 */
export const TICKET_CLUBS = [
  { slug: "alssm", code: "ALSSM", name: "Association Of Little Scientists And Math Maniacs", fallbackLogo: "/media/club-science.svg" },
  { slug: "aypg", code: "AYPG", name: "Association Of Young Philologists And Grammarians", fallbackLogo: "/media/club-language.svg" },
  { slug: "alpcg", code: "ALPCG", name: "Association Of Little Programmers And Computer Geeks", fallbackLogo: "/media/club-computer.svg" },
  { slug: "aygsm", code: "AYGSM", name: "Association Of Young Gymnastics And Sports Maniac", fallbackLogo: "/media/club-sports.svg" },
  { slug: "artds", code: "ARTDS", name: "ART Debating Society", fallbackLogo: "/media/club-culture.svg" },
] as const;

/** One club as the ticket prints it. An empty `logo` means: draw the monogram. */
export interface TicketClub {
  code: string;
  name: string;
  logo: string;
}

/** The loose shape of a club row — only the fields the ticket reads. */
export interface TicketClubSource {
  slug?: string;
  short_code?: string;
  name?: string;
  name_en?: string;
  logo_url?: string;
}

/**
 * Resolves the five ticket clubs from the live club records, in ticket order.
 * Logos come from the club's own `logo_url` so an admin logo change reaches the
 * paper; a missing record falls back to the bundled artwork.
 */
export function ticketClubs(clubs: ReadonlyArray<TicketClubSource> | null | undefined = []): TicketClub[] {
  const bySlug = new Map((clubs ?? []).map((club) => [String(club.slug ?? "").trim().toLowerCase(), club]));
  return TICKET_CLUBS.map((brand) => {
    const row = bySlug.get(brand.slug);
    if (!row) return { code: brand.code, name: brand.name, logo: brand.fallbackLogo };
    return {
      code: brand.code,
      name: String(row.name_en || row.name || brand.name).trim(),
      logo: String(row.logo_url ?? "").trim(),
    };
  });
}
