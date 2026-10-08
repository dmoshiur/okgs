import { defaultFairSlug, fail, num, ok, safeId, staff, str } from "@/lib/api";
import {
  createPass,
  deletePass,
  listPasses,
  logActivity,
  passStats,
  publicUser,
  listUsers,
  scanStats,
  updatePass,
} from "@/lib/portal-db";
import { makePassToken } from "@/lib/qr";
import { allocateGuestPasses, GuestPassLimitError, GuestPassStateError } from "@/lib/pass-guests";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** QR passes — one per person per fair, printable and scannable. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const params = new URL(request.url).searchParams;
  const fairSlug = params.get("fair") || undefined;
  const [passes, stats, scans, candidates] = await Promise.all([
    listPasses({ fair_slug: fairSlug, status: params.get("status") || undefined, limit: num(params.get("limit"), 800) }),
    passStats(fairSlug),
    scanStats(fairSlug),
    listUsers({ limit: 400 }),
  ]);
  return ok({
    passes,
    stats,
    scans,
    candidates: candidates.map((user) => publicUser(user)),
  });
}

/** POST — issue a pass for one user id, or for everybody (optionally one class). */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const fairSlug = str(body.fair_slug) || (await defaultFairSlug());
  const manageGuestPasses = "guest_limit" in body;
  const rawGuestLimit = Number(body.guest_limit ?? 0);
  if (!Number.isInteger(rawGuestLimit) || rawGuestLimit < 0 || rawGuestLimit > 4) return fail("Each student can be allocated 0–4 guest passes.", 422);
  const guestLimit = rawGuestLimit;

  const targets: { id?: string; name: string; role: string; student_id: string; class_level: string; section: string; email: string; phone: string }[] = [];

  if (body.all) {
    const users = await listUsers({
      class_level: str(body.class_level) || undefined,
      section: str(body.section) || undefined,
      limit: 3000,
    });
    for (const user of users) {
      if (user.role !== "student" || Number(user.is_active) !== 1) continue;
      targets.push({
        id: user.id,
        name: user.name,
        role: user.role,
        student_id: user.student_id,
        class_level: user.class_level,
        section: user.section,
        email: user.email,
        phone: user.phone,
      });
    }
  } else {
    targets.push({
      id: str(body.user_id),
      name: str(body.holder_name),
      role: str(body.holder_role, "student") || "student",
      student_id: str(body.student_id).toUpperCase(),
      class_level: str(body.class_level),
      section: str(body.section),
      email: str(body.email),
      phone: str(body.phone),
    });
  }

  const created: { id: string; token: string; holder_name: string; parent_pass_id?: string; guest_index?: number }[] = [];
  for (const target of targets) {
    if (!target.name) continue;
    let parent = target.id ? (await listPasses({ fair_slug: fairSlug, user_id: target.id, limit: 1 }))[0] : undefined;
    if (!parent) {
      const pass = await createPass({
        fair_slug: fairSlug,
        user_id: target.id ?? "",
        holder_name: target.name,
        holder_role: target.role,
        student_id: target.student_id,
        class_level: target.class_level,
        section: target.section,
        email: target.email,
        phone: target.phone,
        token: "",
        guest_limit: manageGuestPasses ? guestLimit : 0,
        expires_at: str(body.expires_at),
        note: str(body.note),
      });
      const token = makePassToken(pass.id);
      await db.execute({ sql: `UPDATE passes SET token = ?, updated_at = ? WHERE id = ?`, args: [token, new Date().toISOString(), pass.id] });
      parent = { ...pass, token };
    }
    created.push({ id: parent.id, token: parent.token, holder_name: parent.holder_name });
    if (manageGuestPasses) {
      try {
        const allocated = await allocateGuestPasses(parent, guestLimit);
        for (const guest of allocated.guests) created.push({ id: guest.id, token: guest.token, holder_name: guest.holder_name, parent_pass_id: parent.id, guest_index: guest.guest_index });
      } catch (error) {
        if (error instanceof GuestPassLimitError) return fail(`Guest pass count cannot be reduced; ${error.message.split(":").at(-1)} passes have already been issued.`, 422);
        if (error instanceof GuestPassStateError) return fail(error.message, 409);
        throw error;
      }
    }
  }

  if (!created.length) return fail("No passes would be created — check the input.", 422);
  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "pass.issue",
    entity: "passes",
    detail: `${created.length} QR passes`,
  });
  return ok({ created }, 201);
}

export async function PATCH(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("Invalid ID.", 422);
  await updatePass(id, {
    ...(("status" in body) ? { status: str(body.status) } : {}),
    ...(("note" in body) ? { note: str(body.note) } : {}),
    ...(("expires_at" in body) ? { expires_at: str(body.expires_at) } : {}),
    ...(("holder_name" in body) ? { holder_name: str(body.holder_name) } : {}),
  });
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "pass.update", entity: "passes", entity_id: id, detail: str(body.status) });
  return ok({ updated: true });
}

export async function DELETE(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  if (guard.session.role !== "admin" && guard.session.role !== "superadmin") return fail("Admin rights are required to delete a pass — you can revoke it instead.", 403);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("Invalid ID.", 422);
  const removed = await deletePass(id);
  return ok({ deleted: removed });
}
