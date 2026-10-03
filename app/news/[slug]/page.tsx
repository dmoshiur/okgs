import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, CalendarDays, Mail } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicContent } from "@/lib/db";

export const dynamic = "force-dynamic";

type NewsPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: NewsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublicContent();
  const story = content.news.find((item) => item.slug === slug);
  if (!story) return { title: "Story not found" };
  return { title: story.title, description: story.excerpt, openGraph: { title: story.title, description: story.excerpt, images: story.image_url ? [story.image_url] : undefined } };
}

export default async function NewsStoryPage({ params }: NewsPageProps) {
  const { slug } = await params;
  const content = await getPublicContent();
  const story = content.news.find((item) => item.slug === slug);
  if (!story) notFound();
  const email = content.settings.find((setting) => setting.key === "email")?.value || "hello@okgs.info";
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(story.published_at));

  return <div className="story-page public-site"><header className="site-header page-width"><a href="/" className="brand" aria-label="OKGS home"><span className="brand-mark"><span>O</span></span><span className="brand-copy"><strong>OKGS</strong><small>Omar Kindergarten School</small></span></a><nav className="main-nav" aria-label="Primary navigation"><a href="/#about">Our story</a><a href="/#community">Community</a><a href="/#clubs">Clubs</a><a href="/news">Journal</a></nav><a className="button button-dark button-small" href={`mailto:${email}`}>Visit OKGS <ArrowUpRight size={14} /></a></header><main><div className="page-width story-article"><a className="back-story" href="/#news"><ArrowLeft size={15} /> Back to the journal</a><div className="story-article-heading"><div><p className="eyebrow"><span className="eyebrow-dot" />{story.category}</p><h1>{story.title}</h1><div className="story-article-meta"><span><CalendarDays size={14} /> {date}</span><span>{story.author}</span></div></div><span className="article-number">OKGS / JOURNAL</span></div><div className="article-hero" style={{ backgroundImage: `url("${story.image_url}")` }} /><div className="article-body"><p className="article-lead">{story.excerpt}</p><div className="article-copy"><p>{story.body || story.excerpt}</p><p>At OKGS, we believe the most important learning often happens between the lines: in the patient attempt, the generous question and the moment someone realises they can try again. Our classrooms make space for all three.</p></div></div><div className="article-footer"><span>Have a question about this story?</span><a className="text-link" href={`mailto:${email}`}>{email} <Mail size={14} /></a></div></div></main><footer className="site-footer"><div className="page-width footer-bottom"><span>© 2026 Omar Kindergarten School</span><a href="/">Back to OKGS <ArrowUpRight size={13} /></a><span>Made with care for curious minds.</span></div></footer></div>;
}
