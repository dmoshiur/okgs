/**
 * Outside-guest fee structure for the Science Fair.
 *
 * Every registered guest pays the mandatory entry fee; the lunch box is an
 * optional add-on chosen at registration time. The amounts are fixed here —
 * API routes and panels both read these constants, so the registration form,
 * the stored row and the accounting dashboard can never disagree about price.
 */

/** Mandatory guest entry fee (BDT). */
export const GUEST_ENTRY_FEE = 50;

/** Optional lunch box fee (BDT). */
export const GUEST_LUNCH_FEE = 150;

export interface GuestFeeBreakdown {
  /** Mandatory entry fee — always charged. */
  entry: number;
  /** Lunch box fee — only when the guest opted in. */
  lunch: number;
  /** Entry + lunch: 50 BDT or 200 BDT. */
  total: number;
}

/** Entry (50) plus the lunch box (150) when selected — 50 or 200 BDT total. */
export function guestFeeBreakdown(hasLunch: boolean): GuestFeeBreakdown {
  const lunch = hasLunch ? GUEST_LUNCH_FEE : 0;
  return { entry: GUEST_ENTRY_FEE, lunch, total: GUEST_ENTRY_FEE + lunch };
}
