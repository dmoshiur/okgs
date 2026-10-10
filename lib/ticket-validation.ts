/** Resolve a ticket to a real person. No client-supplied name, payment or claim flag is trusted. */
import { parseTicketToken } from "@/lib/ticket-token";
import { parsePassToken } from "@/lib/qr";
import { getPassById } from "@/lib/portal-db";
import { getGuestById, getStudentByCode, getStudentById, type GuestRow, type StudentRow } from "@/lib/student-db";
import { extractScanValue } from "@/lib/scan-input";
import { guestTicketId } from "@/lib/ticket-identifiers";
import { toLatinDigits } from "@/lib/digits";
import { schoolDayKey } from "@/lib/school-time";
import type { EntrySubject } from "@/lib/scan-types";

export interface ScanIdentityInput {
  fair_slug: string;
  token?: string;
  code?: string;
}

export type ResolvedTicket =
  | { valid: true; subject: EntrySubject }
  | { valid: false; result: "invalid" | "expired"; message: string; subject: EntrySubject | null };

export function studentSubject(student: StudentRow): EntrySubject {
  return {
    type: "student", id: student.id, name: student.name, code: student.student_code,
    detail: [student.class_name, student.section ? `Section ${student.section}` : "", student.shift].filter(Boolean).join(" · "),
    photo_url: student.photo_url,
  };
}

export function guestSubject(guest: GuestRow): EntrySubject {
  return {
    type: "guest", id: guest.id, name: guest.name, code: guestTicketId(guest.id),
    detail: `${guest.relation}${guest.related_student_name ? ` of ${guest.related_student_name}` : ""}${guest.related_student_code ? ` · Student ${guest.related_student_code}` : ""}`,
    photo_url: guest.photo_url,
  };
}

/** Printed Bangla digits are readable aliases, not a new person or an extra lunch. */
async function readableStudentCode(code: string) {
  const latin = toLatinDigits(code);
  const direct = await getStudentByCode(code);
  const normalized = latin === code ? direct : await getStudentByCode(latin);
  return { student: direct || normalized, ambiguous: Boolean(direct && normalized && direct.id !== normalized.id) };
}

export async function resolveTicketHolder(input: ScanIdentityInput, now = new Date(), allowLegacyStudent = false): Promise<ResolvedTicket> {
  const invalid = (message: string, subject: EntrySubject | null = null): ResolvedTicket => ({ valid: false, result: "invalid", message, subject });
  if (!input.fair_slug || !/^[a-z0-9-]{2,64}$/i.test(input.fair_slug)) return invalid("Choose a valid fair before scanning.");

  if (input.token) {
    const token = extractScanValue(input.token);
    const payload = parseTicketToken(token);
    if (payload) {
      if (payload.f !== input.fair_slug) return invalid("This ticket belongs to a different fair.");
      let subject: EntrySubject | null = null;
      if (payload.k === "s") {
        const student = await getStudentById(payload.i);
        if (student) subject = studentSubject(student);
      } else {
        const guest = await getGuestById(payload.i);
        if (guest) subject = guestSubject(guest);
        if (guest && guest.fair_slug !== input.fair_slug) return invalid("This guest is registered for a different fair.", subject);
        if (guest && guest.status !== "active") return invalid("This guest pass has been revoked.", subject);
      }
      if (payload.e * 1000 <= now.getTime()) {
        return { valid: false, result: "expired", message: `This pass expired on ${new Date(payload.e * 1000).toISOString().slice(0, 10)}.`, subject };
      }
      return subject ? { valid: true, subject } : invalid("The ticket holder is not in the database.");
    }

    // A legacy STUDENT pass may map to the same roster identity. Family/guest
    // slots and project labels never inherit a student's lunch entitlement.
    if (allowLegacyStudent) {
      const parsed = parsePassToken(token);
      const pass = parsed ? await getPassById(parsed.id) : null;
      if (pass) {
        if (pass.fair_slug !== input.fair_slug) return invalid("This pass belongs to a different fair.");
        if (pass.status !== "active" && pass.status !== "used") return invalid("This pass has been revoked.");
        if (pass.expires_at && pass.expires_at.slice(0, 10) < schoolDayKey(now)) {
          return { valid: false, result: "expired", message: "This pass has expired.", subject: null };
        }
        if (pass.holder_role !== "student" || pass.parent_pass_id || !pass.student_id) {
          return invalid("A family/guest slot does not include a purchased lunch box. Use the registered guest's ticket.");
        }
        const found = await readableStudentCode(pass.student_id);
        if (found.ambiguous) return invalid("This student ID is ambiguous. Use the student’s signed ticket QR.");
        return found.student ? { valid: true, subject: studentSubject(found.student) } : invalid("The student is not in the roster.");
      }
    }
    return invalid("Not an OKGS person ticket. The QR code is unreadable or has been altered.");
  }

  const code = String(input.code ?? "").trim();
  if (!code || code.length > 128) return invalid("Enter a valid student ID.");
  const found = await readableStudentCode(code);
  if (found.ambiguous) return invalid("This student ID is ambiguous. Use the student’s signed ticket QR.");
  return found.student ? { valid: true, subject: studentSubject(found.student) } : invalid(`No student with ID "${code}" was found.`);
}
