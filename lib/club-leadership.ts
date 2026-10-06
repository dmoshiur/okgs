/**
 * Leadership strip rules for a club site — pure, so both the server and the
 * studio's live preview can build the same cards from the same data.
 *
 * Admin-added leaders win over database members; a person never appears twice;
 * cards are ordered by the club's own protocol order and anything unexpected
 * falls to the end.
 */
import type { ClubMember } from "@/lib/types";

export interface ClubLeaderCard {
  name: string;
  role: string;
  class_level?: string;
  section?: string;
  phone?: string;
  email?: string;
  facebook?: string;
  photo_url?: string;
  bio?: string;
}

/** Leadership roles shown as photo cards, in order. */
export const leadershipOrder = [
  "সভাপতি",
  "সহ-সভাপতি",
  "সাধারণ সম্পাদক",
  "যুগ্ম সম্পাদক",
  "সাংগঠনিক সম্পাদক",
  "কোষাধ্যক্ষ",
  "প্রচার সম্পাদক",
  "শিক্ষক-পরামর্শক",
];

export function leadershipCards(site: {
  customized?: boolean;
  leaders?: ClubLeaderCard[];
  members?: ClubMember[];
}): ClubLeaderCard[] {
  const fromOverride = (site.customized ? site.leaders : []) || [];
  const fromDb: ClubLeaderCard[] = (site.members || [])
    .filter((member) => member.role && member.role !== "সদস্য")
    .map((member) => ({
      name: member.name,
      role: member.role,
      class_level: member.class_room,
      section: member.section,
      phone: member.phone,
      email: member.email,
      facebook: member.facebook_url,
      photo_url: member.photo_url,
      bio: member.bio || member.achievement,
    }));

  const seen = new Set<string>();
  const merged = [...fromOverride, ...fromDb].filter((card) => {
    const key = `${card.name}|${card.role}`;
    if (!card.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return merged.sort((a, b) => {
    const ai = leadershipOrder.indexOf(a.role);
    const bi = leadershipOrder.indexOf(b.role);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}
