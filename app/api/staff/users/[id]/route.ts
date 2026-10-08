import { defaultFairSlug, fail, ok, safeId, staff, str } from "@/lib/api";
import { deleteUser, getUser, listClasses, logActivity, publicUser, syncClassFeeDues, updateUser, type PortalRole } from "@/lib/portal-db";
import { allRoles } from "@/lib/portal-db";
import { hashPassword } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

/** PATCH /api/staff/users/:id — edit profile, toggle active, set password. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const { id } = await context.params;
  if (!safeId(id)) return fail("Invalid ID.", 422);

  const target = await getUser(id);
  if (!target) return fail("Account not found.", 404);
  if (target.role === "admin" && session.role !== "admin" && session.role !== "superadmin") return fail("Only an admin can edit an admin account.", 403);
  if (target.role === "superadmin" && session.role !== "superadmin") return fail("Only a SuperAdmin can edit a SuperAdmin account.", 403);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, string | number> = {};
  const text = ["name", "name_en", "email", "student_id", "class_level", "section", "roll", "phone", "photo_url", "club_slug", "designation", "session_year", "blood_group", "address", "guardian_name", "guardian_phone"] as const;
  for (const key of text) {
    if (key in body) patch[key] = key === "email" ? str(body[key]).toLowerCase() : key === "student_id" ? str(body[key]).toUpperCase() : str(body[key]);
  }
  if ("role" in body) {
    const role = str(body.role) as PortalRole;
    if (!allRoles.includes(role)) return fail("Invalid role.", 422);
    if ((role === "admin" || role === "superadmin") && session.role !== "superadmin") {
      return fail("Only a SuperAdmin can assign this role.", 403);
    }
    patch.role = role;
  }
  if ("is_active" in body) patch.is_active = Number(body.is_active) ? 1 : 0;
  const password = str(body.password);
  if (password) {
    const { hash, salt } = hashPassword(password);
    patch.password_hash = hash;
    patch.password_salt = salt;
    patch.must_change_password = 0;
  }

  try {
    const updated = await updateUser(id, patch);
    if (updated && updated.role === "student" && updated.class_level && ("class_level" in patch || "section" in patch || "is_active" in patch || "role" in patch || "name" in patch || "student_id" in patch)) {
      const classInfo = (await listClasses(true)).find((item) => item.name === updated.class_level);
      if (classInfo && Number(classInfo.fee_amount) > 0 && Number(updated.is_active) === 1) {
        const fairSlug = new URL(request.url).searchParams.get("fair") || await defaultFairSlug();
        await syncClassFeeDues(classInfo, fairSlug, session.user.name);
      }
    }
    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: "user.update",
      entity: "users",
      entity_id: id,
      detail: Object.keys(patch).join(", "),
    });
    return ok({ user: updated ? publicUser(updated) : null });
  } catch (error) {
    if (error instanceof Error && /UNIQUE/i.test(error.message)) return fail("This email or ID number is already registered.", 409);
    throw error;
  }
}

/** DELETE /api/staff/users/:id — admins only, never yourself. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  if (session.role !== "admin" && session.role !== "superadmin") return fail("Only an admin can delete accounts.", 403);
  const { id } = await context.params;
  if (!safeId(id)) return fail("Invalid ID.", 422);
  if (id === session.user.id) return fail("You cannot delete your own account.", 400);
  const target = await getUser(id);
  if (!target) return fail("Account not found.", 404);
  if (target.role === "superadmin" && session.role !== "superadmin") return fail("Only a SuperAdmin can delete a SuperAdmin account.", 403);

  const removed = await deleteUser(id);
  if (!removed) return fail("Account not found.", 404);
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "user.delete", entity: "users", entity_id: id });
  return ok({ deleted: true });
}
