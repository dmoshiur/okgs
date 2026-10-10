/**
 * A6 portrait entry ticket (105 × 148 mm) — the GENESIS 2026 redesign.
 *
 * Layout contract (top → bottom, everything INSIDE the bordered frame):
 *   head   — school logo · "Omar Kindergarten School" over "Scholars
 *            Residential School" · Scholars logo
 *   title  — the Science Fair event name, large and bold
 *   photos — father photo + name · student/guest photo (large) · mother
 *            photo + name — followed by the student/guest full name
 *   grid   — Student ID · Roll · Class · Section · Shift · Group for a
 *            student; Guest ID · Tagged student · Contact · Status for an
 *            outside guest (tagged "GUEST ENTRY")
 *   bottom — signed QR on the left, Fair President's signature on the right
 *   foot   — "Valid until 31 December 2026" · "Issued <date>"
 *
 * Overflow contract: the sheet is exactly one A6 page on screen and in print
 * (`@page ticket-portrait { size: A6 portrait; margin: 0; }`). The bottom row
 * (QR + signature) is the only flexible member of the column, so it absorbs
 * whatever height remains and the QR can never spill over the footer.
 *
 * The very same component is set four-up on the A4 bulk sheet — the grid
 * print scales nothing and restyles nothing, it simply places four A6 sheets.
 *
 * Every word on the sheet comes from `ticketText(lang)` — see
 * lib/ticket-locale.ts. Branding constants (logos, signature, school names)
 * live in lib/ticket-brand.ts.
 */
import { optimizedImage } from "@/lib/cloudinary";
import { FAIR_PRESIDENT_SIGNATURE_URL, SCHOLARS_LOGO_URL, TICKET_SCHOOL_NAME, TICKET_SUB_HEADER } from "@/lib/ticket-brand";
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

/** Printable guest reference — the UUID shortened to a gate-friendly token. */
export function guestTicketId(id: string) {
  return id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "—";
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
      <dd>{ticketValue(value, lang) || "—"}</dd>
    </div>
  );
}

/** A 3:4 photo cell; shows initials when no picture is stored. */
function PhotoCell({ src, name, large, alt, optimized }: { src: string; name: string; large?: boolean; alt: string; optimized: string }) {
  return (
    <figure className={`ticket-photo-cell${large ? " is-large" : ""}`}>
      <span className="ticket-photo-frame">
        {optimized ? <img src={optimized} alt={alt} /> : <span className="ticket-photo-initial">{initialsOf(src || name || alt)}</span>}
      </span>
      {name ? <figcaption>{name}</figcaption> : null}
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

  // 3:4 crops, auto-format — the same sizes the single print has always used.
  const mainPhoto = optimizedImage(isGuest ? guest?.photo_url ?? "" : student.photo_url, { width: 600, height: 800, fit: "cover" });
  const fatherPhoto = optimizedImage(student.father_photo_url, { width: 300, height: 400, fit: "cover" });
  const motherPhoto = optimizedImage(student.mother_photo_url, { width: 300, height: 400, fit: "cover" });

  return (
    <section
      className={`ticket-sheet printable-ticket ${isGuest ? "is-guest" : ""}`}
      data-lang={lang}
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

        <h2 className="ticket-title">{ticketValue(props.fairName, lang)}</h2>

        {isGuest ? <div className="ticket-guest-tag">{t.titles.guestEntry.primary}</div> : null}

        <div className={`ticket-photos${isGuest ? " is-single" : ""}`}>
          {isGuest ? (
            <PhotoCell src={guest?.photo_url ?? ""} name="" large alt={headline} optimized={mainPhoto} />
          ) : (
            <>
              <PhotoCell src={student.father_photo_url} name={student.father_name} alt={`Father of ${student.name}`} optimized={fatherPhoto} />
              <PhotoCell src={student.photo_url} name="" large alt={student.name} optimized={mainPhoto} />
              <PhotoCell src={student.mother_photo_url} name={student.mother_name} alt={`Mother of ${student.name}`} optimized={motherPhoto} />
            </>
          )}
        </div>

        <h3 className="ticket-name">{headline || "—"}</h3>

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
