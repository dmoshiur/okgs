/** Safe 95 × 137mm ticket on A6 paper, or the identical card four-up on A4.
 * Father / holder / mother photos, full names, live-signed QR and signature.
 * Physical page margins are in CSS. QR size never shrinks; long text is fitted
 * (without truncating the source) by the shared print-readiness helper.
 */
import { optimizedImage } from "@/lib/cloudinary";
import { FAIR_PRESIDENT_SIGNATURE_URL, SCHOLARS_LOGO_URL, TICKET_SCHOOL_NAME, TICKET_SUB_HEADER } from "@/lib/ticket-brand";
import { guestTicketId } from "@/lib/ticket-identifiers";
export { guestTicketId } from "@/lib/ticket-identifiers";
import { ticketText, ticketValue, type TicketLabel, type TicketLang } from "@/lib/ticket-locale";

export interface TicketStudent {
  name: string;
  student_code: string;
  roll: string;
  class_name: string;
  section: string;
  shift: string;
  student_group: string;
  father_name: string;
  mother_name: string;
  photo_url: string;
  father_photo_url: string;
  mother_photo_url: string;
}

export interface TicketGuestInfo {
  id: string;
  name: string;
  relation: string;
  contact: string;
  status: string;
  photo_url: string;
}

export interface TicketSheetProps {
  kind: "student" | "guest";
  schoolName: string;
  fairName: string;
  /** Left logo — the school crest from site settings. */
  logo: string;
  /** Right logo — Scholars Residential School (brand constant by default). */
  secondaryLogo?: string;
  /** President's signature image (brand constant by default). */
  signatureUrl?: string;
  /** `en` (default), `bn` or `both` — every label on the sheet follows it. */
  lang?: TicketLang;
  student: TicketStudent;
  guest?: TicketGuestInfo | null;
  qr: string;
  /** Already formatted for the sheet's language ("31 December 2026"). */
  validUntil: string;
  issuedAt: string;
}

function initialsOf(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?";
}

/**
 * One `Label / value` pair. In bilingual mode the English sits under the
 * Bangla. Values are printed as-is (IDs never get thousands separators —
 * `ticketValue` only rewrites digits on a Bangla sheet).
 */
function Field({ label, value, lang }: { label: TicketLabel; value: string; lang: TicketLang }) {
  return (
    <div className="ticket-field">
      <dt>
        {label.primary}
        {label.secondary ? <em>{label.secondary}</em> : null}
      </dt>
      <dd className="ticket-fit-text" data-fit-min="8">{ticketValue(value, lang) || "—"}</dd>
    </div>
  );
}

/** A 3:4 photo cell; shows initials when no picture is stored. */
function PhotoCell({ src, name, large, alt, optimized }: { src: string; name: string; large?: boolean; alt: string; optimized: string }) {
  return (
    <figure className={`ticket-photo-cell${large ? " is-large" : ""}`}>
      <span className="ticket-photo-frame">
        {optimized ? <img src={optimized} alt={alt} loading="eager" decoding="async" /> : <span className="ticket-photo-initial">{initialsOf(src || name || alt)}</span>}
      </span>
      {name ? <figcaption className="ticket-fit-text" data-fit-min="7">{name}</figcaption> : null}
    </figure>
  );
}

export function TicketSheet(props: TicketSheetProps) {
  const { student, guest } = props;
  const lang = props.lang ?? "en";
  const t = ticketText(lang);
  // The redesign pins the printed institution name — the site setting only
  // feeds toolbars and hints, never the paper.
  const schoolName = TICKET_SCHOOL_NAME;
  const isGuest = props.kind === "guest";
  const headline = isGuest ? guest?.name ?? "" : student.name;
  const secondaryLogo = props.secondaryLogo ?? SCHOLARS_LOGO_URL;
  const signatureUrl = props.signatureUrl ?? FAIR_PRESIDENT_SIGNATURE_URL;

  // Print-quality 3:4 crops (~350 DPI), without downloading full-size portraits for 500+ cards.
  const mainPhoto = optimizedImage(isGuest ? guest?.photo_url ?? "" : student.photo_url, { width: 320, height: 427, fit: "cover" });
  const fatherPhoto = optimizedImage(student.father_photo_url, { width: 240, height: 320, fit: "cover" });
  const motherPhoto = optimizedImage(student.mother_photo_url, { width: 240, height: 320, fit: "cover" });

  return (
    <section
      className={`ticket-sheet printable-ticket ${isGuest ? "is-guest" : ""}`}
      data-lang={lang}
      data-ticket-id={isGuest ? guest?.id : student.student_code}
      aria-label={`${isGuest ? "Guest entry ticket" : "Student ticket"} — ${headline || "unnamed"}`}
    >
      <div className="ticket-frame">
        <header className="ticket-head">
          {props.logo ? (
            <img src={props.logo} alt="" className="ticket-logo" />
          ) : (
            <span className="ticket-logo ticket-logo-fallback">{initialsOf(schoolName)}</span>
          )}
          <div className="ticket-school-copy">
            <strong>{schoolName}</strong>
            <small>{TICKET_SUB_HEADER}</small>
          </div>
          {secondaryLogo ? (
            <img src={secondaryLogo} alt="" className="ticket-logo ticket-logo-right" />
          ) : (
            <span className="ticket-logo ticket-logo-fallback">SR</span>
          )}
        </header>

        <h2 className="ticket-title ticket-fit-text" data-fit-min="11">{ticketValue(props.fairName, lang)}</h2>

        {isGuest ? <div className="ticket-guest-tag">{t.titles.guestEntry.primary}</div> : null}

        <div className="ticket-photos">
          <PhotoCell src={student.father_photo_url} name={student.father_name} alt={`Father of ${student.name}`} optimized={fatherPhoto} />
          <PhotoCell src={isGuest ? guest?.photo_url ?? "" : student.photo_url} name="" large alt={headline} optimized={mainPhoto} />
          <PhotoCell src={student.mother_photo_url} name={student.mother_name} alt={`Mother of ${student.name}`} optimized={motherPhoto} />
        </div>

        <h3 className="ticket-name ticket-fit-text" data-fit-min="10">{headline || "—"}</h3>

        {isGuest ? (
          <dl className="ticket-grid">
            <Field label={t.labels.guestId} value={guest ? guestTicketId(guest.id) : ""} lang={lang} />
            <Field label={t.labels.taggedStudent} value={student.name} lang={lang} />
            <Field label={t.labels.contact} value={guest?.contact ?? ""} lang={lang} />
            <Field label={t.labels.status} value={guest?.status === "revoked" ? t.status.revoked : t.status.activeGuest} lang={lang} />
            <Field label={t.labels.studentId} value={student.student_code} lang={lang} />
            <Field label={t.labels.className} value={student.class_name} lang={lang} />
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

        <div className="ticket-bottom">
          <div className="ticket-qr">
            <div className="ticket-qr-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.qr} alt="" />
            </div>
          </div>
          <div className="ticket-signature">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signatureUrl} alt="" className="ticket-signature-img" />
            <span className="ticket-signature-rule" aria-hidden="true" />
            <span className="ticket-signature-caption">
              {t.titles.fairPresident.primary}
              {t.titles.fairPresident.secondary ? <em>{t.titles.fairPresident.secondary}</em> : null}
            </span>
          </div>
        </div>

        <footer className="ticket-foot">
          <span>
            {t.notes.validUntil.primary} {props.validUntil}
          </span>
          <span>
            {t.notes.issued.primary} {props.issuedAt}
          </span>
        </footer>
      </div>
    </section>
  );
}
