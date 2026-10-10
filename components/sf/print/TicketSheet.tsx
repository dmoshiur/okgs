/**
 * Landscape (A4 landscape, 297 × 210 mm) entry ticket. One sheet per copy.
 * Server-rendered so the printed page and the QR are produced by the backend.
 *
 * Layout contract (kept stable for the print CSS):
 *   head  — school logo, school name, event title, ticket kind + copy label
 *   body  — student photo (left, 3:4) · details · signed QR (right)
 *   foot  — validity, issue date, who printed it, signature note
 *
 * Copy 1 is the student copy. From copy 2 onward the parents' names and the
 * external guardian block (Mama / Fufa / Chacha / guest) are printed too.
 *
 * Every word on the sheet comes from `ticketText(lang)` — see lib/ticket-locale.ts.
 * The component itself holds no English or Bangla string literals, which is what
 * makes the three language modes (English / Bangla / bilingual) uniform.
 */
import { optimizedImage } from "@/lib/cloudinary";
import {
  ticketDate,
  ticketNumber,
  ticketSchoolName,
  ticketText,
  ticketValue,
  type TicketLabel,
  type TicketLang,
} from "@/lib/ticket-locale";

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
  /** Optional: when omitted the label is taken from the ticket language. */
  copyLabel?: string;
  showFamily: boolean;
  /** `en` (default), `bn` or `both` — every label on the sheet follows it. */
  lang?: TicketLang;
  student: TicketStudent;
  paymentStatus: "PAID" | "UNPAID";
  guardian: TicketGuardian | null;
  /** Every approved external guardian of this student — Mama, Fufa, Chacha, … */
  guardians?: TicketGuardian[];
  guest?: { name: string; relation: string; contact: string; status: string };
  admittedAt: string;
  qr: string;
  /** Already formatted for the sheet's language. */
  validUntil: string;
  issuedAt: string;
  ticketCode: string;
  printedBy: string;
}

function initialsOf(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?";
}

/** One `Label / value` pair. In bilingual mode the English sits under the Bangla. */
function Field({ label, value, lang, wide }: { label: TicketLabel; value: string; lang: TicketLang; wide?: boolean }) {
  return (
    <div className={`ticket-field${wide ? " is-wide" : ""}`}>
      <dt>
        {label.primary}
        {label.secondary ? <em>{label.secondary}</em> : null}
      </dt>
      <dd>{ticketNumber(value, lang) || "—"}</dd>
    </div>
  );
}

