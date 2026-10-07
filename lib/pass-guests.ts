import { db } from "@/lib/db";
import { createPass, getGuestPass, listPasses, updatePass, type PassRow } from "@/lib/portal-db";
import { makePassToken } from "@/lib/qr";

export class GuestPassLimitError extends Error {
  constructor(message: string) { super(message); this.name = "GuestPassLimitError"; }
}

export class GuestPassStateError extends Error {
  constructor(message: string) { super(message); this.name = "GuestPassStateError"; }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Set a student's guest allowance (0–4) and mint one unique QR card per slot.
 * The database trigger and unique slot index make the limit safe when staff and
 * the owner submit concurrent requests. Existing cards are never deleted.
 */
export async function allocateGuestPasses(parent: PassRow, requestedLimit: number) {
  const limit = Math.max(0, Math.min(4, Math.floor(Number(requestedLimit) || 0)));
  if (parent.status !== "active") throw new GuestPassStateError("মূল QR পাস সক্রিয় নয়। নতুন অতিথি পাস বরাদ্দ করা যাবে না।");
  if (parent.expires_at && new Date(parent.expires_at).getTime() <= Date.now()) {
    throw new GuestPassStateError("মূল QR পাসের মেয়াদ শেষ। অতিথি পাস বরাদ্দ করা যাবে না।");
  }

  const existingRows = await listPasses({ parent_pass_id: parent.id, limit: 10 });
  if (existingRows.length > limit) throw new GuestPassLimitError(`GUEST_LIMIT_BELOW_ISSUED:${existingRows.length}`);

  try {
    await updatePass(parent.id, { guest_limit: limit });
  } catch (error) {
    const latest = await listPasses({ parent_pass_id: parent.id, limit: 10 });
    if (/GUEST_LIMIT_BELOW_ISSUED|GUEST_LIMIT_EXCEEDED/i.test(errorMessage(error)) || latest.length > limit) {
      throw new GuestPassLimitError(`GUEST_LIMIT_BELOW_ISSUED:${latest.length}`);
    }
    throw error;
  }

  const guests: PassRow[] = [];
  for (let index = 1; index <= limit; index += 1) {
    let guest = await getGuestPass(parent.id, index);
    if (!guest) {
      try {
        guest = await createPass({
          fair_slug: parent.fair_slug,
          user_id: "",
          holder_name: `${parent.holder_name} · অতিথি ${index}`,
          holder_role: "guest",
          student_id: parent.student_id,
          class_level: parent.class_level,
          section: parent.section,
          email: "",
          phone: parent.phone,
          token: "",
          parent_pass_id: parent.id,
          guest_index: index,
          guest_limit: limit,
          expires_at: parent.expires_at,
          note: `অভিভাবক/অতিথি পাস · ${parent.holder_name}`,
        });
      } catch (error) {
        // A concurrent allocator may have inserted this slot after our read.
        guest = await getGuestPass(parent.id, index);
        if (!guest) {
          if (/GUEST_LIMIT_EXCEEDED/i.test(errorMessage(error))) {
            const latest = await listPasses({ parent_pass_id: parent.id, limit: 10 });
            throw new GuestPassLimitError(`GUEST_LIMIT_BELOW_ISSUED:${latest.length}`);
          }
          throw error;
        }
      }
    }
    if (!guest.token) {
      const token = makePassToken(guest.id);
      await db.execute({ sql: `UPDATE passes SET token = ?, updated_at = ? WHERE id = ?`, args: [token, new Date().toISOString(), guest.id] });
      guest = { ...guest, token };
    }
    guests.push(guest);
  }
  return { guest_limit: limit, guests };
}
