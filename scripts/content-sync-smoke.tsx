/**
 * Regression checks for the four content-sync + layout contracts.
 *
 *   1. dynamic content & titles come from the database and are revalidated
 *   2. media assets clear properly and fall back when an image is gone
 *   3. admin action buttons never collide and respect the caller's role
 *   4. hero cards / stats / nav pills keep their own space at every width
 *
 * Everything here runs without a browser or a database: the components are
 * server-rendered with realistic rows, and the stylesheet / route modules are
 * asserted as text. Run with `npm run smoke`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";

import { SmartBackdrop, SmartImage, ThumbImage } from "../components/public/Media";
import { HeroCarousel } from "../components/public/HeroCarousel";
import { FairMega } from "../components/public/FairMega";
import { ContentListTable } from "../components/admin/ContentListTable";
import type { PublicContent, Fair, Slide } from "../lib/types";

const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const css = read("app/globals.css");
const text = (file: string) => read(file);

/* ========================================================== 1. dynamic data */

const fair: Fair = {
  id: "f1", slug: "science-fair-2026", name: "বিজ্ঞান মেলা ২০২৬ — হাতে-কলমে বিজ্ঞান",
  tagline: "তিন দিনের মেলা", description: "", edition: "৩য়", is_active: 1, is_featured: 1,
  starts_on: "2026-11-12", ends_on: "2026-11-14", intro_time: "সকাল ৯টা – বিকেল ৫টা",
  venue: "স্কুল প্রাঙ্গণ", city: "কালাই, জয়পুরহাত", fee: 0, registration_deadline: "",
  registration_open: 1, poster_url: "", cover_image_url: "", logo_url: "", results_note: "",
  sort_order: 1, created_at: "", updated_at: "",
} as unknown as Fair;

const content = {
  fairs: [fair], fair_categories: [], fair_schedule: [], fair_collections: [],
  settings: [
    { id: "s1", key: "fair_banner_enabled", value: "1", label: "", field_kind: "text", description: "", image_url: "", created_at: "", updated_at: "" },
    { id: "s2", key: "fair_mode_slug", value: "science-fair-2026", label: "", field_kind: "text", description: "", image_url: "", created_at: "", updated_at: "" },
    { id: "s3", key: "fair_banner_title", value: "মেলার শিরোনাম অ্যাডমিন থেকে বদলানো", label: "", field_kind: "text", description: "", image_url: "", created_at: "", updated_at: "" },
  ],
} as unknown as PublicContent;

const mega = renderToStaticMarkup(h(FairMega, { content }));
assert.ok(mega.includes("মেলার শিরোনাম অ্যাডমিন থেকে বদলানো"), "fair banner renders the title saved in the database");
assert.ok(!mega.includes(">OKGS Science Fair 2026<"), "fair banner must not fall back to a hardcoded literal");

// Hero copy is whatever the slides table holds — no fallback copy of its own.
const slide: Slide = { id: "sl1", title: "অ্যাডমিন থেকে লেখা স্লাইড শিরোনাম", description: "", image_url: "/media/hero-campus.svg", eyebrow: "", cta_label: "", cta_href: "", accent: "", is_active: 1, sort_order: 1, created_at: "", updated_at: "" } as unknown as Slide;
// Two slides so the carousel controls render — that group is what the badge used to cover.
const slide2: Slide = { ...slide, id: "sl2", title: "দ্বিতীয় স্লাইড" } as Slide;
const hero = renderToStaticMarkup(h(HeroCarousel, { slides: [slide, slide2], badge: { year: "২০০৩", place: "কালাই, জয়পুরহাট" } }));
assert.ok(hero.includes("অ্যাডমিন থেকে লেখা স্লাইড শিরোনাম"), "hero renders the slide row from the database");

// Every write path flushes the cached public renders.
for (const route of ["app/api/admin/[resource]/route.ts", "app/api/admin/[resource]/[id]/route.ts", "app/api/admin/reorder/route.ts", "app/api/clubs/[slug]/site/route.ts"]) {
  const source = text(route);
  assert.ok(source.includes("revalidatePublicSite"), `${route} must revalidate the public tree after a write`);
}
assert.ok(text("lib/revalidate.ts").includes('revalidatePath("/", "layout")'), "revalidation must cover the root layout");

