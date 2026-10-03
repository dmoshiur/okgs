import { getPublicContent } from "@/lib/db";
import { buildClubContent, findClub } from "@/lib/club-data";
import type { Club, ClubContent, PublicContent } from "@/lib/types";

export interface LoadedClub {
  content: PublicContent;
  club: Club;
  data: ClubContent;
}

/** One database read per request, shared by every club route. */
export async function loadClub(slug: string): Promise<LoadedClub | null> {
  const content = await getPublicContent();
  const club = findClub(content, slug);
  if (!club) return null;
  return { content, club, data: buildClubContent(content, club) };
}
