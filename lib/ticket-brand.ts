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
