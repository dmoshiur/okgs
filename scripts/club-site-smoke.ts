/**
 * Club-site smoke test — no network, no database, no browser.
 *
 * Guards the shape of the club hosting model:
 *   1. every club site has exactly one address — its own subdomain,
 *   2. the address rules (`lib/club-urls.ts`) survive messy input,
 *   3. the internal render path `/club-site/<slug>` is never a public URL,
 *   4. the leadership strip keeps its protocol order and de-duplicates.
 *
 * Run: `npx tsx scripts/club-site-smoke.ts`
 */
import { readFileSync } from "node:fs";
import { clubSiteHost, clubSiteLabel, clubSiteUrl } from "../lib/club-urls";
import { leadershipCards } from "../lib/club-leadership";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
};

/* ---------------------------------------------------------------- addresses -- */
check("slug alone resolves to the club subdomain", clubSiteHost("alssm") === "alssm.okgs.info");
check("a saved subdomain is used as-is", clubSiteHost("alssm", "alssm.okgs.info") === "alssm.okgs.info");
check(
  "a subdomain pasted with a scheme and path is cleaned",
  clubSiteHost("alssm", "https://alssm.okgs.info/anything?x=1") === "alssm.okgs.info",
);
check("the absolute URL is https", clubSiteUrl({ slug: "aypg" }) === "https://aypg.okgs.info");
check(
  "an explicit website wins over the slug rule",
  clubSiteUrl({ slug: "artds", website: "https://debate.example.org/" }) === "https://debate.example.org",
);
check(
  "the legacy domain column is honoured too",
  clubSiteUrl({ slug: "artds", domain: "https://old.example.org" }) === "https://old.example.org",
);
check("a bare domain (no scheme) falls back to the subdomain", clubSiteUrl({ slug: "artds", website: "debate.example.org" }) === "https://artds.okgs.info");
check("labels show the host, never a scheme", clubSiteLabel({ slug: "alssm", website: "https://alssm.okgs.info/x" }) === "alssm.okgs.info");

/* ------------------------------------------------------------ single address -- */
const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
check("middleware renders club subdomains through /club-site/<slug>", middleware.includes("`/club-site/${club}`"));
check("middleware sends the old public path home", middleware.includes("target.pathname = slugPattern.test(slug) ? `/clubs/${slug}` : \"/clubs\""));
check("middleware answers the old club-site path with a real 308", middleware.includes("\\/clubs\\/([a-z0-9-]{2,24})\\/site"));
check("middleware serves a club's own sitemap and robots", middleware.includes('pathname === "/sitemap.xml"') && middleware.includes('pathname === "/robots.txt"'));

const legacyRoute = readFileSync(new URL("../app/clubs/[slug]/site/page.tsx", import.meta.url), "utf8");
check("the old /clubs/<slug>/site path is a permanent redirect", legacyRoute.includes("permanentRedirect"));
check("the redirect goes to the club's own subdomain", legacyRoute.includes("clubSiteUrl("));

const cards = readFileSync(new URL("../lib/club-sites.ts", import.meta.url), "utf8");
check("club cards expose site_url, not a /site path", cards.includes("site_url") && !cards.includes("site_path"));

/* ------------------------------------------------------------- leadership ---- */
const ordered = leadershipCards({
  customized: true,
  leaders: [
    { name: "কোষাধ্যক্ষ", role: "কোষাধ্যক্ষ" },
    { name: "সভাপতি", role: "সভাপতি" },
    { name: "সভাপতি", role: "সভাপতি" },
  ],
  members: [{ name: "সাধারণ সম্পাদক", role: "সাধারণ সম্পাদক", class_room: "নবম", section: "ক" } as never],
});
check("leadership follows the club protocol order", ordered.map((card) => card.role).join("|") === "সভাপতি|সাধারণ সম্পাদক|কোষাধ্যক্ষ");
check("duplicate people are dropped", ordered.filter((card) => card.role === "সভাপতি").length === 1);

const untouched = leadershipCards({
  customized: false,
  leaders: [{ name: "ড্রাফট", role: "সভাপতি" }],
  members: [],
});
check("an uncustomised club ignores unsaved draft leaders", untouched.length === 0);

if (failures) {
  console.error(`\n${failures} club-site check(s) failed.`);
  process.exit(1);
}
console.log("\nAll club-site checks passed.");
