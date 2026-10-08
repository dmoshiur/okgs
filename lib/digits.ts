/**
 * Bengali (Bangla) digits are a real part of school data: an office sheet keyed
 * by hand carries রোল `৮` and a phone `০১৭১২৩৪৫৬৭৮`. Names must stay exactly as
 * written, but any field we calculate with (roll, SL, phone) has to be ASCII
 * first, otherwise `8-12` range matching and payment filters miss every row.
 */
const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";
const ASCII_DIGITS = "0123456789";
const DEVANAGARI_DIGITS = "०१२३४५६७८९";

export function toLatinDigits(value: unknown) {
  const text = String(value ?? "");
  let out = "";
  for (const char of text) {
    const bangla = BANGLA_DIGITS.indexOf(char);
    if (bangla >= 0) {
      out += ASCII_DIGITS[bangla];
      continue;
    }
    const deva = DEVANAGARI_DIGITS.indexOf(char);
    if (deva >= 0) {
      out += ASCII_DIGITS[deva];
      continue;
    }
    out += char;
  }
  return out;
}

/** `true` when the value contains Bengali letters — used to keep them untouched. */
export function hasBengali(value: unknown) {
  return /[\u0980-\u09ff]/.test(String(value ?? ""));
}
