/** Canonical phone form used only for login, never to establish roster ownership. */
export function normalizePhone(value: string) {
  const digits = value.trim().replace(/[\s()+.-]/g, "");
  if (!/^\d{7,15}$/.test(digits)) return "";
  if (/^01\d{9}$/.test(digits)) return `88${digits}`;
  if (/^008801\d{9}$/.test(digits)) return digits.slice(2);
  return digits;
}

/** Shared throttle key across both login endpoints and phone spellings. */
export function loginIdentifierKey(value: string) {
  return normalizePhone(value) || value.trim().toLowerCase();
}
