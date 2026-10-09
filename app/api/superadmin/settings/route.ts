/**
 * /api/superadmin/settings — dynamic site metadata (SuperAdmin only).
 *
 * GET  → the editable identity block + its current values
 * PUT  → validate, then persist every submitted key into the `settings` table
 *
 * Because the public pages read the same rows on every render (the site is
 * fully dynamic), saving here changes the header, the footer, the metadata, the
 * favicon and the JSON-LD card sitewide — with no redeploy and no code edit.
 */
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { loadSiteSettings, saveSiteIdentity, siteSettingFields } from "@/lib/site-settings";
import { logActivity } from "@/lib/portal-db";

export const dynamic = "force-dynamic";

function authProblem(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Sign in required.", errorEn: "Sign in required." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json(
      { error: "শুধু সুপার অ্যাডমিন সাইট সেটিং বদলাতে পারেন।", errorEn: "Only a SuperAdmin can change site settings." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const { values, identity } = await loadSiteSettings();
    return NextResponse.json({ ok: true, values, identity, fields: siteSettingFields });
  } catch (error) {
    const problem = authProblem(error);
    if (problem) return problem;
    console.error("[superadmin:settings:get]", error);
    return NextResponse.json({ error: "সেটিং লোড করা যায়নি।", errorEn: "Settings could not be loaded." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const values = (body.values ?? body) as Record<string, unknown>;

    // URLs must be complete — the public pages render them straight into src/href.
    for (const field of siteSettingFields) {
      if (!(field.key in values)) continue;
      const value = String(values[field.key] ?? "").trim();
      if ((field.kind === "url" || field.kind === "image") && value && !/^(https?:\/\/|\/)/i.test(value)) {
        return NextResponse.json(
          {
            error: `“${field.label}” — সম্পূর্ণ লিংক দিন (https:// দিয়ে শুরু)।`,
            errorEn: `“${field.label}” needs a full URL starting with https://`,
            field: field.key,
          },
          { status: 422 },
        );
      }
      if (field.kind === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        return NextResponse.json(
          { error: `“${field.label}” ইমেইল ঠিকানা সঠিক নয়।`, errorEn: `“${field.label}” is not a valid email address.`, field: field.key },
          { status: 422 },
        );
      }
      if (field.kind === "url" || field.kind === "image") values[field.key] = value;
    }

    const written = await saveSiteIdentity(values);
    if (!written.length) {
      return NextResponse.json({ error: "Nothing to save.", errorEn: "Nothing to save." }, { status: 422 });
    }

    await logActivity({
      actor_id: session.id,
      actor_name: session.name,
      actor_role: session.role,
      action: "site.settings",
      entity: "settings",
      entity_id: written.join(","),
      detail: `updated: ${written.join(", ")}`,
    });

    revalidatePath("/", "layout");
    const { values: fresh } = await loadSiteSettings();
    return NextResponse.json({ ok: true, success: true, saved: written, values: fresh, message: "Settings updated" });
  } catch (error) {
    const problem = authProblem(error);
    if (problem) return problem;
    console.error("[superadmin:settings:put]", error);
    return NextResponse.json(
      { error: "সেটিং সংরক্ষণ করা যায়নি।", errorEn: "The settings could not be saved." },
      { status: 500 },
    );
  }
}
