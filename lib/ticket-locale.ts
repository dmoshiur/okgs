/**
 * Every word printed on a ticket lives here — and only here.
 *
 * A ticket used to mix languages: English field labels above Bangla names, a
 * Bangla footer under an English heading. The gate warden reading it and the
 * parent keeping it got two different documents. This module is the single
 * dictionary behind the ticket, so a sheet is **always** one language:
 *
 *   `en`   — every label, heading, badge and footer note in English.
 *   `bn`   — every label, heading, badge and footer note in Bangla
 *            (Bangla digits for roll, ID, dates and copy numbers too).
 *   `both` — Bangla first with the English wording under it, on *every* field.
 *            Bilingual, but consistent: no field is ever half-translated.
 *
 * Components never hard-code ticket copy; they ask `ticketText(lang)` and render
 * whatever comes back, which is what keeps the three modes from drifting apart.
 */
import { bn, en, formatDate, formatDateEn } from "@/lib/format";
import { toBanglaDigits } from "@/lib/digits";

export const TICKET_LANGS = ["en", "bn", "both"] as const;
export type TicketLang = (typeof TICKET_LANGS)[number];

/** Accepts `?lang=bn`, `?lang=BN`, `?lang=bangla` … anything else falls back. */
export function parseTicketLang(value: unknown, fallback: TicketLang = "en"): TicketLang {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "bn" || raw === "bangla" || raw === "বাংলা") return "bn";
  if (raw === "both" || raw === "bilingual" || raw === "bn+en") return "both";
  if (raw === "en" || raw === "english") return "en";
  return fallback;
}

/** `?lang=` names the mode; the print URL is the state, nothing is stored locally. */
export function ticketLangParam(lang: TicketLang) {
  return lang === "en" ? "" : lang;
}

/** The three modes the toolbar offers, with the wording printed on the button. */
export const ticketLangOptions: { id: TicketLang; label: string; hint: string }[] = [
  { id: "en", label: "English", hint: "Every label, badge and footer note in English." },
  { id: "bn", label: "বাংলা", hint: "সব লেবেল, ব্যাজ ও ফুটার নোট বাংলায় — সংখ্যাও বাংলায়।" },
  { id: "both", label: "বাংলা + English", hint: "Bangla first with the English wording under it, on every field." },
];

/** One label as it is printed: the wording, plus the second line for `both`. */
export interface TicketLabel {
  primary: string;
  /** English wording shown under the Bangla one — empty unless lang is "both". */
  secondary: string;
}

function label(enText: string, bnText: string, lang: TicketLang): TicketLabel {
  if (lang === "en") return { primary: enText, secondary: "" };
  if (lang === "bn") return { primary: bnText, secondary: "" };
  return { primary: bnText, secondary: enText };
}

export interface TicketStrings {
  lang: TicketLang;
  /** True when Bangla digits and Bangla dates are used. */
  bangla: boolean;
  labels: {
    studentId: TicketLabel;
    roll: TicketLabel;
    className: TicketLabel;
    section: TicketLabel;
    shift: TicketLabel;
    group: TicketLabel;
    branch: TicketLabel;
    father: TicketLabel;
    mother: TicketLabel;
    relation: TicketLabel;
    contact: TicketLabel;
    visitingStudent: TicketLabel;
    photo: TicketLabel;
  };
  titles: {
    studentTicket: TicketLabel;
    guestPass: TicketLabel;
    /** "Student copy" / "Parent copy" / "School copy". */
    copies: TicketLabel[];
    guestCopy: TicketLabel;
    copyOf: (index: number, total: number) => string;
  };
  status: {
    feeLabel: TicketLabel;
    paid: string;
    unpaid: string;
    admittedPrefix: string;
    notAdmitted: string;
    activeGuest: string;
    revoked: string;
  };
  notes: {
    scanAtGate: TicketLabel;
    validUntil: TicketLabel;
    issued: TicketLabel;
    printedBy: TicketLabel;
    signature: TicketLabel;
    guardians: TicketLabel;
    noGuardian: TicketLabel;
    blankName: TicketLabel;
    blankRelation: TicketLabel;
    blankContact: TicketLabel;
    paidOnly: TicketLabel;
    unnamed: TicketLabel;
    /** Placeholder for a free slot on the last A4 page. */
    emptySlot: TicketLabel;
  };
}

