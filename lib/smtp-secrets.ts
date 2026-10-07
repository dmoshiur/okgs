import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function configKey() {
  const value = process.env.SMTP_CONFIG_SECRET || process.env.SESSION_SECRET;
  if (!value || /replace[-_ ]with/i.test(value) || value.length < 32) {
    throw new Error("SMTP_CONFIG_SECRET_OR_SESSION_SECRET_REQUIRED");
  }
  return createHash("sha256").update(value, "utf8").digest();
}

/** Encrypt SMTP passwords at rest with AES-256-GCM. */
export function encryptSmtpPassword(value: string) {
  if (!value) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", configKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSmtpPassword(value: string) {
  if (!value) return "";
  const [version, ivPart, tagPart, dataPart] = value.split(":");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) throw new Error("SMTP_SECRET_FORMAT_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", configKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}
