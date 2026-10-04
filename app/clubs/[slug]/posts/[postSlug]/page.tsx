import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarDays, Mail, User } from "lucide-react";
import { loadClub } from "@/lib/club-loader";
import { clubPath, settingValue } from "@/lib/club-data";
import { paragraphs } from "@/lib/content-config";
import { formatDate } from "@/lib/format";
import { PublicChrome } from "@/components/public/Chrome";
import { ClubTabs } from "@/components/public/ClubTabs";
import { Breadcrumb } from "@/components/public/InternalPage";
import { SmartImage } from "@/components/public/Media";

type ClubPostPageProps = { params: Promise<{ slug: string; postSlug: string }> };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://okgs.info";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ClubPostPageProps): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const loaded = await loadClub(slug);
  const post = loaded?.data.posts.find((item) => item.slug === postSlug);
  if (!loaded || !post) return { title: "লেখা পাওয়া যায়নি" };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `${siteUrl}/clubs/${loaded.club.slug}/posts/${post.slug}` },
    openGraph: {
      title: `${post.title} | ${loaded.club.name}`,
      description: post.excerpt,
      images: post.image_url ? [post.image_url] : undefined,
    },
  };
}

export default async function ClubPostPage({ params }: ClubPostPageProps) {
  const { slug, postSlug } = await params;
  const loaded = await loadClub(slug);
  if (!loaded) notFound();
  const index = loaded.data.posts.findIndex((item) => item.slug === postSlug);
  const post = loaded.data.posts[index];
  if (!post) notFound();

  const { club, data, content } = loaded;
  const blocks = paragraphs(post.body);
  const contactEmail = club.email || settingValue(content.settings, "email");
  const related = data.posts.filter((item) => item.id !== post.id).slice(0, 3);
  const accent = club.accent || "#e7c27e";

  return (
    <PublicChrome content={content} active="clubs" internal>
      <div>
        <article className="internal-page-shell club-post-page" style={{ "--club-accent": accent } as React.CSSProperties}>
          <header className="club-post-head">
            <div className="page-width">
              <Breadcrumb items={[{ label: "ক্লাবসমূহ", href: "/clubs" }, { label: club.name, href: clubPath(club.slug) }, { label: post.title }]} className="internal-breadcrumb-light" />
              <p className="eyebrow eyebrow-light"><span className="eyebrow-dot" />{post.category || "লেখা"}</p>
              <h1>{post.title}</h1>
              {post.excerpt ? <p className="club-post-excerpt">{post.excerpt}</p> : null}
              <div className="club-post-meta">
                <span><CalendarDays size={14} /> {formatDate(post.published_at)}</span>
                {post.author ? <span><User size={14} /> {post.author}</span> : null}
                <span><ArrowUpRight size={14} /> {club.name}</span>
              </div>
            </div>
          </header>

          <div className="page-width club-post-navigation">
            <ClubTabs club={club} active="posts" />
          </div>

          <div className="page-width club-post-body">
            {post.image_url ? (
              <figure className="club-post-figure">
                <SmartImage src={post.image_url} alt={post.title} priority transform={{ width: 1600 }} label={post.title} accent={accent} />
              </figure>
            ) : null}

            <div className="club-post-article">
              {blocks.length ? (
                <div className="article-copy">
                  {blocks.map((block, blockIndex) =>
                    /^[-•]\s+/.test(block) || block.includes("\n-") ? (
                      <ul key={blockIndex} className="club-post-list">
                        {block
                          .split(/\r?\n/)
                          .map((line) => line.replace(/^[-•*]\s*/, "").trim())
                          .filter(Boolean)
                          .map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}
                      </ul>
                    ) : blockIndex === 0 ? (
                      <p key={blockIndex} className="article-lead">{block}</p>
                    ) : (
                      <p key={blockIndex}>{block}</p>
                    ),
                  )}
                </div>
              ) : (
                <p className="empty-note">এই লেখাটি এখনো লেখা হয়নি।</p>
              )}

              {post.note ? <aside className="club-post-note">{post.note}</aside> : null}

              <div className="article-footer">
                <span>{club.name} সম্পর্কে জানতে চান?</span>
                <a className="text-link" href={contactEmail ? `mailto:${contactEmail}` : "/#contact"}>
                  {contactEmail || "যোগাযোগ করুন"} <Mail size={14} />
                </a>
              </div>
            </div>

            {related.length ? (
              <section className="club-post-related">
                <h2>এই ক্লাবের আরও লেখা</h2>
                <div className="club-related-grid">
                  {related.map((item) => (
                    <a key={item.id} href={clubPath(club.slug, `posts/${item.slug}`)} className="club-related-card">
                      <SmartImage src={item.image_url} alt={item.title} transform={{ width: 520, fit: "cover" }} label={item.title} accent={accent} />
                      <span className="club-related-copy">
                        <small>{formatDate(item.published_at)}</small>
                        <strong>{item.title}</strong>
                      </span>
                    </a>
                  ))}
                </div>
                <a className="text-link" href={clubPath(club.slug, "posts")}>সব লেখা <ArrowUpRight size={14} /></a>
              </section>
            ) : null}
          </div>

        </article>
      </div>
    </PublicChrome>
  );
}
