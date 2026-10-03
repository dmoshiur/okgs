import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, CalendarDays, Mail } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { OfficialLogo } from "@/components/public/OfficialLogo";

export const dynamic = "force-dynamic";
type NewsPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: NewsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublicContent();
  const story = content.news.find((item) => item.slug === slug);
  if (!story) return { title: "সংবাদ পাওয়া যায়নি" };
  return { title: story.title, description: story.excerpt, openGraph: { title: story.title, description: story.excerpt, images: story.image_url ? [story.image_url] : undefined } };
}

export default async function NewsStoryPage({ params }: NewsPageProps) {
  const { slug } = await params;
  const content = await getPublicContent();
  const story = content.news.find((item) => item.slug === slug);
  if (!story) notFound();
  const email = content.settings.find((setting) => setting.key === "email")?.value || "okgs2003@gmail.com";
  const date = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "long", year: "numeric" }).format(new Date(story.published_at));

  return <div className="story-page public-site"><header className="site-header page-width"><a href="/" className="brand" aria-label="হোম"><OfficialLogo /><span className="brand-copy"><strong>ওমর কিন্ডারগার্টেন স্কুল</strong><small>ওমর গার্টেন একাডেমি · কালাই, জয়পুরহাট</small></span></a><nav className="main-nav" aria-label="প্রধান মেনু"><a href="/#about">আমাদের সম্পর্কে</a><a href="/#facilities">সুবিধাসমূহ</a><a href="/#clubs">ক্লাবসমূহ</a><a href="/news">সংবাদ</a></nav><a className="button button-green button-small" href={`mailto:${email}`}>যোগাযোগ <ArrowUpRight size={14} /></a></header><main><div className="page-width story-article"><a className="back-story" href="/news"><ArrowLeft size={15} /> সংবাদে ফিরুন</a><div className="story-article-heading"><div><p className="eyebrow"><span className="eyebrow-dot" />{story.category}</p><h1>{story.title}</h1><div className="story-article-meta"><span><CalendarDays size={14} /> {date}</span><span>{story.author}</span></div></div><span className="article-number">ওকেজিএস / সংবাদ</span></div><div className="article-hero" style={{ backgroundImage: `url("${story.image_url}")` }} /><div className="article-body"><p className="article-lead">{story.excerpt}</p><div className="article-copy"><p>{story.body || story.excerpt}</p><p>ওমর কিন্ডারগার্টেন স্কুলে শিক্ষার্থীদের শেখা, সৃজনশীলতা ও নেতৃত্ব বিকাশের প্রতিটি সুযোগকে গুরুত্ব দেওয়া হয়।</p></div></div><div className="article-footer"><span>এই সংবাদ সম্পর্কে জানতে চান?</span><a className="text-link" href={`mailto:${email}`}>{email} <Mail size={14} /></a></div></div></main><footer className="site-footer"><div className="page-width footer-bottom"><span>© ২০২৬ ওমর কিন্ডারগার্টেন স্কুল</span><a href="/">হোম <ArrowUpRight size={13} /></a><span>সবার জন্য মানসম্মত শিক্ষা</span></div></footer></div>;
}
