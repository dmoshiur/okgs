/** Gate decisions remain separate from canteen claims; both verify the real ticket holder. */
import { findAdmission, getGuestById, getPaymentStatus, insertScanLog } from "@/lib/student-db";
import { emptyLunchState, getLunchState } from "@/lib/lunch-db";
import { resolveTicketHolder } from "@/lib/ticket-validation";
import type { EntryOutcome, EntryResult, EntrySubject, ScanMethod } from "@/lib/scan-types";
export type { EntryOutcome, EntryResult, EntrySubject } from "@/lib/scan-types";

const TITLES: Record<EntryResult, string> = {
  success: "Entry granted", duplicate: "Already admitted", expired: "Pass expired", invalid: "Invalid pass",
};

export async function processEntry(input: {
  fair_slug: string;
  token?: string;
  code?: string;
  method: ScanMethod;
  actor_id: string;
  actor_name: string;
}): Promise<EntryOutcome> {
  const now = new Date();
  const scannedAt = now.toISOString();
  const finish = async (result: EntryResult, message: string, subject: EntrySubject | null, entryTime = ""): Promise<EntryOutcome> => {
    const stamp = entryTime || (result === "success" ? scannedAt : "");
    await insertScanLog({
      fair_slug: input.fair_slug, subject_type: subject?.type ?? "", subject_id: subject?.id ?? "",
      subject_name: subject?.name ?? "", subject_code: subject?.code ?? "", method: input.method,
      result, entry_time: stamp, scanned_at: scannedAt, scanned_by: input.actor_id,
      scanned_by_name: input.actor_name, note: message,
    });
    const lunch = subject ? await getLunchState(input.fair_slug, subject, now) : emptyLunchState(now);
    return { result, title: TITLES[result], message, subject, entry_time: stamp, scanned_at: scannedAt, lunch };
  };

  const resolved = await resolveTicketHolder(input, now);
  if (!resolved.valid) return finish(resolved.result, resolved.message, resolved.subject);
  const { subject } = resolved;
  // A reprinted QR is not proof that the fee is still paid. Refunds/revocations
  // take effect immediately, including manual student-ID admissions.
  const paid = subject.type === "student"
    ? await getPaymentStatus(subject.id, input.fair_slug) === "PAID"
    : (await getGuestById(subject.id))?.fee_status === "PAID";
  if (!paid) return finish("invalid", "Entry denied: this ticket's fee has not been paid.", subject);
  const existing = await findAdmission(input.fair_slug, subject.type, subject.id);
  if (existing) return finish("duplicate", `Already admitted at ${existing.entry_time}. This is a repeat scan.`, subject, existing.entry_time);
  return finish("success", input.method === "qr" ? "Ticket QR scanned." : "Entered manually by ID.", subject);
}
