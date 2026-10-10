/** Normalize a camera/manual QR value without navigating to or fetching a URL. */
export function extractScanValue(raw: string) {
  const value = String(raw ?? "").trim();
  if (!value || value.length > 2048) return value;
  if (/^(https?:\/\/|\/)/i.test(value)) {
    try {
      const url = new URL(value, "https://scanner.invalid");
      const token = url.searchParams.get("token");
      if (token) return token.trim();
      const match = /^\/(?:pass|ticket|entry)\/([^/]+)\/?$/.exec(url.pathname);
      if (match) return decodeURIComponent(match[1]).trim();
    } catch {
      // Malformed/percent-encoded data is a denied scan, not a client crash.
    }
  }
  return value;
}

/** Format detection only; every signature and entitlement is verified on the server. */
export function isTicketQr(raw: string) {
  return /^[A-Za-z0-9_-]{10,600}\.[A-Za-z0-9_-]{32}$/.test(extractScanValue(raw));
}

export function isScanQr(raw: string) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{24,32}$/.test(extractScanValue(raw));
}
