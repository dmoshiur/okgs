import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, CalendarDays, Mail, User } from "lucide-react";
import { notFound } from "next/navigation";
import { loadContent } from "@/lib/content";
import { clubPath } from "@/lib/club-data";
import { paragraphs } from "@/lib/content-config";
import { formatDate } from "@/lib/format";
import { PublicChrome } from "@/components/public/Chrome";
import { Breadcrumb, EmptyState, InternalPageShell } from "@/components/public/InternalPage";
import { SmartImage } from "@/components/public/Media";
import { JsonLd } from "@/components/public/JsonLd";
import { breadcrumbSchema, newsArticleSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type NewsPageProps = { params: Promise<{ slug: string }> };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://okgs.info";

export async function generateMetadata({ params }: NewsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await loadContent();
  const story = content.news.find((item) => item.slug === slug);
  if (!story) return { title: "সংবাদ পাওয়া যায়নি" };
  return {
    title: story.title,
    description: story.excerpt,
    alternates: { canonical: `${siteUrl}/news/${story.slug}` },
    openGraph: {
      title: story.title,
      description: story.excerpt,
      images: story.image_url ? [story.image_url] : undefined,
      type: "article",
    },
  };
}

export default async function NewsStoryPage({ params }: NewsPageProps) {
  const { slug } = await params;
  const content = await loadContent();
  const story = content.news.find((item) => item.slug === slug);
  if (!story) notFound();

  const club = story.club_slug ? content.clubs.find((item) => item.slug === story.club_slug) : undefined;
  const blocks = paragraphs(story.body);
  const related = content.news
    .filter((item) => item.id !== story.id && (item.category === story.category || item.club_slug === story.club_slug))
    .slice(0, 2);
  const email = content.settings.find((setting) => setting.key === "email")?.value || "";

  return (
    <PublicChrome content={content} active="news" internal contextLabel={story.title}>

      <JsonLd schema={[newsArticleSchema(story, club), breadcrumbSchema([{ name: "সংবাদ", url: "/news" }, { name: story.title, url: `/news/${story.slug}` }])]} />
      <InternalPageShell className="story-page">
        <article className="page-width story-article">
          <Breadcrumb items={[{ label: "সংবাদ", href: "/news" }, { label: story.title }]} />
          <div className="story-article-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-dot" />{story.category || "সংবাদ"}</p>
              <h1>{story.title}</h1>
              <div className="story-article-meta">
                <span><CalendarDays size={14} /> {formatDate(story.published_at)}</span>
                {story.author ? <span><User size={14} /> {story.author}</span> : null}
              </div>
            </div>
            <span className="article-number">ওকেজিএস / সংবাদ</span>
          </div>

          <div className="article-hero">
            <SmartImage src={story.image_url} alt={story.title} priority transform={{ width: 1600, fit: "cover" }} label={story.title} accent="#e7c27e" />
          </div>

          <div className="article-body">
            <div className="article-copy">
              {story.excerpt ? <p className="article-lead">{story.excerpt}</p> : null}
              {blocks.length ? blocks.map((block, index) => <p key={index}>{block}</p>) : story.excerpt ? null : <EmptyState className="empty-note" message="এই সংবাদটির বিস্তারিত এখনো যুক্ত করা হয়নি।" />}

              {club ? (
                <aside className="article-club-box">
                  <span className="article-club-eyebrow">সম্পর্কিত ক্লাব</span>
                  <h3>{club.name}</h3>
                  {club.tagline ? <p>{club.tagline}</p> : null}
                  <div className="article-club-actions">
                    <a className="text-link" href={clubPath(club.slug)}>ক্লাবের পাতা <ArrowRight size={14} /></a>
                    <a className="text-link" href={clubPath(club.slug, "events")}>আয়োজন <ArrowUpRight size={13} /></a>
                  </div>
                </aside>
              ) : null}
            </div>

            <aside className="article-side">
              <div className="article-side-card">
                <h3>এই বিভাগে আরও</h3>
                {related.length ? (
                  <ul className="article-side-list">
                    {related.map((item) => (
                      <li key={item.id}>
                        <a href={`/news/${item.slug}`}>
                          <strong>{item.title}</strong>
                          <small>{formatDate(item.published_at, "short")}</small>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : <p className="empty-note">এই মুহূর্তে সম্পর্কিত সংবাদ নেই।</p>}
              </div>
              {email ? (
                <div className="article-side-card">
                  <h3>যোগাযোগ</h3>
                  <a className="text-link" href={`mailto:${email}`}><Mail size={14} /> {email}</a>
                </div>
              ) : null}
            </aside>
          </div>

          <div className="article-footer">
            <span>{story.title}</span>
            <a className="text-link" href="/news">সব সংবাদ <ArrowRight size={14} /></a>
          </div>
        </article>
      </InternalPageShell>
    </PublicChrome>
  );
}
