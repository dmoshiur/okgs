import { NextRequest } from "next/server";
import { fail, ok, staff, str } from "@/lib/api";
import { getPassById, getPassByToken } from "@/lib/portal-db";
import { generateQRCode } from "@/lib/qr";

export const dynamic = "force-dynamic";

/**
 * Generate QR code for a pass
 * Produces valid, verifiable QR codes for guest entry verification
 */
export async function GET(request: NextRequest) {
  const guard = await staff();
  if ("status" in guard) return guard;
  
  const params = new URL(request.url).searchParams;
  const token = params.get("token");
  const pass_id = params.get("pass_id");
  const size = parseInt(params.get("size") || "200");
  const download = params.get("download") === "true";
  
  if (!token && !pass_id) {
    return fail("Token or pass ID is required", 400);
  }
  
  try {
    // Get pass by token or ID
    let pass;
    if (token) {
      pass = await getPassByToken(token);
    } else if (pass_id) {
      pass = await getPassById(pass_id);
    }
    
    if (!pass) {
      return fail("Pass not found", 404);
    }
    
    // Generate QR code with pass information
    const qrData = JSON.stringify({
      pass_id: pass.id,
      token: pass.token,
      holder_name: pass.holder_name,
      student_id: pass.student_id,
      fair_slug: pass.fair_slug,
      guest_index: pass.guest_index,
      guest_limit: pass.guest_limit,
      expires_at: pass.expires_at,
      type: pass.holder_role === "guest" ? "guest" : "student",
    });
    
    // Generate QR code
    const qrCode = await generateQRCode(qrData, size);
    
    if (download) {
      return new Response(qrCode, {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="qr-pass-${pass.id}.png"`,
        },
      });
    }
    
    return new Response(qrCode, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache",
      },
    });
    
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to generate QR code", 500);
  }
}