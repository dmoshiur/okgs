/** Regression checks for full public-facing names. Run with `npm run smoke`. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicChrome, siteInfo } from "../components/public/Chrome";
import { ClubCard } from "../components/public/ClubCard";
import { ClubShowcase } from "../components/public/ClubShowcase";
import { ThemeModeProvider } from "../components/public/ThemeModeProvider";
import { VisualModeProvider } from "../components/public/VisualModeProvider";
import { seeds } from "../lib/seed-content";
import type { Club, PublicContent, SiteSetting } from "../lib/types";
import type { ClubSummary } from "../lib/club-data";

const fullName = "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি";
const setting = (key: string, value: string): SiteSetting => ({
  id: key, key, value, label: key, field_kind: "text", description: "", image_url: "", created_at: "", updated_at: "",
});
function renderHeader(settings: SiteSetting[], contextLabel?: string) {
  // PublicChrome only consumes settings and notices from the content collections.
  const content = { settings, notices: [] } as unknown as PublicContent;
  const html = renderToStaticMarkup(
    <ThemeModeProvider>
      <VisualModeProvider>
        <PublicChrome content={content} active="clubs" contextLabel={contextLabel}>
          <p>Page content</p>
        </PublicChrome>
      </VisualModeProvider>
    </ThemeModeProvider>,
  );
  return html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0] || "";
}

for (const shortName of ["OKGS", "Main", ""]) {
  const header = renderHeader([setting("site_name", fullName), setting("short_name", shortName)]);
  assert.ok(header.includes(`<strong>${fullName}</strong>`), "header must show site_name, not short_name");
  assert.ok(!header.includes(">Main<") && !header.includes(">OKGS<"));
}
const updatedName = "নতুন নামের আন্তর্জাতিক বিজ্ঞান ও প্রযুক্তি শিক্ষা প্রতিষ্ঠান";
assert.ok(renderHeader([setting("site_name", updatedName)]).includes(`<strong>${updatedName}</strong>`));
assert.ok(renderHeader([]).includes(`<strong>${fullName}</strong>`), "missing settings use the full institution name");
assert.equal(siteInfo([setting("site_name", "")]).name, fullName);
const context = "আন্তর্জাতিক গণিত বিজ্ঞান ও সৃজনশীল প্রযুক্তি চর্চা ক্লাব · পরিচিতি";
assert.ok(renderHeader([], context).includes(`<small title="${context}">${context}</small>`));

const seedClub = seeds.find((seed) => seed.resource === "clubs")!.rows[0] as unknown as Club;
for (const name of [context, "Association Of Little Scientists And Math Maniacs", "UnbrokenClubName".repeat(12)]) {
  const club: Club = { ...seedClub, name };
  const summary: ClubSummary = {
    club, objectives: [], counts: { events: 0, posts: 0, gallery: 0, members: 0, achievements: 0 },
    // Club sites are hosted on their own subdomain — the card links there.
    siteUrl: `https://${club.slug}.okgs.info`,
    siteLabel: `${club.slug}.okgs.info`,
  };
  for (const variant of ["grid", "row"] as const) {
    const card = renderToStaticMarkup(<ClubCard summary={summary} variant={variant} />);
    assert.ok(card.includes(`>${name}</a>`), "card must keep the entire club name");
    assert.ok(card.includes(`https://${club.slug}.okgs.info`), "card must link to the club's own site");
  }
  const showcase = renderToStaticMarkup(<ClubShowcase clubs={[club]} slides={[]} />);
  assert.ok(showcase.includes(`<h3>${name}</h3>`), "showcase must keep the entire club name");
}

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
for (const selector of [".brand-copy", ".brand-copy strong", ".brand-copy small", ".club-card h3", ".showcase-card h3", ".mobile-panel-kicker"]) {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.trim() === selector).map(([, , body]) => body).join("\n");
  assert.ok(rules, `missing ${selector}`);
  assert.ok(!/overflow:\s*hidden|text-overflow:\s*ellipsis|line-clamp:|white-space:\s*nowrap|max-width:/.test(rules), `${selector} must not truncate names`);
}
// The header title must wrap whole words and only break inside a word when a
// single token cannot fit a line on its own. `overflow-wrap: anywhere` would
// collapse the min-content width to one character and render the brand title
// as a vertical column on narrow screens — `break-word` plus explicit width
// floors on the header columns prevents both failure modes.
assert.match(css, /\.brand-copy\s*\{[^}]*white-space:\s*normal;\s*overflow-wrap:\s*break-word;\s*word-break:\s*normal/);
assert.ok(!/\.brand-copy\s*\{[^}]*overflow-wrap:\s*anywhere/.test(css), ".brand-copy must never use overflow-wrap: anywhere (vertical-title collapse)");
assert.match(css, /\.header-inner\s*\{[^}]*grid-template-columns:\s*minmax\(min\(100%,\s*220px\),\s*1fr\)\s*auto/);
assert.match(css, /\.header-inner > \.brand\s*\{[^}]*min-width:\s*min\(100%,\s*170px\)/);
assert.match(css, /\.app-top-inner \.brand\s*\{[^}]*min-width:\s*min\(100%,\s*170px\)/);
assert.match(css, /\.club-card h3\s*\{[^}]*white-space:\s*normal;\s*overflow-wrap:\s*anywhere/);
const showcaseStyle = css.match(/\.showcase-card\s*\{([^}]*)\}/)?.[1] || "";
assert.ok(!/(?:^|[;\s])(?:height|aspect-ratio):/.test(showcaseStyle), "showcase tiles must grow to fit names instead of enforcing a height or ratio");
const mobileNav = readFileSync(new URL("../components/public/MobileNav.tsx", import.meta.url), "utf8");
assert.ok(mobileNav.includes("{site.name}") && !mobileNav.includes("site.shortName"), "mobile menus must use the full school or club name");
console.log("PASS  full site names, dynamic settings, full-name fallback, club card variants, showcase and wrapping styles");