export function TicketSheet(props: TicketSheetProps) {
  const { student, guest } = props;
  const lang = props.lang ?? "en";
  const t = ticketText(lang);
  const schoolName = ticketSchoolName(props.schoolName);
  const isGuest = props.kind === "guest";
  const headline = isGuest ? guest?.name ?? "" : student.name;
  const revoked = isGuest && guest?.status !== "active";
  const kindLabel = isGuest ? t.titles.guestPass : t.titles.studentTicket;
  const copySource = isGuest ? t.titles.guestCopy : t.titles.copies[props.copyIndex - 1] ?? t.titles.copies[0];
  const copyLabel = props.copyLabel || copySource.primary;
  const copyAlt = !props.copyLabel || props.copyLabel === copySource.primary ? copySource.secondary : "";
  // Every approved outside guardian is printed, plus two blank lines a gate
  // warden can fill by hand for a walk-in relative.
  const listed = props.guardians?.length ? props.guardians : props.guardian ? [props.guardian] : [];
  const spare = listed.length < 2 ? [t.notes.blankName, t.notes.blankRelation] : [];
  const paid = props.paymentStatus === "PAID";
  // `f_auto,q_auto,w_600,h_800,c_fill` keeps the printed photo a 3:4 crop and small.
  const photo = optimizedImage(student.photo_url, { width: 600, height: 800, fit: "cover" });

  return (
    <section
      className={`ticket-sheet printable-ticket ${isGuest ? "is-guest" : ""} ${paid || isGuest ? "" : "is-unpaid-sheet"}`}
      data-lang={lang}
      aria-label={`${isGuest ? "Guest pass" : "Student ticket"} ${props.copyIndex} of ${props.copyCount}`}
    >
      <div className="ticket-frame">
        <header className="ticket-head">
          <div className="ticket-school">
            {props.logo ? (
              <img src={props.logo} alt="" className="ticket-logo" />
            ) : (
              <span className="ticket-logo ticket-logo-fallback">{initialsOf(schoolName)}</span>
            )}
            <div className="ticket-school-copy">
              <strong>{schoolName}</strong>
              <small>{ticketValue(props.fairName, lang)}</small>
            </div>
          </div>
          <div className="ticket-kind">
            <span>{kindLabel.primary}</span>
            {kindLabel.secondary ? <i>{kindLabel.secondary}</i> : null}
            <b>{copyLabel}</b>
            {copyAlt ? <i>{copyAlt}</i> : null}
            <em>{t.titles.copyOf(props.copyIndex, props.copyCount)}</em>
          </div>
        </header>

        <div className="ticket-body">
          <figure className="ticket-photo">
            {!isGuest && photo ? <img src={photo} alt="" /> : <span>{initialsOf(headline)}</span>}
          </figure>

          <div className="ticket-info">
            <h2 className="ticket-name">{headline || "—"}</h2>
            {isGuest ? (
              <dl className="ticket-grid">
                <Field label={t.labels.relation} value={guest?.relation ?? ""} lang={lang} />
                <Field label={t.labels.contact} value={guest?.contact ?? ""} lang={lang} />
                <Field label={t.labels.visitingStudent} value={student.name} lang={lang} />
                <Field label={t.labels.studentId} value={student.student_code} lang={lang} />
                <Field label={t.labels.className} value={student.class_name} lang={lang} />
                <Field label={t.labels.section} value={student.section} lang={lang} />
              </dl>
            ) : (
              <dl className="ticket-grid">
                <Field label={t.labels.studentId} value={student.student_code} lang={lang} />
                <Field label={t.labels.roll} value={student.roll} lang={lang} />
                <Field label={t.labels.className} value={student.class_name} lang={lang} />
                <Field label={t.labels.section} value={student.section} lang={lang} />
                <Field label={t.labels.shift} value={student.shift} lang={lang} />
                <Field label={t.labels.group} value={student.student_group} lang={lang} />
              </dl>
            )}

            {!isGuest && props.showFamily ? (
              <div className="ticket-family">
                <div className="ticket-family-row">
                  <Field label={t.labels.father} value={student.father_name} lang={lang} />
                  <Field label={t.labels.mother} value={student.mother_name} lang={lang} />
                </div>
                <div className="ticket-guardians">
                  <span className="ticket-guardian-title">{t.notes.guardians.primary}</span>
                  {listed.length ? (
                    <ul className="ticket-guardian-list">
                      {listed.map((person) => (
                        <li key={`${person.name}-${person.relation}`}>
                          <strong>{person.name || t.notes.unnamed.primary}</strong>
                          {person.relation ? ` — ${person.relation}` : ""}
                          {person.contact ? ` · ${ticketValue(person.contact, lang)}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ticket-guardian-note">{t.notes.noGuardian.primary}</p>
                  )}
                  {spare.length ? (
                    <div className="ticket-blank">
                      {spare.map((label) => (
                        <span key={label.primary}>{label.primary} ____________________________</span>
                      ))}
                      <span>{t.notes.blankContact.primary} ________________</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="ticket-status-row">
              {isGuest ? (
                <span className={`ticket-pill ${revoked ? "is-unpaid" : "is-paid"}`}>{revoked ? t.status.revoked : t.status.activeGuest}</span>
              ) : (
                <span className={`ticket-pill ${paid ? "is-paid" : "is-unpaid"}`}>
                  {t.status.feeLabel.primary}: {paid ? t.status.paid : t.status.unpaid}
                </span>
              )}
              <span className={`ticket-pill ${props.admittedAt ? "is-admitted" : ""}`}>
                {props.admittedAt
                  ? `${t.status.admittedPrefix} ${ticketDate(props.admittedAt, lang, "short")}`
                  : t.status.notAdmitted}
              </span>
            </div>
          </div>

          <div className="ticket-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.qr} alt="" />
            <small>
              {t.notes.scanAtGate.primary}
              {t.notes.scanAtGate.secondary ? <em>{t.notes.scanAtGate.secondary}</em> : null}
            </small>
            <code>{ticketValue(props.ticketCode, lang)}</code>
          </div>
        </div>

        <footer className="ticket-foot">
          <span>
            {t.notes.validUntil.primary} {props.validUntil}
          </span>
          <span>
            {t.notes.issued.primary} {props.issuedAt}
          </span>
          <span>
            {t.notes.printedBy.primary} {props.printedBy}
          </span>
          <span>{t.notes.signature.primary}</span>
        </footer>
      </div>
    </section>
  );
}
