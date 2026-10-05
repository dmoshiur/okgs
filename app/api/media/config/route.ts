import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { cloudinaryServerSettings, cloudinarySettings } from "@/lib/cloudinary";

/**
 * GET /api/media/config
 * Only an admin can read this. The unsigned preset is safe to expose to the
 * browser (that is how unsigned uploads work) but we still keep it server-side
 * so nothing leaks to the public bundle.
 *
 * `enabled` is true when *either* path can upload: server-side signatures
 * (API key + secret) or the legacy unsigned preset. `signed` tells the UI which
 * one is active — a signed-only setup has no preset, and the studio used to
 * report it as "not configured" even though uploads worked.
 */
export async function GET() {
  try {
    await requireAdmin();
    const preset = cloudinarySettings();
    const server = cloudinaryServerSettings();
    const cloudName = server.cloudName || preset.cloudName;
    return NextResponse.json({
      enabled: server.enabled || preset.enabled,
      signed: server.enabled,
      cloudName,
      uploadPreset: preset.uploadPreset,
      folder: preset.folder,
      endpoint: cloudName ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload` : "",
      maxBytes: server.maxBytes,
      accept: "image/*",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
    }
    console.error("[media:config]", error);
    return NextResponse.json({ error: "মিডিয়া সেটিংস পাওয়া যায়নি।" }, { status: 500 });
  }
}
