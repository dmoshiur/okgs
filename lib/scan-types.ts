/** Client-safe contracts for the gate and canteen scanners. No credentials or Node imports. */
export type ScanMode = "gate" | "lunch";
export type ScanMethod = "qr" | "manual";
export type ScanTone = "success" | "warn" | "danger";
export type LunchAction = "check" | "claim";
export type LunchResult = "ready" | "success" | "duplicate" | "denied" | "expired" | "invalid";
export type EntryResult = "success" | "duplicate" | "expired" | "invalid";

export interface EntrySubject {
  type: "student" | "guest";
  id: string;
  name: string;
  /** Student's school ID, or the guest's own printed reference (never the student's ID). */
  code: string;
  detail: string;
  photo_url: string;
}

export interface LunchState {
  eligible: boolean;
  claimed_today: boolean;
  claimed_at: string;
  day: string;
  next_reset_at: string;
}

export interface EntryOutcome {
  result: EntryResult;
  title: string;
  message: string;
  subject: EntrySubject | null;
  entry_time: string;
  scanned_at: string;
  lunch: LunchState;
}

export interface LunchOutcome {
  result: LunchResult;
  title: string;
  message: string;
  /** Explanation of a malformed, wrong-fair, revoked or expired ticket. */
  reason?: string;
  action: LunchAction;
  subject: EntrySubject | null;
  claim_time: string;
  scanned_at: string;
  lunch: LunchState;
}

export const LUNCH_NO_PURCHASE = "Unauthorized: No Lunch Box Purchased.";
export const LUNCH_ALREADY_CLAIMED = "Lunch Box Already Claimed Today.";

export const LUNCH_RESULT_LABEL: Record<LunchResult, string> = {
  ready: "Authorized", success: "Success", duplicate: "Already claimed",
  denied: "Denied", expired: "Expired", invalid: "Denied",
};

export const LUNCH_RESULT_TONE: Record<LunchResult, ScanTone> = {
  ready: "success", success: "success", duplicate: "warn",
  denied: "danger", expired: "danger", invalid: "danger",
};

export function lunchStateLabel(state?: LunchState) {
  if (!state) return "Not verified";
  if (!state.eligible) return "No lunch box purchased";
  return state.claimed_today ? "Claimed today" : "Available today";
}
