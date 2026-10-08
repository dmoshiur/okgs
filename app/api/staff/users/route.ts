import { defaultFairSlug, fail, num, ok, staff, str } from "@/lib/api";
import { createUser, listClasses, listUsers, logActivity, publicUser, syncClassFeeDues, type PortalRole } from "@/lib/portal-db";
import { defaultPortalPassword, ensurePassword, hashPassword } from "@/lib/portal-auth";
import { getUser } from "@/lib/portal-db";
import { allRoles } from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/** GET /api/staff/users?role=&class=&section=&q= */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const params = new URL(request.url).searchParams;
  const users = await listUsers({
    role: params.get("role") || undefined,
    class_level: params.get("class") || undefined,
    section: params.get("section") || undefined,
    search: params.get("q") || undefined,
    payment_status: ["paid", "unpaid"].includes(params.get("payment_status") || "") ? params.get("payment_status") as "paid" | "unpaid" : undefined,
    payment_fair_slug: params.get("fair") || undefined,
    limit: num(params.get("limit"), 800),
  });
  return ok({ users: users.map(publicUser) });
}

/** POST /api/staff/users — teachers/admins create students, teachers, alumni … */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.name);
  const role = (str(body.role, "student") || "student") as PortalRole;
  const email = str(body.email).toLowerCase();
  const studentId = str(body.student_id).toUpperCase();

  if (!name) return fail("Name is required.", 422);
  if (!allRoles.includes(role)) return fail("Invalid role.", 422);
  if (!email && !studentId) return fail("Email or school ID number — at least one is required.", 422);
  if ((role === "admin" || role === "superadmin") && session.role !== "superadmin") {
    return fail("Only a SuperAdmin can create new admins.", 403);
  }

  const password = str(body.password) || defaultPortalPassword();
  const { hash, salt } = hashPassword(password);

  try {
    const created = await createUser({
      role,
      name,
      name_en: str(body.name_en),
      email,
      student_id: studentId,
      class_level: str(body.class_level),
      section: str(body.section),
      roll: str(body.roll),
      phone: str(body.phone),
      photo_url: str(body.photo_url),
      club_slug: str(body.club_slug),
      designation: str(body.designation),
      session_year: str(body.session_year),
      blood_group: str(body.blood_group),
      address: str(body.address),
      guardian_name: str(body.guardian_name),
      guardian_phone: str(body.guardian_phone),
      password_hash: hash,
      password_salt: salt,
      must_change_password: body.password ? 0 : 1,
      is_active: 1,
    });
    if (role === "student" && created.class_level) {
      const classInfo = (await listClasses(true)).find((item) => item.name === created.class_level);
      if (classInfo && Number(classInfo.fee_amount) > 0) await syncClassFeeDues(classInfo, str(body.fair_slug) || await defaultFairSlug(), session.user.name);
    }
    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: "user.create",
      entity: "users",
      entity_id: created.id,
      detail: `${name} · ${role}`,
    });
    return ok({ user: publicUser(created), defaultPassword: str(body.password) ? "" : defaultPasswordFor(created.student_id) }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE/i.test(message)) {
      return fail("This email or ID number is already registered.", 409);
    }
    throw error;
  }
}

function defaultPasswordFor(studentId: string) {
  return studentId ? `ID: ${studentId}` : defaultPortalPassword();
}

/** PATCH /api/staff/users — reset a password (admin only for staff accounts). */
export async function PATCH(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = str(body.id);
  if (!id) return fail("Invalid account.", 422);
  const target = await getUser(id);
  if (!target) return fail("Account not found.", 404);
  if (target.role === "admin" && session.role !== "admin" && session.role !== "superadmin") return fail("Only an admin can change an admin account.", 403);
  if (target.role === "superadmin" && session.role !== "superadmin") return fail("Only a SuperAdmin can change a SuperAdmin account.", 403);

  const newPassword = str(body.password);
  if (newPassword) {
    const { hash, salt } = hashPassword(newPassword);
    await import("@/lib/portal-db").then(({ updateUser }) => updateUser(id, { password_hash: hash, password_salt: salt, must_change_password: 0 }));
    await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "user.password", entity: "users", entity_id: id });
    return ok({ reset: true });
  }
  const existing = await import("@/lib/portal-auth").then(({ defaultPortalPassword }) => defaultPortalPassword());
  const created = await ensurePassword(target, existing);
  return ok({ reset: created, hint: created ? existing : "" });
}
