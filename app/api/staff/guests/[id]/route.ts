import { fail, ok, safeId, staff, str } from "@/lib/api";
import { logActivity } from "@/lib/portal-db";
import { getGuestById, setGuestStatus } from "@/lib/student-db";

export const dynamic = "force-dynamic";

/** PATCH /api/staff/guests/:id — { status: "active" | "revoked" }. Revoked guests are refused at the gate. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const { id } = await context.params;
  if (!safeId(id)) return fail("Invalid guest ID.", 422);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = str(body.status);
  if (status !== "active" && status !== "revoked") return fail("Status must be active or revoked.", 422);

  const existing = await getGuestById(id);
  if (!existing) return fail("Guest not found.", 404);
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
