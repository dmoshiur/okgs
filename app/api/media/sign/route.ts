import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { isAdmin } from "@/lib/auth";
import { asciiPublicId, cloudinaryServerSettings, cloudinarySettings, signedUpload } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

/**
 * POST /api/media/sign
 *
 * Returns a short-lived Cloudinary signature so the browser can upload straight
 * to Cloudinary without ever seeing the API secret. Available to any signed-in
 * admin, teacher or club admin; `folder` is namespaced so one club can never
 * write into another club's folder.
 */
export async function POST(request: Request) {
  const session = await getPortalSession();
  const admin = await isAdmin().catch(() => false);
  if (!session && !admin) {
    return NextResponse.json({ ok: false, error: "ছবি আপলোড করতে লগইন দরকার।" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const server = cloudinaryServerSettings();
  const legacy = cloudinarySettings();
  const prefix = String(body.folder ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "");
  const label = String(body.label ?? body.name ?? "");

  // Scope: a club admin may only write inside its own club folder.
  const clubSlug = session?.user?.club_slug || "";
  const scopedPrefix = clubSlug
    ? [clubSlug, prefix.replace(new RegExp(`^${clubSlug}/?`), "")].filter(Boolean).join("/")
    : prefix;

  if (!server.enabled) {
    // No API key/secret yet — tell the client to fall back to the unsigned preset
    // (or explain what is missing so the admin can finish the setup).
    return NextResponse.json({
      ok: true,
      mode: "unsigned",
      cloudName: legacy.cloudName,
      uploadPreset: legacy.uploadPreset,
      folder: [legacy.folder, scopedPrefix].filter(Boolean).join("/"),
      enabled: legacy.enabled,
      endpoint: legacy.cloudName ? `https://api.cloudinary.com/v1_1/${legacy.cloudName}/image/upload` : "",
      maxBytes: server.maxBytes,
      hint: "CLOUDINARY_API_KEY ও CLOUDINARY_API_SECRET যোগ করলে অ্যাপ নিজেই স্বাক্ষর (signed upload) করবে।",
    });
  }

  const upload = signedUpload(server, {
    folder: scopedPrefix,
    publicId: label ? asciiPublicId(label) : "",
    tags: [clubSlug || "okgs"].filter(Boolean),
  });

  return NextResponse.json({ ok: true, mode: "signed", enabled: true, ...upload });
}
