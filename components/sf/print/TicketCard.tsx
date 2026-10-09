/**
 * One compact ticket for the bulk A4 sheet (4 per page, 2 × 2).
 *
 * Same signed QR, same photo rule and the same single-language word list as the
 * full landscape sheet — only the scale changes, so a gate warden reads a bulk
 * ticket exactly like a single one.
 *
 * Every word comes from `ticketText(lang)`; there is no hard-coded copy here.
 */
import { optimizedImage } from "@/lib/cloudinary";
import { ticketNumber, ticketText, ticketValue, type TicketLabel, type TicketLang } from "@/lib/ticket-locale";

export interface BulkTicketStudent {
  id: string;
  name: string;
  student_code: string;
  roll: string;
  class_name: string;
  section: string;
  shift: string;
  photo_url: string;
}

export interface TicketCardProps {
  schoolName: string;
  fairName: string;
  logo: string;
  lang: TicketLang;
  student: BulkTicketStudent;
  /** Signed QR data URL for this student — produced on the server. */
  qr: string;
  ticketCode: string;
  validUntil: string;
  /** "1 / 4" — where this card sits on its page. */
  slot: string;
}

function initialsOf(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?";
}

function Field({ label, value, lang }: { label: TicketLabel; value: string; lang: TicketLang }) {
  return (
    <div className="ticket-card-field">
      <dt>
        {label.primary}
        {label.secondary ? <em>{label.secondary}</em> : null}
      </dt>
      <dd>{ticketNumber(value, lang) || "—"}</dd>
    </div>
  );
}

export function TicketCard(props: TicketCardProps) {
  const { student } = props;
  const lang = props.lang;
  const t = ticketText(lang);
  // `f_auto,q_auto,w_300,h_400,c_fill` — the exact 3:4 crop the card shows.
  const photo = optimizedImage(student.photo_url, { width: 300, height: 400, fit: "cover" });

  return (
    <article className="ticket-card" data-lang={lang} aria-label={`${student.name} · ${student.student_code}`}>
      <header className="ticket-card-head">
        <div className="ticket-card-school">
          {props.logo ? <img src={props.logo} alt="" className="ticket-card-logo" /> : <span className="ticket-card-logo is-fallback">{initialsOf(props.schoolName)}</span>}
          <div className="ticket-card-school-copy">
            <strong>{ticketValue(props.schoolName, lang)}</strong>
            <small>{ticketValue(props.fairName, lang)}</small>
          </div>
        </div>
        <span className="ticket-card-kind">
          {t.titles.studentTicket.primary}
          {t.titles.studentTicket.secondary ? <i>{t.titles.studentTicket.secondary}</i> : null}
        </span>
      </header>

      <div className="ticket-card-body">
        <figure className="ticket-card-photo">
          {photo ? <img src={photo} alt="" /> : <span>{initialsOf(student.name)}</span>}
        </figure>

        <div className="ticket-card-info">
          <h3 className="ticket-card-name">{student.name || "—"}</h3>
          <dl className="ticket-card-grid">
            <Field label={t.labels.studentId} value={student.student_code} lang={lang} />
            <Field label={t.labels.roll} value={student.roll} lang={lang} />
            <Field label={t.labels.className} value={student.class_name} lang={lang} />
            <Field label={t.labels.section} value={student.section} lang={lang} />
            <Field label={t.labels.shift} value={student.shift} lang={lang} />
          </dl>
          <span className={`ticket-card-badge ${"is-paid"}`}>
            {t.status.feeLabel.primary}: {t.status.paid}
          </span>
        </div>

        <div className="ticket-card-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.qr} alt="" />
          <small>
            {t.notes.scanAtGate.primary}
            {t.notes.scanAtGate.secondary ? <em>{t.notes.scanAtGate.secondary}</em> : null}
          </small>
        </div>
      </div>

      <footer className="ticket-card-foot">
        <code>{ticketValue(props.ticketCode, lang)}</code>
        <span>
          {t.notes.validUntil.primary} {props.validUntil}
        </span>
        <span className="ticket-card-slot">{props.slot}</span>
      </footer>
    </article>
  );
}
