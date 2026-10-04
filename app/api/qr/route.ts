import QRCode from "qrcode";
import { getPortalSession } from "@/lib/portal-auth";
import { isAdmin } from "@/lib/auth";
import { isStaffRole } from "@/lib/roles";
import { entryUrl, makeEntryToken, makePassToken } from "@/lib/qr";
import { getRow } from "@/lib/db";
import type { FairCollection } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/qr?text=... — PNG QR for the signed-in student/teacher cards. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = await getPortalSession();
  const admin = await isAdmin().catch(() => false);

  // ?entry=<collection id> builds a signed project-label QR on the server, so the
  // console never has to know the signing secret.
  const entryId = (url.searchParams.get("entry") || "").trim();
  let text = (url.searchParams.get("text") || "").slice(0, 400);
  if (entryId) {
    if (!session && !admin) return new Response("unauthorized", { status: 401 });
    if (!isStaffRole(session?.role || (admin ? "admin" : ""))) return new Response("forbidden", { status: 403 });
    const row = (await getRow("fair_collections", entryId).catch(() => null)) as unknown as FairCollection | null;
    if (!row) return new Response("entry not found", { status: 404 });
    const token = makeEntryToken(row.id);
    text = url.searchParams.get("raw") ? token : entryUrl(token);
  }
  if (url.searchParams.get("pass")) {
    if (!session && !admin) return new Response("unauthorized", { status: 401 });
    text = makePassToken(String(url.searchParams.get("pass")));
  }
  const size = Math.min(1024, Math.max(120, Number(url.searchParams.get("size")) || 420));
  const dark = /^#[0-9a-f]{6}$/i.test(url.searchParams.get("dark") || "") ? String(url.searchParams.get("dark")) : "#0b3a25";

  if (!text) return new Response("text required", { status: 400 });
  if (!session && !admin) return new Response("unauthorized", { status: 401 });

  const buffer = await QRCode.toBuffer(text, {
    type: "png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark, light: "#ffffff" },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
