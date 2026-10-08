import { fail, ok, staff, str } from "@/lib/api";
import { fairPreferenceCookieHeader } from "@/lib/sf-preference";
import { fairSlugs } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff/fair-preference — { slug }
 *
 * Remembers which fair the signed-in administrator is working on. The value is
 * checked against the fairs table before it is accepted and is stored in a cookie,
 * so every panel route (console, scanner, ticket preview) opens the same fair.
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const slug = str(body.slug);
  const slugs = await fairSlugs();
  if (slug && !slugs.includes(slug)) return fail("That fair does not exist. Refresh the page and choose it again.", 422);

  const response = ok({ slug });
  response.headers.append("Set-Cookie", fairPreferenceCookieHeader(slug));
  return response;
}
