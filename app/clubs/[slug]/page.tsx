import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { loadClub } from "@/lib/club-loader";
import { clubPath } from "@/lib/club-data";
import { clubSiteLabel, clubSiteUrl } from "@/lib/club-urls";
import { paragraphs, toLines } from "@/lib/content-config";
import { bn, formatDate } from "@/lib/format";
import { ClubShell, ClubSectionTitle } from "@/components/public/ClubShell";
import { ClubTabs } from "@/components/public/ClubTabs";
import { CTAGroup } from "@/components/public/InternalPage";
import {
  AchievementList,
  ClubSidebar,
  EventList,
  FactGrid,
  NoticeList,
  ObjectiveList,
  PostList,
  ClubNewsList,
} from "@/components/public/ClubBlocks";
import { GalleryViewer } from "@/components/public/GalleryViewer";
import { SmartImage } from "@/components/public/Media";
import { ClubLeadership } from "@/components/public/ClubLeadership";

type ClubPageProps = { params: Promise<{ slug: string }> };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://okgs.info";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadClub(slug);
  if (!loaded) return { title: "ক্লাব পাওয়া যায়নি" };
  const { club } = loaded;
  const image = club.cover_image_url || club.image_url;
  const description = club.description || club.tagline || `${club.name} — আয়োজন, সদস্য ও অর্জনের তথ্য।`;
  return {
    title: club.name,
    description,
    alternates: { canonical: `${siteUrl}/clubs/${club.slug}` },
    openGraph: {
      title: `${club.name} | ওকেজিএস ক্লাব তথ্যকেন্দ্র`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ClubOverviewPage({ params }: ClubPageProps) {
  const { slug } = await params;
  const loaded = await loadClub(slug);
  if (!loaded) notFound();
  const { club, data } = loaded;
  const clubSiteHref = clubSiteUrl({ slug: club.slug, subdomain: club.subdomain, website: club.domain });
  const clubSiteHost = clubSiteLabel({ slug: club.slug, subdomain: club.subdomain, website: club.domain });
  const historyBlocks = paragraphs(club.history);
  const missionBlocks = paragraphs(club.mission);
  const cover = club.cover_image_url || club.image_url || data.gallery[0]?.image_url || data.posts[0]?.image_url || "";

  const sectionCounts = [
    { label: "আয়োজন", value: data.events.length },
    { label: "ছবি", value: data.gallery.length },
    { label: "কমিটি ও সদস্য", value: data.members.length },
    { label: "অর্জন", value: data.achievements.length },
  ];

  return (
    <ClubShell loaded={loaded} section="">
      {/* The summary and actions follow the club identity before statistics,
          section navigation or featured content. */}
      <section className="club-overview" aria-labelledby="club-overview-title">
        <div className="club-overview-copy">
          <p className="eyebrow"><span className="eyebrow-dot" aria-hidden />{club.short_code ? `${club.short_code} · ` : ""}সংক্ষেপে</p>
          <h2 id="club-overview-title">{club.motto || club.tagline || club.name}</h2>
          {club.name_en ? <p className="club-en club-en-dark">{club.name_en}</p> : null}
          {club.description ? <p className="club-overview-lead">{club.description}</p> : null}

          <CTAGroup className="club-overview-actions">
            <a className="button button-primary button-small club-site-cta" href={clubSiteHref} target="_blank" rel="noreferrer noopener">
              <Sparkles size={15} aria-hidden />
              <span className="club-site-cta-copy">
                <strong>সাইট দেখুন</strong>
                <small>{clubSiteHost}</small>
              </span>
              <ArrowUpRight size={14} aria-hidden />
            </a>
            {club.facebook_url ? (
              <a className="button button-outline button-small" href={club.facebook_url} target="_blank" rel="noreferrer noopener">
                ফেসবুক পেজ
              </a>
            ) : null}
            {club.email ? (
              <a className="text-link" href={`mailto:${club.email}`}>{club.email}</a>
            ) : null}
            <Link className="club-admin-link" href={`/clubs/${club.slug}/admin`}>
              <ShieldCheck size={13} aria-hidden /> ক্লাব অ্যাডমিন
            </Link>
          </CTAGroup>
        </div>

        <nav className="club-overview-stats" aria-label="ক্লাবের তথ্য">
          <Link href={clubPath(club.slug, "events")}>
            <strong>{bn(sectionCounts[0].value)}</strong>
            <span>{sectionCounts[0].label}</span>
          </Link>
          <Link href={clubPath(club.slug, "gallery")}>
            <strong>{bn(sectionCounts[1].value)}</strong>
            <span>{sectionCounts[1].label}</span>
          </Link>
          <Link href={clubPath(club.slug, "members")}>
            <strong>{bn(sectionCounts[2].value)}</strong>
            <span>{sectionCounts[2].label}</span>
          </Link>
          <Link href={clubPath(club.slug, "achievements")}>
            <strong>{bn(sectionCounts[3].value)}</strong>
            <span>{sectionCounts[3].label}</span>
          </Link>
        </nav>
      </section>

      <ClubTabs club={club} active="" />

      <div className="club-layout">
        <div className="club-main">
          <section className="club-block">
            <ClubSectionTitle
              eyebrow="ক্যালেন্ডার"
              title="আসন্ন আয়োজন"
              action={
                <a className="text-link section-action" href={clubPath(club.slug, "events")}>
                  সব আয়োজন <ArrowRight size={14} />
                </a>
              }
            />
            <EventList content={{ ...data, events: data.upcomingEvents.slice(0, 3) }} accent={club.accent} />
          </section>

          <section className="club-block">
            <ClubSectionTitle eyebrow="পরিচিতি" title={`${club.name} সম্পর্কে`} />
            {cover ? (
              <div className="club-cover">
                <SmartImage src={cover} alt={club.name} priority transform={{ width: 1500, fit: "cover" }} label={club.name} accent={club.accent} />
              </div>
            ) : null}
            {club.description ? <p className="club-lead">{club.description}</p> : null}
            {historyBlocks.map((block, index) => <p key={index}>{block}</p>)}
            {missionBlocks.length ? (
              <div className="club-mission">
                <Quote size={26} />
                <div>{missionBlocks.map((block, index) => <p key={index}>{block}</p>)}</div>
              </div>
            ) : null}
            <ObjectiveList items={toLines(club.objectives)} />
            <FactGrid club={club} />
          </section>

          <section className="club-block">
            <ClubSectionTitle
              eyebrow="ছবিতে"
              title="গ্যালারি"
              intro={`এ পর্যন্ত ${bn(data.gallery.length)} টি ছবি প্রকাশিত।`}
              action={
                <a className="text-link section-action" href={clubPath(club.slug, "gallery")}>
                  সব ছবি <ArrowRight size={14} />
                </a>
              }
            />
            <GalleryViewer
              columns={4}
              accent={club.accent}
              items={data.gallery.slice(0, 8).map((item) => ({
                src: item.image_url,
                caption: item.caption,
                meta: [item.event_name, formatDate(item.taken_on)].filter(Boolean).join(" · "),
              }))}
            />
          </section>

          {data.members.length || club.coordinator || club.president || club.secretary ? (
            <ClubLeadership club={club} members={data.members} />
          ) : null}

          {data.achievements.length ? (
            <section className="club-block">
              <ClubSectionTitle
                eyebrow="গর্বের বিষয়"
                title="অর্জন"
                action={
                  <a className="text-link section-action" href={clubPath(club.slug, "achievements")}>
                    সব অর্জন <ArrowRight size={14} />
                  </a>
                }
              />
              <AchievementList items={data.achievements.slice(0, 3)} accent={club.accent} />
            </section>
          ) : null}

          {data.posts.length ? (
            <section className="club-block">
              <ClubSectionTitle
                eyebrow="লেখা"
                title="ক্লাবের পত্রিকায়"
                action={
                  <a className="text-link section-action" href={clubPath(club.slug, "posts")}>
                    সব লেখা <ArrowRight size={14} />
                  </a>
                }
              />
              <PostList club={club} posts={data.posts.slice(0, 3)} />
            </section>
          ) : null}

          {data.notices.length ? (
            <section className="club-block">
              <ClubSectionTitle eyebrow="নোটিশ" title="ক্লাবের ঘোষণা" />
              <NoticeList notices={data.notices} />
            </section>
          ) : null}

          {data.news.length ? (
            <section className="club-block">
              <ClubSectionTitle eyebrow="স্কুল সংবাদে" title="খবরে আমরা" />
              <ClubNewsList items={data.news} club={club} />
            </section>
          ) : null}
        </div>

        <aside className="club-aside">
          <div className="club-aside-card club-aside-quick">
            <p><Sparkles size={14} /> দ্রুত লিংক</p>
            <a href={clubPath(club.slug, "events")}><CalendarDays size={14} /> আয়োজনসমূহ</a>
            <a href={clubPath(club.slug, "gallery")}><ArrowUpRight size={14} /> ছবি</a>
            <a href={clubPath(club.slug, "posts")}><BookOpen size={14} /> লেখা</a>
            <a href="/clubs">→ সব ক্লাব</a>
          </div>
          <ClubSidebar club={club} content={data} />
        </aside>
      </div>
    </ClubShell>
  );
}
