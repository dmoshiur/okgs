import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkImageUrl, secureCloudinaryUrl } from "../lib/image-url";
import { prepareClubImagePayload } from "../lib/club-image-validation";
import { validatePayload } from "../app/api/admin/[resource]/route";

const validHttps = checkImageUrl("  https://images.example.org/clubs/math.png  ");
assert.equal(validHttps.valid, true, "a trimmed, complete HTTPS image URL is accepted");
if (validHttps.valid) assert.equal(validHttps.value, "https://images.example.org/clubs/math.png");
assert.equal(checkImageUrl("/media/club-science.svg").valid, true, "existing same-site image assets stay editable");
assert.equal(checkImageUrl("//images.example.org/club.png").valid, false, "protocol-relative URLs are not accepted");
assert.equal(checkImageUrl("http://images.example.org/club.png").valid, false, "remote images must use HTTPS");
assert.equal(checkImageUrl("https://").valid, false, "an HTTPS prefix without a host is not a valid URL");
assert.equal(checkImageUrl("javascript:alert(1)").valid, false, "non-HTTPS schemes are rejected");
const validClubImages = {
  name: "Example club",
  slug: "example-club",
  logo_url: "/media/club-science.svg",
  image_url: "https://images.example.org/clubs/card.png",
  cover_image_url: "",
};
assert.equal(validatePayload("clubs", validClubImages), null, "the backend accepts HTTPS URLs, local assets and empty optional club images");
assert.equal(validatePayload("clubs", { ...validClubImages, image_url: "http://images.example.org/card.png" })?.status, 422, "the backend rejects insecure manually-entered image URLs");
assert.equal(secureCloudinaryUrl("https://res.cloudinary.com/demo/image/upload/logo.png"), "https://res.cloudinary.com/demo/image/upload/logo.png");
assert.equal(secureCloudinaryUrl("http://res.cloudinary.com/demo/image/upload/logo.png"), null, "Cloudinary upload results must be secure");
assert.equal(secureCloudinaryUrl("https://images.example.org/logo.png"), null, "the upload response must come from Cloudinary");

const updated = prepareClubImagePayload({
  name: "Updated club",
  logo_url: "/media/club-science.svg",
  image_url: "not-a-url",
  cover_image_url: "",
}, "update");
assert.equal(updated.payload.name, "Updated club", "non-image updates are kept");
assert.equal(updated.payload.logo_url, "/media/club-science.svg", "legacy local club assets remain unchanged");
assert.equal(updated.payload.cover_image_url, "", "empty optional images can be intentionally cleared");
assert.equal("image_url" in updated.payload, false, "an invalid edit is omitted so the current saved image is preserved");
assert.ok(updated.warnings.image_url, "the invalid field receives an inline-friendly warning");

const created = prepareClubImagePayload({ name: "New club", image_url: "http://images.example.org/card.png" }, "create");
assert.equal(created.payload.image_url, "", "an invalid optional image does not block a new club");
assert.ok(created.warnings.image_url, "the create path reports that the invalid image was skipped");

const imageField = readFileSync(new URL("../components/admin/ImageField.tsx", import.meta.url), "utf8");
assert.match(imageField, /secureCloudinaryUrl\(result\.url\)/, "the upload component injects only a secure Cloudinary URL");
assert.match(imageField, /type="text"\s+inputMode="url"/, "manual URL entry uses inline validation rather than native form blocking");
assert.match(imageField, /imageUrlWarning/, "invalid pasted image links have an inline warning");

const adminStudio = readFileSync(new URL("../components/admin/AdminStudio.tsx", import.meta.url), "utf8");
assert.match(adminStudio, /prepareClubImagePayload\(form, mode === "edit" \? "update" : "create"\)/, "club form saves other fields when an optional image URL is invalid");
assert.match(adminStudio, /Invalid image link\(s\) were ignored/, "successful saves explain skipped images");

const adminRoute = readFileSync(new URL("../app/api/admin/[resource]/route.ts", import.meta.url), "utf8");
const adminUpdateRoute = readFileSync(new URL("../app/api/admin/[resource]/[id]/route.ts", import.meta.url), "utf8");
assert.match(adminRoute, /prepareClubImagePayload\(builtPayload, "create"\)/, "the create controller sanitizes optional club images");
assert.match(adminUpdateRoute, /prepareClubImagePayload\(builtPayload, "update"\)/, "the update controller preserves previous images when a new URL is invalid");

console.log("PASS  club image URL validation, Cloudinary secure URLs, optional-image warnings and non-blocking saves");
