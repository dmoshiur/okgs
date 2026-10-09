import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/roles";
import { deleteRow, deleteWhere, findUniqueConflict, getRow, resolveSlug, updateRow } from "@/lib/db";
import type { ResourceName } from "@/lib/types";
import { resourceSchema } from "@/lib/content-config";
import { buildPayload, validatePayload, validateReferences, clubChildResources } from "../route";
import { sendAnnouncementEmail } from "@/lib/announcements";
import { publicPathsFor, revalidatePublicSite } from "@/lib/revalidate";
import { renameClubSiteOverride, renameFairSlug } from "@/lib/site";

const knownResources = new Set<string>(Object.keys(resourceSchema));

function unauthorized(error: unknown) {
  return error instanceof Error && error.message === "UNAUTHORIZED";
}

async function parseParams(context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  if (!knownResources.has(resource)) return null;
  return { resource: resource as ResourceName, id: decodeURIComponent(id) };
}

/** Re-point every club-scoped row (plus tagged news/notices) when a club slug is renamed. */
async function renameClubSlug(from: string, to: string) {
  if (!from || from === to) return;
  const { db } = await import("@/lib/db");
  await Promise.all(
    [...clubChildResources, "news", "notices"].map((resource) =>
      db.execute({ sql: `UPDATE "${resource}" SET "club_slug" = ? WHERE "club_slug" = ?`, args: [to, from] }),
    ),
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    await requireAdmin();
    const parsed = await parseParams(context);
    if (!parsed) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });

    const item = await getRow(parsed.resource, parsed.id);
    if (!item) return NextResponse.json({ error: "That entry could not be found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    console.error("[admin:read-one]", error);
    return NextResponse.json({ error: "The data could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const session = await requireAdmin();
    const parsed = await parseParams(context);
    if (!parsed) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
    const { resource, id } = parsed;
    if (resource === "settings" && !isSuperAdminRole(session.role)) {
      return NextResponse.json({ error: "Only a SuperAdmin can change site settings." }, { status: 403 });
    }

    const existing = await getRow(resource, id);
    if (!existing) return NextResponse.json({ error: "That entry could not be found." }, { status: 404 });

    const raw = (await request.json()) as Record<string, unknown>;
    const payload = buildPayload(resource, raw, false);
    if (!Object.keys(payload).length) return NextResponse.json({ error: "There is nothing to update." }, { status: 422 });

    // Guards duplicate slugs (409) and generates one when it was cleared.
    const slugProblem = await resolveSlug(resource, payload, id);
    if (slugProblem) return NextResponse.json(slugProblem, { status: slugProblem.status });

    const problem = validatePayload(resource, payload);
    if (problem) return NextResponse.json(problem, { status: problem.status });

    const referenceProblem = await validateReferences(resource, payload);
    if (referenceProblem) return NextResponse.json(referenceProblem, { status: referenceProblem.status });

    const clash = await findUniqueConflict(resource, payload, id);
    if (clash) return NextResponse.json(clash, { status: clash.status });

    const result = await updateRow(resource, id, payload);
    if (!result.updated || !result.row) return NextResponse.json({ error: "That entry could not be found." }, { status: 404 });

    // A renamed slug must move with everything that points at it, or the public
    // routes keep resolving the old address (and the old, stale record).
    if (resource === "clubs" && payload.slug && String(payload.slug) !== String(existing.slug)) {
      await renameClubSlug(String(existing.slug), String(payload.slug));
      await renameClubSiteOverride(String(existing.slug), String(payload.slug));
    }
    if (resource === "fairs" && payload.slug && String(payload.slug) !== String(existing.slug)) {
      await renameFairSlug(String(existing.slug), String(payload.slug));
    }
    let notification = null;
    if (
      ["notices", "news", "updates"].includes(resource) &&
      Number(existing.is_active) !== 1 && Number(result.row.is_active) === 1 &&
      Number(result.row.email_notify) === 1
    ) {
      try {
        notification = await sendAnnouncementEmail(resource as "notices" | "news" | "updates", result.row, new URL(request.url).origin);
      } catch (error) {
        console.error("[announcement:mail]", error);
        notification = { attempted: 0, delivered: 0, failed: 0, configured: false, error: "MAIL_SEND_FAILED" };
      }
    }
    // Every save — not just fairs/settings/themes — changes a public page, so the
    // whole public tree is revalidated and the affected routes are named as well.
    revalidatePublicSite([...publicPathsFor(resource, result.row as unknown as Record<string, unknown>), ...publicPathsFor(resource, existing as unknown as Record<string, unknown>)]);
    return NextResponse.json({ success: true, message: ["fairs", "settings", "themes"].includes(resource) ? "Settings updated" : "Entry updated", item: result.row, notification });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    console.error("[admin:update]", error);
    const message =
      error instanceof Error && /UNIQUE/i.test(error.message)
        ? "That value is already in use."
        : "Could not update. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const session = await requireAdmin();
    const parsed = await parseParams(context);
    if (!parsed) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
    const { resource, id } = parsed;
    if (resource === "settings" && !isSuperAdminRole(session.role)) {
      return NextResponse.json({ error: "Only a SuperAdmin can change site settings." }, { status: 403 });
    }

    // Read the row *before* deleting it — its slug is what the public routes are
    // addressed by, and it is gone once the delete has run.
    const victim = await getRow(resource, id);
    if (!victim) return NextResponse.json({ error: "That entry could not be found." }, { status: 404 });
    const removed = await deleteRow(resource, id);
    if (!removed) return NextResponse.json({ error: "That entry could not be found." }, { status: 404 });

    let cascade = 0;
    const club = resource === "clubs" ? victim : null;
    if (club?.slug) {
      const slug = String(club.slug);
      const removedCounts = await Promise.all(clubChildResources.map((child) => deleteWhere(child, "club_slug", slug)));
      cascade = removedCounts.reduce((total, count) => total + count, 0);
      // Drop the club's saved micro-site override too, so re-creating the slug
      // later starts clean instead of inheriting a dead club's copy.
      const { db } = await import("@/lib/db");
      await db.execute({ sql: `DELETE FROM "settings" WHERE "key" = ?`, args: [`club_site:${slug}`] });
    }

    revalidatePublicSite(publicPathsFor(resource, victim as unknown as Record<string, unknown> | null));
    return NextResponse.json({ ok: true, cascade });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    console.error("[admin:delete]", error);
    return NextResponse.json({ error: "Could not delete the entry." }, { status: 500 });
  }
}
