import { fail, ok, safeId, staff, str } from "@/lib/api";
import { logActivity } from "@/lib/portal-db";
import { getGuestById, setGuestFeeStatus, setGuestStatus } from "@/lib/student-db";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/staff/guests/:id
 * — `{ status: "active" | "revoked" }` — revoked guests are refused at the gate.
 * — `{ fee_status: "PAID" | "UNPAID" }` — flip whether the desk fee is collected.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const { id } = await context.params;
  if (!safeId(id)) return fail("Invalid guest ID.", 422);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = str(body.status);
  const feeStatus = str(body.fee_status);

  const existing = await getGuestById(id);
  if (!existing) return fail("Guest not found.", 404);

  if (feeStatus) {
    if (feeStatus !== "PAID" && feeStatus !== "UNPAID") return fail("Fee status must be PAID or UNPAID.", 422);
    const guest = await setGuestFeeStatus(id, feeStatus);
    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: `guest.fee_${feeStatus.toLowerCase()}`,
      entity: "guests",
      entity_id: id,
      detail: `${existing.name} fee → ${feeStatus}`,
    });
    return ok({ guest });
  }

  if (status !== "active" && status !== "revoked") return fail("Status must be active or revoked.", 422);
  const guest = await setGuestStatus(id, status);

  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: `guest.${status}`,
    entity: "guests",
    entity_id: id,
    detail: `${existing.name} → ${status}`,
  });
  return ok({ guest });
}
