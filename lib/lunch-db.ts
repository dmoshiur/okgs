/** Atomic canteen claims and a separate audit trail; gate admissions are never consumed here. */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { dbQuery as query, dbRun as run, ensurePortal } from "@/lib/portal-db";
import { GUEST_LUNCH_FEE } from "@/lib/guest-fees";
import { nextSchoolDayIso, schoolDayKey } from "@/lib/school-time";
import { LUNCH_ALREADY_CLAIMED, LUNCH_NO_PURCHASE, type EntrySubject, type LunchAction, type LunchResult, type LunchState, type ScanMethod } from "@/lib/scan-types";

export interface LunchScanLog {
  id: string;
  fair_slug: string;
  subject_type: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  method: ScanMethod;
  action: LunchAction;
  result: LunchResult;
  claim_date: string;
  claim_time: string;
  scanned_at: string;
  scanned_by: string;
  scanned_by_name: string;
  note: string;
}

export function emptyLunchState(now = new Date()): LunchState {
  return { eligible: false, claimed_today: false, claimed_at: "", day: schoolDayKey(now), next_reset_at: nextSchoolDayIso(now) };
}

/** Payment is always read live, not from the QR, UI flags or an earlier check. */
function entitlement(subject: Pick<EntrySubject, "type" | "id">, fair: string) {
  if (subject.type === "student") {
    return {
      sql: `EXISTS (SELECT 1 FROM students s JOIN payments p ON p.student_id = s.id
        WHERE s.id = ? AND p.fair_slug = ? AND p.status = 'PAID')`,
      args: [subject.id, fair] as (string | number)[],
    };
  }
  return {
    sql: `EXISTS (SELECT 1 FROM guests g WHERE g.id = ? AND g.fair_slug = ?
      AND g.status = 'active' AND g.fee_status = 'PAID' AND g.has_lunch = 1 AND g.lunch_fee >= ?)`,
    args: [subject.id, fair, GUEST_LUNCH_FEE] as (string | number)[],
  };
}

function stateQuery(subject: Pick<EntrySubject, "type" | "id">, fair: string, day: string) {
  const paid = entitlement(subject, fair);
  return {
    sql: `SELECT ${paid.sql} AS eligible, COALESCE(c.id, '') AS claim_id, COALESCE(c.claimed_at, '') AS claimed_at
      FROM (SELECT 1) base LEFT JOIN lunch_claims c
      ON c.subject_type = ? AND c.subject_id = ? AND c.claim_date = ?`,
    args: [...paid.args, subject.type, subject.id, day],
  };
}

export async function getLunchState(fair: string, subject: Pick<EntrySubject, "type" | "id">, now = new Date()): Promise<LunchState> {
  const statement = stateQuery(subject, fair, schoolDayKey(now));
  const [state] = await query<{ eligible: number; claim_id: string; claimed_at: string }>(statement.sql, statement.args);
  return {
    ...emptyLunchState(now), eligible: Boolean(Number(state?.eligible)),
    claimed_today: Boolean(state?.claim_id), claimed_at: state?.claimed_at || "",
  };
}

export const LUNCH_MESSAGES: Record<LunchResult, string> = {
  ready: "Authorized: Lunch box available.",
  success: "Lunch box claimed successfully.",
  duplicate: LUNCH_ALREADY_CLAIMED,
  denied: LUNCH_NO_PURCHASE,
  expired: "This ticket has expired. A lunch box cannot be claimed.",
  invalid: LUNCH_NO_PURCHASE,
};

/**
 * A conditional insert + unique person/day key + audit write in ONE transaction.
 * No read-then-write race: payment changes and simultaneous scanners cannot
 * mint an extra lunch. A check does not consume anything; a claim revalidates.
 * `now` is server-owned (injectable for regression tests), never read from JSON.
 */
