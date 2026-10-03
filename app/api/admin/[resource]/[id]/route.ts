import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteRow, deleteWhere, findUniqueConflict, getRow, resolveSlug, updateRow } from "@/lib/db";
import type { ResourceName } from "@/lib/types";
import { resourceSchema } from "@/lib/content-config";
import { buildPayload, validatePayload, validateReferences, clubChildResources } from "../route";

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
    if (!parsed) return NextResponse.json({ error: "অজানা কনটেন্ট টাইপ।" }, { status: 404 });

    const item = await getRow(parsed.resource, parsed.id);
    if (!item) return NextResponse.json({ error: "আইটেমটি খুঁজে পাওয়া যায়নি।" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
    console.error("[admin:read-one]", error);
    return NextResponse.json({ error: "তথ্য লোড করা যায়নি।" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    await requireAdmin();
    const parsed = await parseParams(context);
    if (!parsed) return NextResponse.json({ error: "অজানা কনটেন্ট টাইপ।" }, { status: 404 });
    const { resource, id } = parsed;

    const existing = await getRow(resource, id);
    if (!existing) return NextResponse.json({ error: "আইটেমটি খুঁজে পাওয়া যায়নি।" }, { status: 404 });

    const raw = (await request.json()) as Record<string, unknown>;
    const payload = buildPayload(resource, raw, false);
    if (!Object.keys(payload).length) return NextResponse.json({ error: "পরিবর্তনের মতো কিছু নেই।" }, { status: 422 });

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
    if (!result.updated || !result.row) return NextResponse.json({ error: "আইটেমটি খুঁজে পাওয়া যায়নি।" }, { status: 404 });

    if (resource === "clubs" && payload.slug && String(payload.slug) !== String(existing.slug)) {
      await renameClubSlug(String(existing.slug), String(payload.slug));
    }
    return NextResponse.json({ item: result.row });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
    console.error("[admin:update]", error);
    const message =
      error instanceof Error && /UNIQUE/i.test(error.message)
        ? "এই মানটি আগেই ব্যবহৃত হয়েছে।"
        : "আপডেট করা যায়নি। আবার চেষ্টা করুন।";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    await requireAdmin();
    const parsed = await parseParams(context);
    if (!parsed) return NextResponse.json({ error: "অজানা কনটেন্ট টাইপ।" }, { status: 404 });
    const { resource, id } = parsed;

    const club = resource === "clubs" ? await getRow(resource, id) : null;
    const removed = await deleteRow(resource, id);
    if (!removed) return NextResponse.json({ error: "আইটেমটি খুঁজে পাওয়া যায়নি।" }, { status: 404 });

    let cascade = 0;
    if (club?.slug) {
      const slug = String(club.slug);
      const removedCounts = await Promise.all(clubChildResources.map((child) => deleteWhere(child, "club_slug", slug)));
      cascade = removedCounts.reduce((total, count) => total + count, 0);
    }
    return NextResponse.json({ ok: true, cascade });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
    console.error("[admin:delete]", error);
    return NextResponse.json({ error: "মুছে ফেলা যায়নি।" }, { status: 500 });
  }
}
