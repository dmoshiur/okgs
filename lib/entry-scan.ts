/**
 * Entry decision for one QR scan or manual ID entry.
 *
 * Order of checks: signature → fair → expiry → holder exists / not revoked →
 * already admitted today? Each outcome (success, duplicate, expired, invalid)
 * is written to `scan_logs` with the exact scanned_at and entry_time.
 */
import { parseTicketToken } from "@/lib/ticket-token";
import { findAdmission, getGuestById, getStudentByCode, getStudentById, insertScanLog, type StudentRow, type GuestRow } from "@/lib/student-db";

export type EntryResult = "success" | "duplicate" | "expired" | "invalid";

export interface EntrySubject {
  type: "student" | "guest";
  id: string;
  name: string;
  code: string;
  detail: string;
}

export interface EntryOutcome {
  result: EntryResult;
  title: string;
  message: string;
  subject: EntrySubject | null;
  entry_time: string;
  scanned_at: string;
}

function studentSubject(student: StudentRow): EntrySubject {
  return {
    type: "student",
    id: student.id,
    name: student.name,
    code: student.student_code,
    detail: [student.class_name, student.section ? `Section ${student.section}` : "", student.shift].filter(Boolean).join(" · "),
  };
}

function guestSubject(guest: GuestRow): EntrySubject {
  return {
    type: "guest",
    id: guest.id,
    name: guest.name,
    code: guest.related_student_code ?? "",
    detail: `${guest.relation}${guest.related_student_name ? ` of ${guest.related_student_name}` : ""}`,
  };
}

const TITLES: Record<EntryResult, string> = {
  success: "Entry granted",
  duplicate: "Already admitted",
  expired: "Pass expired",
  invalid: "Invalid pass",
};

export async function processEntry(input: {
  fair_slug: string;
  token?: string;
  code?: string;
  method: "qr" | "manual";
  actor_id: string;
  actor_name: string;
}): Promise<EntryOutcome> {
  const now = new Date();
  const scannedAt = now.toISOString();
  const fair = input.fair_slug;

  const finish = async (
    result: EntryResult,
    message: string,
    subject: EntrySubject | null,
    entryTime = "",
  ): Promise<EntryOutcome> => {
    const stamp = entryTime || (result === "success" ? scannedAt : "");
    await insertScanLog({
      fair_slug: fair,
      subject_type: subject?.type ?? "",
      subject_id: subject?.id ?? "",
      subject_name: subject?.name ?? "",
      subject_code: subject?.code ?? "",
      method: input.method,
      result,
      entry_time: stamp,
      scanned_at: scannedAt,
      scanned_by: input.actor_id,
      scanned_by_name: input.actor_name,
      note: message,
    });
    return { result, title: TITLES[result], message, subject, entry_time: stamp, scanned_at: scannedAt };
  };

  if (input.token) {
    const payload = parseTicketToken(input.token);
    if (!payload) return finish("invalid", "Not an OKGS ticket. The QR code is unreadable or has been altered.", null);
    if (payload.f !== fair) return finish("invalid", "This ticket belongs to a different fair.", null);

    let subject: EntrySubject | null = null;
    if (payload.k === "s") {
      const student = await getStudentById(payload.i);
      if (student) subject = studentSubject(student);
    } else {
      const guest = await getGuestById(payload.i);
      if (guest) subject = guestSubject(guest);
      if (guest && guest.status !== "active") return finish("invalid", "This guest pass has been revoked.", subject);
    }

    if (payload.e * 1000 < now.getTime()) {
      return finish("expired", `This pass expired on ${new Date(payload.e * 1000).toISOString().slice(0, 10)}.`, subject);
    }
    if (!subject) return finish("invalid", "The ticket holder is not in the database.", null);
    return admit(fair, subject, finish, "Ticket QR scanned.");
  }

  const code = String(input.code ?? "").trim();
  if (!code) return finish("invalid", "No ID was entered.", null);
  const student = await getStudentByCode(code);
  if (!student) return finish("invalid", `No student with ID "${code}" was found.`, null);
  return admit(fair, studentSubject(student), finish, "Entered manually by ID.");
}

async function admit(
  fair: string,
  subject: EntrySubject,
  finish: (result: EntryResult, message: string, subject: EntrySubject | null, entryTime?: string) => Promise<EntryOutcome>,
  successNote: string,
) {
  const existing = await findAdmission(fair, subject.type, subject.id);
  if (existing) {
    return finish("duplicate", `Already admitted at ${existing.entry_time}. This is a repeat scan.`, subject, existing.entry_time);
  }
  return finish("success", successNote, subject);
}
