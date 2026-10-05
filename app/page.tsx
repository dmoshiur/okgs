import { getPublicContent } from "@/lib/db";
import { PublicHome } from "@/components/public/PublicHome";
import { PublicChrome } from "@/components/public/Chrome";
import { FairSite } from "@/components/public/FairSite";
import { activeFair, fairMode, readFlag } from "@/lib/site";
import { listTickers } from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/**
 * The homepage is either the school site or — with one switch in the console —
 * the whole science-fair site. Reverting is the same one click.
 */
export default async function HomePage() {
  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  const fair = activeFair(content, mode.slug);

  if (mode.enabled && fair) {
    const tickers = await listTickers({ fair_slug: fair.slug, activeOnly: true, limit: 12 }).catch(() => []);
    return (
      <PublicChrome content={content} active="fair" contextLabel={fair.name}>
        <div className="v2-wrap" style={{ paddingTop: 14 }}>
          <div className="fair-mode-banner">
            <span>
              <strong>মেলা মোড চালু</strong> — পুরো সাইট এখন {fair.name} এর সাইট হিসেবে চলছে।
            </span>
            <a className="text-link" href="/admin">অ্যাডমিন কনসোল থেকে ফিরিয়ে আনুন</a>
          </div>
        </div>
        <FairSite
          content={content}
          fair={fair}
          compact
          tickers={tickers.map((item) => ({
            id: item.id,
            message: item.message,
            kind: item.kind,
            category: item.category,
            name: item.name,
            class_level: item.class_level,
            section: item.section,
          }))}
        />
      </PublicChrome>
    );
  }

  if (readFlag(content.settings, "fair_banner_enabled", true) === false && mode.enabled) {
    return <PublicHome content={content} />;
  }

  return <PublicHome content={content} />;
}
