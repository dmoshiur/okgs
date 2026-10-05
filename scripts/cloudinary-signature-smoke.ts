/**
 * Cloudinary signature smoke test — no network, no browser, no credentials.
 *
 * Reproduces the 401 "Invalid Signature" class of bug end to end:
 *   1. the server (`mediaUploadTicket`) signs an upload,
 *   2. the browser (`buildUploadForm`) turns that ticket into the multipart body,
 *   3. an independent implementation of Cloudinary's documented algorithm
 *      re-computes the signature from the *posted* fields and compares.
 *
 * Any parameter the browser adds that the server did not sign (the original bug:
 * a client-side `tags` value) makes step 3 fail here instead of in production.
 *
 * Run: `npx tsx scripts/cloudinary-signature-smoke.ts`
 */
import { createHash } from "node:crypto";
import { mediaUploadTicket, signedUpload, type CloudinaryServerSettings } from "../lib/cloudinary";
import { buildUploadForm, signedUploadParams, type UploadTicket } from "../lib/upload-client";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
};

const server: CloudinaryServerSettings = {
  enabled: true,
  cloudName: "okgs-demo",
  apiKey: "123456789012345",
  apiSecret: "s3cr3t-api-secret",
  folder: "okgs/clubs",
  maxBytes: 12 * 1024 * 1024,
  signatureAlgorithm: "sha1",
};
const legacy = { enabled: false, cloudName: server.cloudName, uploadPreset: "", folder: "okgs" };

/** Fields Cloudinary itself adds or ignores — never part of the signed string. */
const NEVER_SIGNED = new Set(["file", "api_key", "signature", "cloud_name", "resource_type"]);

/** The documented algorithm, written out independently of lib/cloudinary.ts. */
function referenceSignature(fields: Record<string, string>, secret: string, algorithm: "sha1" | "sha256" = "sha1") {
  const toSign = Object.entries(fields)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash(algorithm).update(`${toSign}${secret}`).digest("hex");
}

/** What actually hits Cloudinary: every FormData field except the file itself. */
function postedFields(form: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key !== "file") fields[key] = String(value);
  }
  return fields;
}

function signableFields(posted: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(posted).filter(([key]) => !NEVER_SIGNED.has(key)));
}

const png = new File([Buffer.from("fake-image-bytes")], "school-logo.png", { type: "image/png" });

/* ---- 1. signed upload: the posted payload verifies ---------------------- */
{
  // Exactly what ImageField asks for: club page → prefix + tags + title.
  const ticket = mediaUploadTicket({
    server,
    legacy,
    clubSlug: "alssm",
    folder: "branding",
    label: "ওকেজিএস লোগো",
    fileName: png.name,
    tags: ["okgs", "branding"],
  });

  check("server: API key + secret selects signed mode", ticket.mode === "signed");
  if (ticket.mode !== "signed") throw new Error("expected a signed ticket");

  check("server: params carry timestamp, folder, public_id and tags",
    Boolean(ticket.params.timestamp && ticket.params.folder && ticket.params.public_id && ticket.params.tags));
  check("server: account folder + club slug scope the folder", ticket.params.folder === "okgs/clubs/alssm/branding");
  check("server: client tags are folded into the signed params", ticket.params.tags === "alssm,okgs,branding");
  check("server: public object never carries the API secret", !JSON.stringify(ticket).includes(server.apiSecret));

  const { mode, form } = buildUploadForm({ file: png, ticket: ticket as UploadTicket, prefix: "branding", tags: ["okgs", "branding"] });
  const posted = postedFields(form);

  check("client: signed mode posts file + api_key + signature", mode === "signed" && posted.api_key === server.apiKey && Boolean(posted.signature));
  check("client: posts exactly the signed parameters, nothing extra",
    Object.entries(signedUploadParams(ticket as UploadTicket)).every(([key, value]) => posted[key] === value) &&
      Object.keys(signableFields(posted)).length === Object.keys(ticket.params).length);
  check("client: never posts an empty parameter", Object.values(posted).every((value) => value !== ""));

  const expected = referenceSignature(signableFields(posted), server.apiSecret);
  check("verify: signature over the posted fields matches the server signature", expected === posted.signature);
  // Alphabetical order (`folder` before `timestamp`) and the secret appended
  // with no separator — the two rules a hand-rolled signer usually gets wrong.
  check("verify: signature string is alphabetical + secret appended with no separator",
    referenceSignature({ timestamp: "1", folder: "a" }, "s", "sha1") ===
      createHash("sha1").update("folder=a&timestamp=1s").digest("hex"));
}

