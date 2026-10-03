import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, CalendarDays } from "lucide-react";
import { getPublicContent } from "@/lib/db";
import { OfficialLogo } from "@/components/public/OfficialLogo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "সংবাদ ও আপডেট", description: "ওমর কিন্ডারগার্টেন স্কুলের সর্বশেষ সংবাদ ও কার্যক্রম।" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function Header({ email }: { email: string }) {
  return <header className="site-header page-width"><a href="/" className="brand" aria-label="হোম"><OfficialLogo /><span className="brand-copy"><strong>ওমর কিন্ডারগার্টেন স্কুল</strong><small>ওমর গার্টেন একাডেমি · কালাই, জয়পুরহাট</small></span></a><nav className="main-nav" aria-label="প্রধান মেনু"><a href="/#about">আমাদের সম্পর্কে</a><a href="/#facilities">সুবিধাসমূহ</a><a href="/#clubs">ক্লাবসমূহ</a><a href="/news">সংবাদ</a></nav><a className="button button-green button-small" href={`mailto:${email}`}>যোগাযোগ <ArrowUpRight size={14} /></a></header>;
}

export default async function NewsIndexPage() {
  const content = await getPublicContent();
  const email = content.settings.find((setting) => setting.key === "email")?.value || "okgs2003@gmail.com";
  return <div className="story-page public-site"><Header email={email} /><main><section className="journal-index-hero"><div className="page-width"><p className="eyebrow"><span className="eyebrow-dot" />ওমর কিন্ডারগার্টেন স্কুল</p><h1>স্কুলের<br /><em>সর্বশেষ সংবাদ</em></h1><p>ক্যাম্পাসের শিক্ষা, কার্যক্রম, সাফল্য ও গুরুত্বপূর্ণ খবর।</p></div></section><section className="page-width journal-index-grid">{content.news.map((item) => <article className="index-news-card" key={item.id}><a className="index-news-image" style={{ backgroundImage: `url("${item.image_url}")` }} href={`/news/${item.slug}`}><span>{item.category}</span><i><ArrowUpRight size={18} /></i></a><div className="index-news-copy"><div><time><CalendarDays size={13} /> {formatDate(item.published_at)}</time><span>{item.author}</span></div><h2><a href={`/news/${item.slug}`}>{item.title}</a></h2><p>{item.excerpt}</p><a className="text-link" href={`/news/${item.slug}`}>বিস্তারিত পড়ুন <ArrowRight size={15} /></a></div></article>)}</section></main><footer className="site-footer"><div className="page-width footer-bottom"><span>© ২০২৬ ওমর কিন্ডারগার্টেন স্কুল</span><a href="/">হোম <ArrowUpRight size={13} /></a><span>কালাই, জয়পুরহাট</span></div></footer></div>;
}
