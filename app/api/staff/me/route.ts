import { fail, ok, str, staff } from "@/lib/api";
import { getUser, listDues, listFunds, listPasses, logActivity, updateUser } from "@/lib/portal-db";
import { hashPassword, verifyPassword } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

/** GET /api/staff/me — the signed-in teacher/admin's own profile + money trail. */
export async function GET() {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const user = await getUser(session.user.id);
  if (!user) return fail("অ্যাকাউন্টটি পাওয়া যায়নি।", 404);

  const [dues, funds, passes] = await Promise.all([
    listDues({ user_id: user.id, limit: 200 }),
    listFunds({ user_id: user.id, limit: 200 }),
    listPasses({ user_id: user.id, limit: 50 }),
  ]);

  return ok({
    user,
    dues,
    funds,
    passes,
    totals: {
      due: dues.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      paid: dues.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0),
      contributed: funds.filter((row) => row.status === "verified").reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    },
  });
}

/** PATCH /api/staff/me — edit your own profile, or change your password. */
export async function PATCH(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (str(body.action) === "password") {
    const current = String(body.current_password ?? "");
    const next = String(body.new_password ?? "");
    if (next.length < 6) return fail("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।", 422);
    const existing = await getUser(session.user.id);
    if (!existing || !verifyPassword(current, existing.password_hash, existing.password_salt)) {
      return fail("বর্তমান পাসওয়ার্ড মিলছে না।", 401);
    }
    const { hash, salt } = hashPassword(next);
    await updateUser(session.user.id, { password_hash: hash, password_salt: salt, must_change_password: 0 });
    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: "profile.password",
      entity: "users",
      entity_id: session.user.id,
    });
    return ok({ changed: true });
  }

  const patch: Record<string, string> = {};
  for (const key of ["name", "name_en", "phone", "photo_url", "designation", "address", "blood_group"] as const) {
    if (body[key] !== undefined) patch[key] = str(body[key]);
  }
  if (!Object.keys(patch).length) return fail("বদলানোর মতো কিছু পাওয়া যায়নি।", 422);
  if (patch.name !== undefined && !patch.name) return fail("নাম খালি রাখা যাবে না।", 422);

  await updateUser(session.user.id, patch);
  await logActivity({
    actor_id: session.user.id,
    actor_name: patch.name || session.user.name,
    actor_role: session.role,
    action: "profile.update",
    entity: "users",
    entity_id: session.user.id,
    detail: Object.keys(patch).join(", "),
  });
  return ok({ user: await getUser(session.user.id) });
}
