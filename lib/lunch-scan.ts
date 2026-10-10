/** Canteen verification and one-per-day lunch claiming. Never records a gate admission. */
import { resolveTicketHolder, type ScanIdentityInput } from "@/lib/ticket-validation";
import { decideLunch, emptyLunchState, LUNCH_MESSAGES, recordLunchRejection } from "@/lib/lunch-db";
import type { LunchAction, LunchOutcome, LunchResult, ScanMethod } from "@/lib/scan-types";

const TITLES: Record<LunchResult, string> = {
  ready: "Lunch box authorized", success: "Lunch box claimed", duplicate: "Already claimed today",
  denied: "Lunch box denied", expired: "Pass expired", invalid: "Lunch box denied",
};

export async function processLunchScan(input: ScanIdentityInput & {
  action: LunchAction;
  method: ScanMethod;
  actor_id: string;
  actor_name: string;
}, now = new Date()): Promise<LunchOutcome> {
  const resolved = await resolveTicketHolder(input, now, true);
  const scannedAt = now.toISOString();
  if (!resolved.valid) {
    const lunch = emptyLunchState(now);
    await recordLunchRejection({
      fair_slug: input.fair_slug, subject_type: resolved.subject?.type || "",
      subject_id: resolved.subject?.id || "", subject_name: resolved.subject?.name || "",
      subject_code: resolved.subject?.code || "", method: input.method, action: input.action,
      result: resolved.result, claim_date: lunch.day, claim_time: "", scanned_at: scannedAt,
      scanned_by: input.actor_id, scanned_by_name: input.actor_name, note: resolved.message,
    });
    return {
      result: resolved.result, title: TITLES[resolved.result], message: LUNCH_MESSAGES[resolved.result],
      reason: resolved.message, action: input.action, subject: resolved.subject,
      claim_time: "", scanned_at: scannedAt, lunch,
    };
  }
  const decision = await decideLunch({ ...input, subject: resolved.subject }, now);
  return {
    result: decision.result, title: TITLES[decision.result], message: LUNCH_MESSAGES[decision.result],
    action: input.action, subject: resolved.subject, claim_time: decision.lunch.claimed_at,
    scanned_at: scannedAt, lunch: decision.lunch,
  };
}