export async function decideLunch(input: {
  fair_slug: string;
  subject: EntrySubject;
  action: LunchAction;
  method: ScanMethod;
  actor_id: string;
  actor_name: string;
}, now = new Date()): Promise<{ result: LunchResult; lunch: LunchState; log: LunchScanLog }> {
  await ensurePortal();
  const { subject } = input;
  const day = schoolDayKey(now);
  const stamp = now.toISOString();
  const claimId = randomUUID();
  const logId = randomUUID();
  const paid = entitlement(subject, input.fair_slug);
  const state = stateQuery(subject, input.fair_slug, day);
  const decision = {
    sql: `SELECT state.*, CASE
      WHEN state.eligible = 0 THEN 'denied'
      ${input.action === "claim" ? "WHEN state.claim_id = ? THEN 'success'" : ""}
      WHEN state.claim_id <> '' THEN 'duplicate'
      ELSE '${input.action === "check" ? "ready" : "denied"}' END AS result
      FROM (${state.sql}) state`,
    args: [...(input.action === "claim" ? [claimId] : []), ...state.args],
  };

  const statements = input.action === "claim" ? [{
    sql: `INSERT INTO lunch_claims (id, fair_slug, subject_type, subject_id, claim_date, claimed_at, claimed_by, claimed_by_name)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${paid.sql}
      ON CONFLICT(subject_type, subject_id, claim_date) DO NOTHING`,
    args: [claimId, input.fair_slug, subject.type, subject.id, day, stamp, input.actor_id, input.actor_name, ...paid.args],
  }] : [];
  statements.push({
    sql: `INSERT INTO lunch_scan_logs (id, fair_slug, subject_type, subject_id, subject_name, subject_code,
      method, action, result, claim_date, claim_time, scanned_at, scanned_by, scanned_by_name, note)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, decision.result, ?, decision.claimed_at, ?, ?, ?,
        CASE decision.result
          WHEN 'success' THEN 'Lunch box claimed successfully.'
          WHEN 'ready' THEN 'Authorized: Lunch box available.'
          WHEN 'duplicate' THEN 'Lunch Box Already Claimed Today.'
          ELSE 'Unauthorized: No Lunch Box Purchased.' END
      FROM (${decision.sql}) decision`,
    args: [logId, input.fair_slug, subject.type, subject.id, subject.name, subject.code,
      input.method, input.action, day, stamp, input.actor_id, input.actor_name, ...decision.args],
  }, { sql: `SELECT * FROM lunch_scan_logs WHERE id = ?`, args: [logId] });

  const results = await db.batch(statements, "write");
  const log = results.at(-1)!.rows[0] as unknown as LunchScanLog;
  if (!log) throw new Error("LUNCH_DECISION_NOT_RECORDED");
  return {
    result: log.result, log,
    lunch: {
      ...emptyLunchState(now), eligible: log.result === "ready" || log.result === "success" || log.result === "duplicate",
      claimed_today: Boolean(log.claim_time), claimed_at: log.claim_time,
    },
  };
}

/** Invalid/expired attempts are audited, but can NEVER enter the claims table. */
export async function recordLunchRejection(input: Omit<LunchScanLog, "id">) {
  await run(`INSERT INTO lunch_scan_logs (id, fair_slug, subject_type, subject_id, subject_name, subject_code,
    method, action, result, claim_date, claim_time, scanned_at, scanned_by, scanned_by_name, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    randomUUID(), input.fair_slug, input.subject_type, input.subject_id, input.subject_name, input.subject_code,
    input.method, input.action, input.result, input.claim_date, input.claim_time, input.scanned_at,
    input.scanned_by, input.scanned_by_name, input.note,
  ]);
}

export async function listLunchScans(fair: string, options: { today?: boolean; limit?: number } = {}, now = new Date()) {
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(500, Math.floor(options.limit!))) : 150;
  const where = `fair_slug = ?${options.today ? " AND claim_date = ?" : ""}`;
  const args = options.today ? [fair, schoolDayKey(now)] : [fair];
  return query<LunchScanLog>(`SELECT * FROM lunch_scan_logs WHERE ${where} ORDER BY scanned_at DESC, id DESC LIMIT ${limit}`, args);
}

export async function lunchScanSummary(fair: string, now = new Date()) {
  const day = schoolDayKey(now);
  const [counts, claims] = await Promise.all([
    query<{ result: LunchResult; total: number }>(`SELECT result, COUNT(*) AS total FROM lunch_scan_logs
      WHERE fair_slug = ? AND claim_date = ? GROUP BY result`, [fair, day]),
    query<{ total: number }>(`SELECT COUNT(*) AS total FROM lunch_claims WHERE fair_slug = ? AND claim_date = ?`, [fair, day]),
  ]);
  const summary: Record<LunchResult, number> = { success: 0, ready: 0, duplicate: 0, denied: 0, expired: 0, invalid: 0 };
  for (const row of counts) summary[row.result] = Number(row.total);
  return { ...summary, claimed: Number(claims[0]?.total ?? 0), day, next_reset_at: nextSchoolDayIso(now) };
}
