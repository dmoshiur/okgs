import { defaultFairSlug, fail, ok, staff, str } from "@/lib/api";
import { getPassById, getPassByToken, listPasses, logActivity, recordScan, updatePass, updateUser } from "@/lib/portal-db";
import { createPass } from "@/lib/portal-db";
import { extractToken, makeEntryToken, makePassToken, parseEntryToken, parsePassToken } from "@/lib/qr";
import { getRow, updateRow } from "@/lib/db";
import type { FairCollection } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff/scan — the moment of truth.
 *
 * The teacher's phone posts whatever the camera read (a raw token, a
 * `/pass/<token>` URL or a full https URL). We verify the HMAC first, then the
 * pass's own state, log the attempt, and answer with a colour the UI can flash.
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = str(body.token || body.value || body.qr);
  if (!raw) return fail("Could not read the QR — scan again.", 422);

  const token = extractToken(raw);

  // A fair *entry* QR (project label) — verify the entry instead of a pass.
  const entry = parseEntryToken(token);
  if (entry) {
    const row = (await getRow("fair_collections", entry.id)) as unknown as FairCollection | null;
    if (!row) {
      await recordScan({ token, scanned_by: session.user.id, scanned_by_name: session.user.name, result: "invalid", note: "Project not found" });
      return ok({ result: "invalid", tone: "danger", title: "No project", message: "No collection item matches this QR." });
    }
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const verifiedLine = `QR Verified ✓ ${stamp} · ${session.user.name}`;
    if (!String(row.note || "").includes(verifiedLine)) {
      await updateRow("fair_collections", row.id, { note: [String(row.note || "").trim(), verifiedLine].filter(Boolean).join("\n") });
    }
    await recordScan({
      token,
      fair_slug: row.fair_slug,
      scanned_by: session.user.id,
      scanned_by_name: session.user.name,
      result: "ok",
      note: `Project Verified: ${row.title}`,
    });
    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: "entry.scan",
      entity: "fair_collections",
      entity_id: row.id,
      detail: row.title,
    });
    return ok({
      result: "ok",
      tone: "success",
      title: "Project verified ✓",
      message: `${row.title} — ${row.student_name || "Student"} ${row.class_level ? `· ${row.class_level}` : ""}${row.section ? ` (Section ${row.section})` : ""}`,
      entry: { id: row.id, title: row.title, category: row.category, status: row.status, student_name: row.student_name, class_level: row.class_level, section: row.section },
    });
  }

  const parsed = parsePassToken(token);

  if (!parsed) {
    await recordScan({ token: raw.slice(0, 120), scanned_by: session.user.id, scanned_by_name: session.user.name, result: "invalid", note: "HMAC mismatch" });
    return ok({
      result: "invalid",
      tone: "danger",
      title: "Invalid QR",
      message: "This QR code does not belong to our system. Check the card in hand.",
    });
  }

  let pass = await getPassByToken(token);
  if (!pass) {
    pass = await getPassById(parsed.id);
  }
  if (!pass) {
    await recordScan({ token, scanned_by: session.user.id, scanned_by_name: session.user.name, result: "invalid", note: "Pass not found" });
    return ok({ result: "invalid", tone: "danger", title: "No pass", message: "No pass matches this token." });
  }

  if (pass.status === "revoked") {
    await recordScan({ pass_id: pass.id, token, fair_slug: pass.fair_slug, scanned_by: session.user.id, scanned_by_name: session.user.name, result: "revoked" });
    return ok({ result: "revoked", tone: "danger", title: "Revoked pass", message: `${pass.holder_name}'s pass has been revoked.`, pass });
  }

  if (pass.expires_at && pass.expires_at < new Date().toISOString().slice(0, 10)) {
    await recordScan({ pass_id: pass.id, token, fair_slug: pass.fair_slug, scanned_by: session.user.id, scanned_by_name: session.user.name, result: "expired" });
    return ok({ result: "expired", tone: "warn", title: "Expired", message: "This pass has expired.", pass });
  }

  const alreadyInside = Number(pass.scan_count) > 0 && pass.status === "used";
  const nowIso = new Date().toISOString();
  await updatePass(pass.id, {
    status: "used",
    scan_count: Number(pass.scan_count) + 1,
    last_scan_at: nowIso,
  });
  await recordScan({
    pass_id: pass.id,
    token,
    fair_slug: pass.fair_slug,
    scanned_by: session.user.id,
    scanned_by_name: session.user.name,
    result: alreadyInside ? "duplicate" : "ok",
    note: alreadyInside ? "Scanned again" : "Verified",
  });
  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "pass.scan",
    entity: "passes",
    entity_id: pass.id,
    detail: `${pass.holder_name} · ${alreadyInside ? "again" : "success"}`,
  });

  return ok({
    result: alreadyInside ? "duplicate" : "ok",
    tone: alreadyInside ? "warn" : "success",
    title: alreadyInside ? "Already admitted" : "Verified ✓",
    message: alreadyInside
      ? `${pass.holder_name}'s pass was already scanned (${Number(pass.scan_count) + 1} times).`
      : `${pass.holder_name} — ${pass.class_level || pass.holder_role} ${pass.section ? `(Section ${pass.section})` : ""}`,
    pass: { ...pass, scan_count: Number(pass.scan_count) + 1, status: "used", last_scan_at: nowIso },
  });
}

/** GET /api/staff/scan?fair= — recent scans for the live scan feed. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const fairSlug = new URL(request.url).searchParams.get("fair") || undefined;
  const passes = await listPasses({ fair_slug: fairSlug, limit: 20 });
  const { listScans, scanStats } = await import("@/lib/portal-db");
  const [scans, stats] = await Promise.all([listScans({ fair_slug: fairSlug, limit: 40 }), scanStats(fairSlug)]);
  return ok({ scans, stats, recentPasses: passes });
}

/**
 * PUT — mint a pass for somebody who has no account (a guest or a walk-in judge)
 * and return the token the browser can render as a QR.
 */
export async function PUT(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const holder = str(body.holder_name);
  if (!holder) return fail("Enter the name the card should be issued to.", 422);
  const fairSlug = str(body.fair_slug) || (await defaultFairSlug());
  const pass = await createPass({
    fair_slug: fairSlug,
    holder_name: holder,
    holder_role: str(body.holder_role, "guest") || "guest",
    class_level: str(body.class_level),
    section: str(body.section),
    phone: str(body.phone),
    email: str(body.email),
    token: "",
    expires_at: str(body.expires_at),
    note: str(body.note),
  });
  const token = makePassToken(pass.id);
  await updatePass(pass.id, {});
  const { db } = await import("@/lib/db");
  await db.execute({ sql: `UPDATE passes SET token = ? WHERE id = ?`, args: [token, pass.id] });
  if (str(body.link_user)) await updateUser(str(body.link_user), {});
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "pass.create", entity: "passes", entity_id: pass.id, detail: holder });
  return ok({ pass: { ...pass, token }, token, url: `/pass/${token}` }, 201);
}
