import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2 } from "lucide-react";
import { loadClub } from "@/lib/club-loader";
import { clubPath, isClubSection } from "@/lib/club-data";
import { formatDate } from "@/lib/format";
import { ClubShell, ClubSectionTitle } from "@/components/public/ClubShell";
import { AchievementList, EventList, MemberGrid, PostList } from "@/components/public/ClubBlocks";
import { GalleryViewer } from "@/components/public/GalleryViewer";

type ClubSectionPageProps = { params: Promise<{ slug: string; section: string }> };

export const dynamic = "force-dynamic";

const sectionCopy: Record<string, { title: string; intro: string; eyebrow: string }> = {
  events: { eyebrow: "ক্যালেন্ডার", title: "সব আয়োজন", intro: "আসন্ন অনুষ্ঠান, প্রতিযোগিতা ও সম্পন্ন হওয়া আয়োজন — একত্রে।" },
  gallery: { eyebrow: "ছবিতে", title: "ক্লাব গ্যালারি", intro: "আয়োজন, চর্চা আর পুরস্কারের মুহূর্তগুলো।" },
  members: { eyebrow: "মানুষ", title: "কমিটি ও সদস্য", intro: "যাদের হাতে ক্লাবটি এগিয়ে চলে।" },
  achievements: { eyebrow: "গর্বের বিষয়", title: "অর্জনসমূহ", intro: "স্কুল, উপজেলা, জেলা ও জাতীয় পর্যায়ে পাওয়া সাফল্য।" },
  posts: { eyebrow: "প্রকাশনা", title: "লেখা ও রিপোর্ট", intro: "ক্লাবের পত্রিকা, প্রতিবেদন ও শেখার লেখা।" },
};

export async function generateMetadata({ params }: ClubSectionPageProps): Promise<Metadata> {
  const { slug, section } = await params;
  if (!isClubSection(section) || section === "") return { title: "পাতা পাওয়া যায়নি" };
  const loaded = await loadClub(slug);
  if (!loaded) return { title: "ক্লাব পাওয়া যায়নি" };
  const copy = sectionCopy[section];
  return {
    title: `${loaded.club.name} — ${copy?.title ?? section}`,
    description: copy?.intro ?? `${loaded.club.name} ক্লাবের তথ্য।`,
    alternates: { canonical: `https://okgs.info${clubPath(loaded.club.slug, section)}` },
  };
}

export default async function ClubSectionPage({ params }: ClubSectionPageProps) {
  const { slug, section } = await params;
  if (!isClubSection(section) || section === "") notFound();

  const loaded = await loadClub(slug);
  if (!loaded) notFound();
  const { club, data } = loaded;
  const copy = sectionCopy[section];

  const body = (() => {
    if (section === "events") {
      return (
        <div className="club-section-stack">
          <section>
            <h3 className="club-subhead"><CalendarClock size={15} /> আসন্ন ({data.upcomingEvents.length})</h3>
            {data.upcomingEvents.length ? (
              <EventList content={{ ...data, events: data.upcomingEvents }} accent={club.accent} />
            ) : (
              <p className="empty-note">এই মুহূর্তে কোনো আসন্ন আয়োজন নেই। নতুন আয়োজন অ্যাডমিন প্যানেল থেকে যোগ করা যায়।</p>
            )}
          </section>
          {data.pastEvents.length ? (
            <section>
              <h3 className="club-subhead"><CheckCircle2 size={15} /> সম্পন্ন ({data.pastEvents.length})</h3>
              <EventList content={{ ...data, events: data.pastEvents }} accent={club.accent} />
            </section>
          ) : null}
        </div>
      );
    }

    if (section === "gallery") {
      const groups = Array.from(
        data.gallery.reduce((map, item) => {
          const key = item.event_name?.trim() || "বিবিধ";
          const bucket = map.get(key);
          if (bucket) bucket.push(item);
          else map.set(key, [item]);
          return map;
        }, new Map<string, typeof data.gallery>()),
      );
      const asItems = (rows: typeof data.gallery) =>
        rows.map((item) => ({ src: item.image_url, caption: item.caption, meta: item.taken_on ? formatDate(item.taken_on) : undefined }));

      return groups.length > 1 ? (
        <div className="club-section-stack">
          {groups.map(([name, rows]) => (
            <section key={name}>
              <h3 className="club-subhead">{name} <span className="club-subhead-count">{rows.length}</span></h3>
              <GalleryViewer items={asItems(rows)} accent={club.accent} columns={4} />
            </section>
          ))}
        </div>
      ) : (
        <GalleryViewer items={asItems(data.gallery)} accent={club.accent} columns={4} />
      );
    }

    if (section === "members") {
      const officers = data.members.filter((member) => member.role && member.role !== "সদস্য");
      const rest = data.members.filter((member) => !member.role || member.role === "সদস্য");
      return (
        <div className="club-section-stack">
          <section>
            <h3 className="club-subhead">কমিটি ({officers.length})</h3>
            <MemberGrid members={officers} accent={club.accent} />
          </section>
          {rest.length ? (
            <section>
              <h3 className="club-subhead">সদস্য ({rest.length})</h3>
              <MemberGrid members={rest} accent={club.accent} />
            </section>
          ) : null}
        </div>
      );
    }

    if (section === "achievements") {
      return <AchievementList items={data.achievements} accent={club.accent} />;
    }

    return <PostList club={club} posts={data.posts} />;
  })();

  return (
    <ClubShell loaded={loaded} section={section}>
      <div className="club-single">
        <a className="club-back" href={clubPath(club.slug)}><ArrowLeft size={14} /> {club.name} — পরিচিতি</a>
        <ClubSectionTitle eyebrow={copy?.eyebrow ?? club.name} title={copy?.title ?? section} intro={copy?.intro} />
        {body}
      </div>
    </ClubShell>
  );
}