/** The complete word list for one ticket, in one language. */
export function ticketText(lang: TicketLang = "en"): TicketStrings {
  const at = (enText: string, bnText: string) => label(enText, bnText, lang);
  const number = (value: number) => (lang === "en" ? en(value) : bn(value));
  return {
    lang,
    bangla: lang !== "en",
    labels: {
      studentId: at("Student ID", "শিক্ষার্থী আইডি"),
      roll: at("Roll", "রোল"),
      className: at("Class", "শ্রেণি"),
      section: at("Section", "শাখা"),
      shift: at("Shift", "শিফট"),
      group: at("Group", "গ্রুপ"),
      branch: at("Branch", "বিভাগ"),
      father: at("Father's name", "পিতার নাম"),
      mother: at("Mother's name", "মাতার নাম"),
      relation: at("Relation", "সম্পর্ক"),
      contact: at("Contact", "যোগাযোগ"),
      visitingStudent: at("Visiting student", "যে শিক্ষার্থীর সাথে"),
      photo: at("Photo", "ছবি"),
    },
    titles: {
      studentTicket: at("Student entry ticket", "শিক্ষার্থী প্রবেশ টিকিট"),
      guestPass: at("Outside guest pass", "বহিরাগত অতিথি পাস"),
      copies: [at("Student copy", "শিক্ষার্থী কপি"), at("Parent copy", "অভিভাবক কপি"), at("School copy", "বিদ্যালয় কপি")],
      guestCopy: at("Guest copy", "অতিথি কপি"),
      copyOf: (index, total) =>
        lang === "en" ? `Copy ${number(index)} of ${number(total)}` : `কপি ${number(index)} / ${number(total)}`,
    },
    status: {
      feeLabel: at("Fee", "ফি"),
      paid: lang === "en" ? "Paid" : "পরিশোধিত",
      unpaid: lang === "en" ? "Due" : "বকেয়া",
      admittedPrefix: lang === "en" ? "Admitted" : "প্রবেশ",
      notAdmitted: lang === "en" ? "Not yet admitted" : "এখনো প্রবেশ করেনি",
      activeGuest: lang === "en" ? "Active guest" : "সক্রিয় অতিথি",
      revoked: lang === "en" ? "Revoked" : "বাতিল",
    },
    notes: {
      scanAtGate: at("Scan at the gate", "গেটে স্ক্যান করুন"),
      validUntil: at("Valid until", "মেয়াদ"),
      issued: at("Issued", "ইস্যু"),
      printedBy: at("Printed by", "প্রিন্ট করেছেন"),
      signature: at("QR signed with HMAC-SHA256 · tamper-evident", "কিউআর কোড HMAC-SHA256 স্বাক্ষরিত · নকল প্রতিরোধী"),
      guardians: at(
        "External guardians admitted with this student (Mama / Fufa / Chacha / guest)",
        "এই শিক্ষার্থীর সাথে অনুমোদিত বহিরাগত অভিভাবক (মামা / ফুফা / চাচা / অতিথি)",
      ),
      noGuardian: at(
        "No outside guardian is registered for this student. The pass below is only valid at the gate once the school office has approved it.",
        "এই শিক্ষার্থীর জন্য কোনো বহিরাগত অভিভাবক নিবন্ধিত নেই। অফিস থেকে অনুমোদনের পরই পাসটি গেটে গ্রহণযোগ্য হবে।",
      ),
      blankName: at("Name", "নাম"),
      blankRelation: at("Relation", "সম্পর্ক"),
      blankContact: at("Contact", "যোগাযোগ"),
      paidOnly: at("Only students whose fee is PAID are printed.", "যাদের ফি পরিশোধিত কেবল তাদের টিকিট ছাপা হয়।"),
      unnamed: at("Unnamed", "নামবিহীন"),
      emptySlot: at("No ticket", "টিকিট নেই"),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Values. Labels are translated; the data itself is only re-written in
 * Bangla digits when the sheet is Bangla, so a Bangla ticket does not
 * carry Latin numerals next to Bangla words.
 * ------------------------------------------------------------------ */

/** Roll, ID and counts — Bangla digits on a Bangla sheet, Latin on English. */
export function ticketNumber(value: unknown, lang: TicketLang = "en") {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const numeric = Number(text);
  if (lang === "en") return Number.isFinite(numeric) && text !== "" && /^-?\d+(\.\d+)?$/.test(text) ? en(numeric) : text;
  return toBanglaDigits(Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(text) ? en(numeric) : text);
}

/** Free text (a name, a note) — only its digits change with the language. */
export function ticketValue(value: unknown, lang: TicketLang = "en") {
  const text = String(value ?? "").trim();
  return lang === "en" ? text : toBanglaDigits(text);
}

/** Dates: `8 October 2026` or `৮ অক্টোবর ২০২৬`. */
export function ticketDate(value: unknown, lang: TicketLang = "en", style: "long" | "short" = "long") {
  if (!value) return "";
  return lang === "en" ? formatDateEn(value, style) : formatDate(value, style);
}
