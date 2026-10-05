import { fail, num, ok, staff, str } from "@/lib/api";
import { createUser, listUsers, logActivity, publicUser, type PortalRole } from "@/lib/portal-db";
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

  if (!name) return fail("নাম দিতে হবে।", 422);
  if (!allRoles.includes(role)) return fail("ভূমিকাটি ঠিক নয়।", 422);
  if (!email && !studentId) return fail("ইমেইল অথবা স্কুল আইডি নম্বর — অন্তত একটি দিতে হবে।", 422);
  if ((role === "admin" || role === "superadmin") && session.role !== "superadmin") {
    return fail("কেবল সুপার অ্যাডমিন নতুন অ্যাডমিন তৈরি করতে পারেন।", 403);
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
      return fail("এই ইমেইল বা আইডি নম্বর আগেই নিবন্ধিত।", 409);
    }
    throw error;
  }
}

function defaultPasswordFor(studentId: string) {
  return studentId ? `আইডি: ${studentId}` : defaultPortalPassword();
}

/** PATCH /api/staff/users — reset a password (admin only for staff accounts). */
export async function PATCH(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = str(body.id);
  if (!id) return fail("কোন অ্যাকাউন্ট, সেটি ঠিক নেই।", 422);
  const target = await getUser(id);
  if (!target) return fail("অ্যাকাউন্ট পাওয়া যায়নি।", 404);
  if (target.role === "admin" && session.role !== "admin") return fail("অ্যাডমিন অ্যাকাউন্ট কেবল অ্যাডমিন বদলাতে পারেন।", 403);

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
