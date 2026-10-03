import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { cloudinarySettings } from "@/lib/cloudinary";

/**
 * GET /api/media/config
 * Only an admin can read this. The unsigned preset is safe to expose to the
 * browser (that is how unsigned uploads work) but we still keep it server-side
 * so nothing leaks to the public bundle.
 */
export async function GET() {
  try {
    await requireAdmin();
    const settings = cloudinarySettings();
    return NextResponse.json({
      enabled: settings.enabled,
      cloudName: settings.cloudName,
      uploadPreset: settings.uploadPreset,
      folder: settings.folder,
      endpoint: settings.enabled ? `https://api.cloudinary.com/v1_1/${settings.cloudName}/image/upload` : "",
      maxBytes: Number(process.env.CLOUDINARY_MAX_BYTES || 12 * 1024 * 1024),
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