// Dynamic routes are the only source of truth and are never cached downstream.
for (const route of ["app/page.tsx", "app/fair/[slug]/page.tsx", "app/news/[slug]/page.tsx", "app/clubs/[slug]/page.tsx"]) {
  const source = text(route);
  assert.match(source, /export const dynamic = "force-dynamic";/, `${route} must render per request`);
  assert.match(source, /export const revalidate = 0;/, `${route} must opt out of the route cache`);
}
const config = text("next.config.mjs");
assert.ok(config.includes('"Cache-Control", value: "no-store, must-revalidate"'), "dynamic routes answer no-store");
assert.ok(config.includes('"CDN-Cache-Control", value: "no-store"'), "edge caches must not hold dynamic HTML");
assert.ok(text("middleware.ts").includes("isDynamicPublicPath"), "middleware stamps no-store on dynamic responses");

// Renaming a slug moves every reference with it.
const idRoute = text("app/api/admin/[resource]/[id]/route.ts");
assert.ok(idRoute.includes("renameFairSlug"), "a renamed fair must carry its categories, schedule and collections");
assert.ok(idRoute.includes("renameClubSiteOverride"), "a renamed club must keep its saved micro-site edits");
assert.ok(text("lib/site.ts").includes("syncFairModeSlug"), "the 'which fair is live' switch follows a renamed fair");

// Metadata and body share one request-scoped read, so the title cannot drift.
assert.ok(text("lib/content.ts").includes('cache(async () => getPublicContent())'), "content reads are memoised per request");
const fairPage = text("app/fair/[slug]/page.tsx");
assert.ok(fairPage.includes("loadContent") && !fairPage.includes("getPublicContent"), "the fair page uses the shared read");
assert.ok(fairPage.includes("redirectTo"), "a near-match slug redirects to the canonical fair URL");

// The database outranks the checked-in club.json seed.
const clubSites = text("lib/club-sites.ts");
assert.ok(clubSites.includes("pickList(override.events, dbEvents, base.events)"), "DB events displace the club.json seed");
assert.ok(clubSites.includes("pickList(override.gallery, dbGallery, base.gallery)"), "DB photos displace the club.json seed");
assert.ok(!/override\.events !== undefined \? override\.events : base\.events/.test(clubSites), "the old seed-first event rule is gone");

console.log("PASS  dynamic titles, per-request rendering, revalidation on every write and slug rename cascades");

/* ============================================================== 2. media === */

// A missing or dead URL renders the labelled placeholder, never a broken glyph.
assert.ok(renderToStaticMarkup(h(SmartImage, { src: "", alt: "কভার" })).includes("media-fallback"), "no URL → fallback");
assert.ok(renderToStaticMarkup(h(SmartImage, { src: "/media/campus-lab.svg", alt: "ল্যাব" })).includes("<img"), "a real URL renders an <img>");
// Backgrounds get the same treatment even though CSS cannot fire onError.
assert.ok(renderToStaticMarkup(h(SmartBackdrop, { src: "" })).includes("media-fallback"), "empty backdrop → fallback");
assert.ok(text("components/public/Media.tsx").includes("probe.onerror"), "backdrops probe the URL so a dead asset falls back too");
// A replaced image must re-arm the failure flag — the old code kept it failed.
assert.match(text("components/public/Media.tsx"), /useEffect\(\(\) => \{\s*setFailed\(false\);\s*\}, \[url\]\)/);
assert.match(text("components/admin/ImageField.tsx"), /useEffect\(\(\) => \{\s*setPreviewBroken\(false\);\s*\}, \[value\]\)/);