/* ---- 2. Regression: an unsigned extra field must be detected ------------ */
{
  // The old client appended `tags` to a payload the server had signed without
  // them — Cloudinary answered 401. This guards the verifier itself.
  const ticket = signedUpload(server, { folder: "", publicId: "", tags: [] });
  const posted = { ...ticket.params, tags: "okgs,branding", api_key: server.apiKey, signature: ticket.signature };
  check("regression: an extra unsigned field fails verification",
    referenceSignature(signableFields(posted), server.apiSecret) !== ticket.signature);
  check("regression: empty optional params are dropped, only the account folder stays",
    ticket.params.folder === "okgs/clubs" && !("public_id" in ticket.params) && !("tags" in ticket.params));
}

/* ---- 3. Club containment ------------------------------------------------ */
{
  const escape = mediaUploadTicket({ server, legacy, clubSlug: "alssm", folder: "artds/gallery", label: "x" });
  check("scope: a club admin cannot escape its own folder", escape.mode === "signed" && escape.params.folder === "okgs/clubs/alssm/artds/gallery");
  const staff = mediaUploadTicket({ server, legacy, folder: "branding/./../../etc", label: "x" });
  check("scope: staff folders are normalised and dot segments dropped",
    staff.mode === "signed" && staff.params.folder === "okgs/clubs/branding/etc");
}

/* ---- 4. SHA-256 accounts ------------------------------------------------ */
{
  const sha256 = mediaUploadTicket({
    server: { ...server, signatureAlgorithm: "sha256" },
    legacy,
    clubSlug: "alssm",
    folder: "branding",
    label: "Logo",
    tags: ["okgs"],
  });
  if (sha256.mode !== "signed") throw new Error("expected a signed ticket");
  const { form } = buildUploadForm({ file: png, ticket: sha256 as UploadTicket, prefix: "branding" });
  check("sha256: signature hashes the same string with SHA-256",
    postedFields(form).signature === referenceSignature(signableFields(postedFields(form)), server.apiSecret, "sha256"));
  check("sha256: digest is 64 hex chars (not a SHA-1 40)", /^[0-9a-f]{64}$/.test(sha256.signature));
}

/* ---- 5. Legacy unsigned fallback still works ---------------------------- */
{
  const ticket = mediaUploadTicket({ server: { ...server, enabled: false }, legacy: { ...legacy, enabled: true, uploadPreset: "okgs-unsigned" } });
  check("unsigned: no API secret → preset fallback", ticket.mode === "unsigned" && ticket.uploadPreset === "okgs-unsigned");
  const { mode, form } = buildUploadForm({
    file: png,
    ticket: ticket as UploadTicket,
    prefix: "alssm",
    config: { enabled: true, cloudName: server.cloudName, uploadPreset: "okgs-unsigned", folder: "okgs/clubs", endpoint: `https://api.cloudinary.com/v1_1/${server.cloudName}/image/upload`, maxBytes: server.maxBytes },
  });
  check("unsigned: posts upload_preset + folder and no signature",
    mode === "unsigned" && form.get("upload_preset") === "okgs-unsigned" && form.get("folder") === "okgs/clubs/alssm" && form.get("signature") === null);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll Cloudinary signature checks passed.");
process.exit(failures ? 1 : 0);
