import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { isAdmin } from "@/lib/auth";
import { mediaUploadTicket } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

/**
 * POST /api/media/sign
 *
 * Returns a short-lived Cloudinary signature so the browser can upload straight
 * to Cloudinary without ever seeing the API secret. Available to any signed-in
 * admin, teacher or club admin; `folder` is namespaced so one club can never
 * write into another club's folder.
 *
 * The response carries `params` — the exact parameter set the signature covers.
 * The client posts those verbatim (plus `file`, `api_key` and `signature`), so
 * every parameter Cloudinary validates is signed with the matching value.
 */
export async function POST(request: Request) {
  const session = await getPortalSession();
  const admin = await isAdmin().catch(() => false);
  if (!session && !admin) {
    return NextResponse.json({ ok: false, error: "ছবি আপলোড করতে লগইন দরকার।" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const clubSlug = session?.user?.club_slug || "";

  const ticket = mediaUploadTicket({
    clubSlug,
    folder: typeof body.folder === "string" ? body.folder : "",
    // `tags`, `label` and `fileName` are signed too — the browser must post
    // exactly what comes back (see lib/upload-client.ts).
    tags: body.tags as string[] | string | undefined,
    label: String(body.label ?? body.name ?? ""),
    fileName: String(body.fileName ?? ""),
  });

  return NextResponse.json({ ok: true, ...ticket });
}