// Removing an image clears the URL, the in-flight upload and the file input.
const imageField = text("components/admin/ImageField.tsx");
assert.ok(imageField.includes("controllerRef.current?.abort()"), "Remove aborts an upload still in flight");
assert.ok(imageField.includes("inputRef.current.value = \"\""), "Remove clears the file input");
assert.ok(imageField.includes("onClick={clearValue}"), "the Remove button runs the full clear");
assert.match(text("components/club/studio/fields.tsx"), /onClick=\{\(\) => \{[\s\S]*?onChange\(""\);/, "the club picker's remove clears the URL too");

// Thumbnails swap in their icon fallback instead of overlapping the row text.
assert.ok(renderToStaticMarkup(h(ThumbImage, { src: "", fallback: h("i", null, "icon") })).includes(">icon<"), "empty thumb → icon");
assert.ok(renderToStaticMarkup(h(ThumbImage, { src: "/media/mark.svg", fallback: h("i", null, "icon") })).includes("<img"), "a real thumb renders an <img>");

console.log("PASS  image clearing, per-URL failure state and fallbacks for <img>, backdrops and thumbs");

/* ====================================================== 3. admin controls == */

const rows = [{ id: "r1", title: "নোটিশ", club_slug: "alssm", is_active: 1, updated_at: "2026-10-01T10:00:00Z" }];
const handlers = { onEdit: () => {}, onDuplicate: () => {}, onDelete: () => {}, onToggle: () => {}, onMove: () => {} };
const tableProps = { resource: "settings" as const, rows, loading: false, clubs: [], busyRowId: "", reorderable: false, hasFilters: false, onCreate: () => {}, onClearFilters: () => {} };

const adminTable = renderToStaticMarkup(h(ContentListTable, { ...tableProps, canWrite: true, canDelete: true, ...handlers }));
const readOnlyTable = renderToStaticMarkup(h(ContentListTable, { ...tableProps, canWrite: false, canDelete: false, ...handlers }));
assert.ok(adminTable.includes("Edit this entry") && adminTable.includes("Delete this entry"), "a SuperAdmin gets the full action group");
assert.ok(!readOnlyTable.includes("Edit this entry"), "a plain admin is not offered Edit on a SuperAdmin-only resource");
assert.ok(!readOnlyTable.includes("Delete this entry"), "a plain admin is not offered Delete on a SuperAdmin-only resource");
assert.ok(!readOnlyTable.includes("Duplicate this entry"), "a plain admin is not offered Duplicate on a SuperAdmin-only resource");
assert.ok(readOnlyTable.includes("View on the site"), "read-only rows keep the harmless preview link");
assert.ok(text("components/admin/AdminStudio.tsx").includes("const canWrite = !restricted || session.isSuperAdmin;"), "the studio derives the write gate from the session role");

// Action buttons keep their size instead of being flex-shrunk into each other.
assert.match(css, /\.row-actions > button, \.row-actions > a \{[\s\S]*?flex: 0 0 auto;/);
assert.match(css, /\.content-table-head, \.content-row \{\s*\/\*[\s\S]*?grid-template-columns:[^;]*208px;/);
assert.match(css, /\.admin-topbar \{[^}]*flex-wrap: wrap;/);
assert.match(css, /\.admin-top-actions \{[^}]*flex-wrap: wrap;/);
assert.match(css, /\.cst-row-head \{[^}]*flex-wrap: wrap;/);
assert.match(css, /\.cst-lines-tools button, \.cst-row-tools button, \.cst-shot-tools button \{[\s\S]*?flex: 0 0 auto;/);

console.log("PASS  role-gated admin actions and non-shrinking button groups");

/* ==================================================== 4. layout overlap === */

// The badge is anchored to the photograph, not to the whole hero column.
assert.ok(hero.includes('class="hero-frame"'), "the stage and its badge share one positioned frame");
const frameIndex = hero.indexOf('class="hero-frame"');
const stageEnd = hero.indexOf("</div>", hero.indexOf("hero-stage"));
assert.ok(hero.indexOf("hero-badge") > 0 && hero.indexOf("hero-badge") < hero.indexOf("hero-controls"), "the badge sits before the controls in the DOM");
assert.ok(hero.indexOf("hero-controls") > hero.indexOf("hero-frame"), "the controls live outside the badge's containing block");
assert.match(css, /\.hero-frame \{[^}]*position: relative;/);
assert.match(css, /\.hero-badge \{[^}]*position: absolute;[^}]*bottom: 18px;/);
assert.match(css, /\.hero-controls \{[\s\S]*?position: relative;[\s\S]*?z-index: 1;/);
assert.ok(frameIndex > -1 && stageEnd > -1);

// Long values wrap inside their card instead of stretching across the page.
assert.match(css, /\.hero-badge \{[^}]*max-width: min\(260px, calc\(100% - 36px\)\)/);
assert.match(css, /\.hero-badge strong \{[^}]*overflow-wrap: anywhere;/);
assert.match(css, /\.stats-grid strong \{[\s\S]*?overflow-wrap: anywhere;/);
assert.match(css, /\.stats-grid > div \{[\s\S]*?min-width: 0;/);
// Fair hero keeps its copy above the decorative radial.
assert.match(css, /\.fair-mega-inner > \* \{[^}]*position: relative;[^}]*z-index: 1;/);
assert.match(css, /\.fair-mega-title \{[^}]*overflow-wrap: anywhere;/);
// Dock labels clip to a single line instead of wrapping into the icon.
assert.match(css, /\.mobile-bottom-label \{[\s\S]*?white-space: nowrap;[\s\S]*?text-overflow: ellipsis;/);

console.log("PASS  hero badge/controls separation, wrapping stats and clipped navigation pills");
console.log("");
console.log("All content-sync, media, admin-control and layout checks passed.");
