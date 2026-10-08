import { defaultFairSlug, fail, ok, staff, str } from "@/lib/api";
import { logActivity } from "@/lib/portal-db";
import { parseRollExpression, normalizeRoll } from "@/lib/roll-range";
import { PAYMENT_STATUSES, scopedStudents, setPaymentStatus, studentsByIds, type PaymentStatus } from "@/lib/student-db";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff/students/payments
 *
 * Single:  { fair_slug, status, student_ids: [id] }
 * Bulk:    { fair_slug, status, scope: { class_name, section?, shift?, rolls?, all_in_class? } }
 *
 * `rolls` accepts "1, 2, 5, 8, 12-15". `all_in_class` marks every student of the
 * class (and the section/shift when given) in one step. Every change is written
 * to the payments table before the response is returned.
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = str(body.status).toUpperCase() as PaymentStatus;
  if (!PAYMENT_STATUSES.includes(status)) return fail("Status must be PAID or UNPAID.", 422);
  const fair = str(body.fair_slug) || (await defaultFairSlug());

  let targets: { id: string; roll: string; name: string }[] = [];
  let scopeLabel = "";

  if (Array.isArray(body.student_ids) && body.student_ids.length) {
    const ids = body.student_ids.map((value) => str(value)).filter(Boolean);
    const found = await studentsByIds(ids);
    targets = found.map((row) => ({ id: row.id, roll: row.roll, name: row.name }));
    if (!targets.length) return fail("None of the selected students were found.", 404);
    scopeLabel = `${targets.length} selected student(s)`;
  } else {
    const scope = (body.scope ?? {}) as Record<string, unknown>;
    const className = str(scope.class_name);
    if (!className) return fail("Choose a class before updating payments in bulk.", 422);
    const section = str(scope.section);
    const shift = str(scope.shift);
    const rollsText = str(scope.rolls);
    const parsed = rollsText ? parseRollExpression(rollsText) : { rolls: new Set<string>(), error: "" };
    if (parsed.error) return fail(parsed.error, 422);
    if (!scope.all_in_class && !rollsText) return fail("Enter roll numbers or choose 'Select all class students'.", 422);

    const roster = await scopedStudents({ class_name: className, section, shift });
    const chosen = parsed.rolls.size ? roster.filter((row) => parsed.rolls.has(normalizeRoll(row.roll))) : roster;
    targets = chosen.map((row) => ({ id: row.id, roll: row.roll, name: row.name }));
    if (!targets.length) return fail("No students matched this class, section, shift and roll selection.", 404);
    scopeLabel = [className, section ? `section ${section}` : "", shift ? `${shift} shift` : ""].filter(Boolean).join(" · ");
  }

  const updated = await setPaymentStatus({
    fair_slug: fair,
    student_ids: targets.map((row) => row.id),
    status,
    actor_id: session.user.id,
    actor_name: session.user.name,
  });

  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: `payment.${status.toLowerCase()}`,
    entity: "payments",
    entity_id: fair,
    detail: `${updated} student(s) marked ${status} · ${scopeLabel}`,
  });

  return ok({
    updated,
    status,
    rolls: targets.map((row) => row.roll).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)),
    students: targets,
  });
}
