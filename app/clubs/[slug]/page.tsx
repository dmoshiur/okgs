import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { loadClub } from "@/lib/club-loader";
import { clubPath } from "@/lib/club-data";
import { paragraphs, toLines } from "@/lib/content-config";
import { bn, formatDate } from "@/lib/format";
import { ClubShell, ClubSectionTitle } from "@/components/public/ClubShell";
import {
  AchievementList,
  ClubSidebar,
  EventList,
  FactGrid,
  MemberGrid,
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
      <section className="v2 club-hero">
        {cover ? <SmartImage className="club-hero-bg" src={cover} alt={club.name} priority transform={{ width: 1800, fit: "cover" }} /> : null}
        <div className="v2-wrap club-hero-inner">
          <div>
            <p className="v2-chip" style={{ background: "rgba(255,255,255,.18)", color: "#fff", borderColor: "rgba(255,255,255,.32)" }}>
              {club.short_code ? `${club.short_code} · ` : ""}
              {club.motto || club.tagline || "ক্লাব"}
            </p>
            <h1>{club.name}</h1>
            <p className="club-en">{club.name_en}</p>
            {club.description ? <p style={{ maxWidth: "62ch", opacity: 0.9, margin: 0 }}>{club.description}</p> : null}
            <div className="club-hero-actions">
              <Link className="v2-btn" href={`/clubs/${club.slug}/site`}>
                <Sparkles size={16} /> ক্লাব সাইট
              </Link>
              <Link className="v2-btn v2-btn-ghost" href={`/clubs/${club.slug}/admin`}>
                <ShieldCheck size={16} /> ক্লাব অ্যাডমিন
              </Link>
              {club.domain || club.subdomain ? (
                <a className="v2-btn v2-btn-ghost" href={club.domain || club.subdomain} target="_blank" rel="noreferrer noopener">
                  ক্লাবের নিজস্ব সাইট <ArrowUpRight size={16} />
                </a>
              ) : null}
              {club.facebook_url ? (
                <a className="v2-btn v2-btn-ghost" href={club.facebook_url} target="_blank" rel="noreferrer noopener">
                  ফেসবুক পেজ
                </a>
              ) : null}
              {club.email ? (
                <a className="v2-btn v2-btn-ghost" href={`mailto:${club.email}`}>
                  {club.email}
                </a>
              ) : null}
            </div>
            <div className="club-stats" style={{ marginTop: 22 }}>
              {sectionCounts.map((item) => (
                <div className="club-stat" key={item.label} style={{ background: "rgba(255,255,255,.14)", borderColor: "rgba(255,255,255,.24)", color: "#fff" }}>
                  <span style={{ color: "rgba(255,255,255,.78)" }}>{item.label}</span>
                  <strong>{bn(item.value)}</strong>
                </div>
              ))}
            </div>
          </div>
          {club.logo_url ? <SmartImage className="club-hero-logo" src={club.logo_url} alt={`${club.name} লোগো`} transform={{ width: 260 }} /> : null}
        </div>
      </section>

      <ClubLeadership club={club} members={data.members} />

      <div className="club-layout">
        <div className="club-main">
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

          {data.members.length ? (
            <section className="club-block">
              <ClubSectionTitle
                eyebrow="কমিটি"
                title="যারা এগিয়ে নেন"
                action={
                  <a className="text-link section-action" href={clubPath(club.slug, "members")}>
                    সব সদস্য <ArrowRight size={14} />
                  </a>
                }
              />
              <MemberGrid members={data.members.slice(0, 4)} accent={club.accent} />
            </section>
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
