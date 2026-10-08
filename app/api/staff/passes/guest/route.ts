import { randomUUID } from "node:crypto";
import { fail, ok, staff, str } from "@/lib/api";
import { 
  createPass, 
  getPassById, 
  logActivity,
  generateToken
} from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/**
 * Assign guest passes to a student
 * Allows admins to assign extra guest/parent passes (1, 2, or 3-4 additional passes) 
 * linked to individual student IDs
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  
  // Validate required fields
  const fair_slug = str(body.fair_slug);
  const user_id = str(body.user_id);
  const student_id = str(body.student_id);
  const holder_name = str(body.holder_name);
  const email = str(body.email);
  const phone = str(body.phone);
  const class_level = str(body.class_level);
  const section = str(body.section);
  const guest_count = Math.max(1, Math.min(4, Math.floor(Number(body.guest_count) || 1)));
  const expires_at = str(body.expires_at) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const note = str(body.note);
  
  if (!fair_slug) return fail("Fair slug is required", 400);
  if (!user_id) return fail("User ID is required", 400);
  if (!holder_name) return fail("Holder name is required", 400);
  if (guest_count < 1 || guest_count > 4) return fail("Guest count must be between 1 and 4", 400);
  
  try {
    const createdPasses: string[] = [];
    const parentPassId = randomUUID();
    
    // Create the parent pass (main student pass)
    const parentToken = generateToken();
    const parentPassIdFinal = await createPass({
      fair_slug,
      user_id,
      holder_name,
      holder_role: "student",
      student_id,
      class_level,
      section,
      email,
      phone,
      token: parentToken,
      status: "active",
      scan_count: 0,
      parent_pass_id: "",
      guest_index: 0,
      guest_limit: guest_count,
      expires_at,
      note: note || `Parent pass with ${guest_count} guest passes`,
      created_by: session.user.name,
    });
    
    createdPasses.push(parentPassIdFinal);
    
    // Create guest passes
    for (let i = 1; i <= guest_count; i++) {
      const guestToken = generateToken();
      const guestPassId = await createPass({
        fair_slug,
        user_id,
        holder_name: `${holder_name} - Guest ${i}`,
        holder_role: "guest",
        student_id,
        class_level,
        section,
        email,
        phone,
        token: guestToken,
        status: "active",
        scan_count: 0,
        parent_pass_id: parentPassIdFinal,
        guest_index: i,
        guest_limit: 0,
        expires_at,
        note: note || `Guest pass ${i} of ${guest_count}`,
        created_by: session.user.name,
      });
      
      createdPasses.push(guestPassId);
    }
    
    // Log activity
    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: "pass.guest.create",
      entity: "passes",
      detail: `Assigned ${guest_count} guest pass(es) to ${holder_name} (${student_id})`,
    });
    
    return ok({
      created: createdPasses,
      parent_pass_id: parentPassIdFinal,
      guest_count,
      message: `Successfully created ${guest_count + 1} passes (1 parent + ${guest_count} guest)`,
    }, 201);
    
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to create guest passes", 500);
  }
}