/**
 * Image URLs stored by the content editor.
 *
 * Public assets checked into `/public` are intentionally represented by
 * same-origin paths (for example `/media/club-science.svg`). Remote images must
 * use HTTPS; in particular, a Cloudinary upload is only accepted when it gives
 * us a secure delivery URL.
 */
export type ImageUrlCheck =
  | { valid: true; value: string }
  | { valid: false; message: string };

const LOCAL_ORIGIN = "https://okgs-image-path.invalid";

function isSafeLocalImagePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(value)) return false;
  try {
    const parsed = new URL(value, LOCAL_ORIGIN);
    return parsed.origin === LOCAL_ORIGIN && parsed.pathname !== "/";
  } catch {
    return false;
  }
}

/**
 * Validate and canonicalise one image URL. Empty values are valid because club
 * logos, card art and covers are optional. Local public assets are supported for
 * existing seeded content; every external URL must be a syntactically valid
 * HTTPS URL.
 */
export function checkImageUrl(input: unknown): ImageUrlCheck {
  const value = String(input ?? "").trim();
  if (!value) return { valid: true, value: "" };
  if (isSafeLocalImagePath(value)) return { valid: true, value };

  if (!/^https:\/\//i.test(value)) {
    return {
      valid: false,
      message: "Use a full https:// image URL or a same-site image path.",
    };
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
      throw new Error("invalid image URL");
    }
    return { valid: true, value: parsed.href };
  } catch {
    return {
      valid: false,
      message: "Enter a valid https:// image URL or a same-site image path.",
    };
  }
}

/** Only trust an HTTPS URL delivered by Cloudinary's image API. */
export function secureCloudinaryUrl(input: unknown): string | null {
  const checked = checkImageUrl(input);
  if (!checked.valid || !checked.value) return null;
  try {
    const parsed = new URL(checked.value);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "res.cloudinary.com"
      ? checked.value
      : null;
  } catch {
    return null;
  }
}
