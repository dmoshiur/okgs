import { Facebook, Mail, Phone, UserRound } from "lucide-react";
import type { Club, ClubMember } from "@/lib/types";
import { leadershipRoles } from "@/lib/content-config";
import { SmartImage } from "@/components/public/Media";
import { initialsOf } from "@/lib/format";

const roleOrder = [
  "প্রধান পৃষ্ঠপোষক",
  "উপদেষ্টা",
  "সভাপতি",
  "সহ-সভাপতি",
  "সাধারণ সম্পাদক",
  "যুগ্ম সম্পাদক",
  "সাংগঠনিক সম্পাদক",
  "দপ্তর সম্পাদক",
  "প্রচার সম্পাদক",
  "তহবিল সম্পাদক",
  "নির্বাহী সদস্য",
  "সদস্য",
];

export function sortCommittee(members: ClubMember[]) {
  return [...members].sort((a, b) => {
    const ai = roleOrder.indexOf(a.role);
    const bi = roleOrder.indexOf(b.role);
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
  });
}

/** The four office bearers a club page leads with (president → joint secretary). */
export function ClubLeadership({ club, members }: { club: Club; members: ClubMember[] }) {
  const ordered = sortCommittee(members);
  const leaders = ordered.filter((member) => leadershipRoles.includes(member.role)).slice(0, 4);
  const rest = ordered.filter((member) => !leaders.includes(member));

  // Advisors/coordinators are the fallback until student names are filled in.
  const fallbacks: { role: string; name: string; note?: string }[] = [
    club.coordinator ? { role: "উপদেষ্টা শিক্ষক", name: club.coordinator, note: club.coordinator_phone } : null,
    club.president ? { role: "সভাপতি", name: club.president } : null,
    club.vice_president ? { role: "সহ-সভাপতি", name: club.vice_president } : null,
    club.secretary ? { role: "সাধারণ সম্পাদক", name: club.secretary } : null,
    club.vice_secretary ? { role: "যুগ্ম সম্পাদক", name: club.vice_secretary } : null,
  ].filter(Boolean) as { role: string; name: string; note?: string }[];

  const cards = leaders.length
    ? leaders.map((member) => ({
        id: member.id,
        role: member.role,
        name: member.name,
        className: [member.class_room, member.section ? `শাখা ${member.section}` : ""].filter(Boolean).join(" · "),
        photo: member.photo_url,
        bio: member.bio || member.achievement,
        phone: member.phone,
        email: member.email,
        facebook: member.facebook_url,
      }))
    : fallbacks.map((item) => ({
        id: item.name,
        role: item.role,
        name: item.name,
        className: item.note ?? "",
        photo: "",
        bio: "",
        phone: item.note ?? "",
        email: "",
        facebook: "",
      }));

  return (
    <section className="v2-sec" id="leadership" style={{ paddingTop: 40 }}>
      <div className="v2-sec-head">
        <div>
          <p className="v2-chip v2-chip-accent"><UserRound size={14} /> কার্যনির্বাহী পরিষদ</p>
          <h2>নেতৃত্বে যারা</h2>
          <p>সভাপতি, সহ-সভাপতি, সাধারণ সম্পাদক ও যুগ্ম সম্পাদকের ছবি ও পরিচিতি — সব তথ্য অ্যাডমিন প্যানেল থেকে হালনাগাদযোগ্য।</p>
        </div>
        <span className="v2-chip">{club.name_en || club.name}</span>
      </div>

      <div className="leader-grid">
        {cards.length ? (
          cards.map((card) => (
            <article className="leader-card" key={card.id}>
              {card.photo ? (
                <SmartImage className="leader-photo" src={card.photo} alt={card.name} transform={{ width: 260, height: 260, fit: "cover" }} />
              ) : (
                <span className="leader-initials">{initialsOf(card.name)}</span>
              )}
              <h3>{card.name}</h3>
              <span className="leader-role">{card.role}</span>
              {card.className ? <p className="v2-muted" style={{ margin: "0 0 6px", fontSize: 13 }}>{card.className}</p> : null}
              {card.bio ? <p className="v2-muted" style={{ margin: 0, fontSize: 13 }}>{card.bio}</p> : null}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 10 }}>
                {card.phone ? <a className="v2-chip" href={`tel:${card.phone}`}><Phone size={13} /> {card.phone}</a> : null}
                {card.email ? <a className="v2-chip" href={`mailto:${card.email}`}><Mail size={13} /></a> : null}
                {card.facebook ? <a className="v2-chip" href={card.facebook} target="_blank" rel="noreferrer noopener"><Facebook size={13} /></a> : null}
              </div>
            </article>
          ))
        ) : (
          <p className="v2-muted">
            কমিটির তথ্য এখনো যোগ করা হয়নি। অ্যাডমিন প্যানেল → ক্লাব সদস্য থেকে ছবি ও নাম যোগ করলেই এখানে দেখা যাবে।
          </p>
        )}
      </div>

      {rest.length ? (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ marginBottom: 12 }}>কমিটি ও সদস্য</h3>
          <div className="committee-grid">
            {rest.map((member) => (
              <article className="committee-card" key={member.id}>
                {member.photo_url ? (
                  <SmartImage src={member.photo_url} alt={member.name} transform={{ width: 140, height: 140, fit: "cover" }} />
                ) : (
                  <span className="committee-initials">{initialsOf(member.name)}</span>
                )}
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 15 }}>{member.name}</strong>
                  <span className="v2-muted" style={{ fontSize: 12.5 }}>{member.role}{member.class_room ? ` · ${member.class_room}` : ""}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
