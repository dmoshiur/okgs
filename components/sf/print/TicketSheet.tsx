/**
 * Landscape (A4 landscape, 297 × 210 mm) entry ticket. One sheet per copy.
 * Server-rendered so the printed page and the QR are produced by the backend.
 *
 * Copy 1 is the student copy. From copy 2 onward the parents' names and the
 * external guardian block (Mama / Fufa / Chacha / guest) are printed too.
 */
import { formatDateEn } from "@/lib/format";

export interface TicketStudent {
  name: string;
  student_code: string;
  roll: string;
  class_name: string;
  section: string;
  shift: string;
  student_group: string;
  branch: string;
  father_name: string;
  mother_name: string;
  photo_url: string;
}

export interface TicketGuardian {
  name: string;
  relation: string;
  contact: string;
}

export interface TicketSheetProps {
  kind: "student" | "guest";
  schoolName: string;
  fairName: string;
  logo: string;
  copyIndex: number;
  copyCount: number;
  copyLabel: string;
  showFamily: boolean;
  student: TicketStudent;
  paymentStatus: "PAID" | "UNPAID";
  guardian: TicketGuardian | null;
  guest?: { name: string; relation: string; contact: string; status: string };
  admittedAt: string;
  qr: string;
  validUntil: string;
  issuedAt: string;
  ticketCode: string;
  printedBy: string;
}

function initialsOf(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="ticket-field">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

export function TicketSheet(props: TicketSheetProps) {
  const { student, guest } = props;
  const isGuest = props.kind === "guest";
  const headline = isGuest ? guest?.name ?? "" : student.name;
  const revoked = isGuest && guest?.status !== "active";

  return (
    <section className={`ticket-sheet ${isGuest ? "is-guest" : ""}`} aria-label={`${isGuest ? "Guest pass" : "Student ticket"} ${props.copyIndex} of ${props.copyCount}`}>
      <div className="ticket-frame">
        <header className="ticket-head">
          <div className="ticket-school">
            {props.logo ? <img src={props.logo} alt="" className="ticket-logo" /> : <span className="ticket-logo ticket-logo-fallback">{initialsOf(props.schoolName)}</span>}
            <div>
              <strong>{props.schoolName}</strong>
              <small>{props.fairName}</small>
            </div>
          </div>
          <div className="ticket-kind">
            <span>{isGuest ? "OUTSIDE GUEST PASS" : "STUDENT ENTRY TICKET"}</span>
            <b>{props.copyLabel}</b>
            <em>
              Copy {props.copyIndex} of {props.copyCount}
            </em>
          </div>
        </header>

        <div className="ticket-body">
          <div className="ticket-photo" aria-hidden="true">
            {!isGuest && student.photo_url ? <img src={student.photo_url} alt="" /> : <span>{initialsOf(headline)}</span>}
          </div>

          <div className="ticket-info">
            <h2 className="ticket-name">{headline || "—"}</h2>
            {isGuest ? (
              <dl className="ticket-grid">
                <Field label="Relation" value={guest?.relation ?? ""} />
                <Field label="Contact" value={guest?.contact ?? ""} />
                <Field label="Visiting student" value={student.name} />
                <Field label="Student ID" value={student.student_code} />
                <Field label="Class" value={student.class_name} />
                <Field label="Section" value={student.section} />
              </dl>
            ) : (
              <dl className="ticket-grid">
                <Field label="Student ID" value={student.student_code} />
                <Field label="Roll" value={student.roll} />
                <Field label="Class" value={student.class_name} />
                <Field label="Section" value={student.section} />
                <Field label="Shift" value={student.shift} />
                <Field label="Group" value={student.student_group} />
              </dl>
            )}

            {!isGuest && props.showFamily ? (
              <div className="ticket-family">
                <div className="ticket-family-row">
                  <Field label="Father's name" value={student.father_name} />
                  <Field label="Mother's name" value={student.mother_name} />
                </div>
                <div className="ticket-guardian">
                  <span className="ticket-guardian-title">External guardian (Mama / Fufa / Chacha / guest)</span>
                  {props.guardian ? (
                    <strong>
                      {props.guardian.name} · {props.guardian.relation}
                      {props.guardian.contact ? ` · ${props.guardian.contact}` : ""}
                    </strong>
                  ) : (
                    <div className="ticket-blank">
                      <span>Name ____________________</span>
                      <span>Relation ____________</span>
                      <span>Contact ____________</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="ticket-status-row">
              {isGuest ? (
                <span className={`ticket-pill ${revoked ? "is-unpaid" : "is-paid"}`}>{revoked ? "REVOKED" : "ACTIVE GUEST"}</span>
              ) : (
                <span className={`ticket-pill ${props.paymentStatus === "PAID" ? "is-paid" : "is-unpaid"}`}>Fee: {props.paymentStatus}</span>
              )}
              <span className={`ticket-pill ${props.admittedAt ? "is-admitted" : ""}`}>
                {props.admittedAt ? `Admitted ${formatDateEn(props.admittedAt, "short")}` : "Not yet admitted"}
              </span>
            </div>
          </div>

          <div className="ticket-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.qr} alt="Signed entry QR code" />
            <small>Scan at the gate</small>
            <code>{props.ticketCode}</code>
          </div>
        </div>

        <footer className="ticket-foot">
          <span>Valid until {props.validUntil}</span>
          <span>Issued {props.issuedAt}</span>
          <span>Printed by {props.printedBy}</span>
          <span>QR signed with HMAC-SHA256 · tamper-evident</span>
        </footer>
      </div>
    </section>
  );
}
