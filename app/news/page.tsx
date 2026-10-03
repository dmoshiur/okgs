import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getPublicContent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The OKGS journal", description: "Stories from the classrooms, clubs and community of Omar Kindergarten School." };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default async function NewsIndexPage() {
  const content = await getPublicContent();
  const email = content.settings.find((setting) => setting.key === "email")?.value || "hello@okgs.info";
  return <div className="story-page public-site"><header className="site-header page-width"><a href="/" className="brand" aria-label="OKGS home"><span className="brand-mark"><span>O</span></span><span className="brand-copy"><strong>OKGS</strong><small>Omar Kindergarten School</small></span></a><nav className="main-nav" aria-label="Primary navigation"><a href="/#about">Our story</a><a href="/#community">Community</a><a href="/#clubs">Clubs</a><a href="/news">Journal</a></nav><a className="button button-dark button-small" href={`mailto:${email}`}>Visit OKGS <ArrowUpRight size={14} /></a></header><main><section className="journal-index-hero"><div className="page-width"><p className="eyebrow"><span className="eyebrow-dot" />From the OKGS journal</p><h1>Small moments.<br /><em>Lasting stories.</em></h1><p>Notes from our classrooms, clubs and the people who make this community feel like home.</p></div></section><section className="page-width journal-index-grid">{content.news.map((item) => <article className="index-news-card" key={item.id}><a className="index-news-image" style={{ backgroundImage: `url("${item.image_url}")` }} href={`/news/${item.slug}`}><span>{item.category}</span><i><ArrowUpRight size={18} /></i></a><div className="index-news-copy"><div><time>{formatDate(item.published_at)}</time><span>{item.author}</span></div><h2><a href={`/news/${item.slug}`}>{item.title}</a></h2><p>{item.excerpt}</p><a className="text-link" href={`/news/${item.slug}`}>Read story <ArrowRight size={15} /></a></div></article>)}</section></main><footer className="site-footer"><div className="page-width footer-bottom"><span>© 2026 Omar Kindergarten School</span><a href="/">Back to OKGS <ArrowUpRight size={13} /></a><span>Made with care for curious minds.</span></div></footer></div>;
}
