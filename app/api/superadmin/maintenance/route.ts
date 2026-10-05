/**
 * /api/superadmin/maintenance — the emergency “Site Down” switch (SuperAdmin only).
 *
 * GET  → current state (used to render the switch and the studio banner)
 * POST → { enabled: boolean, message?: string }
 *
 * Flipping it ON rewrites every public request to /maintenance within the
 * middleware's 5-second cache window (instantly on the same instance, because the
 * write invalidates the cache). SuperAdmins — and admins — are exempt, so the
 * person who shut the site down can always sign back in and turn it back on.
 */
import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { DEFAULT_MAINTENANCE_MESSAGE, maintenanceState, setMaintenanceMode } from "@/lib/site-settings";
import { listRows } from "@/lib/db";
import { logActivity } from "@/lib/portal-db";
import { readMaintenanceFlag } from "@/lib/maintenance";
import type { SiteSetting } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadState() {
  const settings = (await listRows("settings")) as unknown as SiteSetting[];
  const state = maintenanceState(settings);
  const live = await readMaintenanceFlag();
  return {
    enabled: live.enabled,
    stored: state.enabled,
    message: live.message || state.message,
    defaultMessage: DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: live.updatedAt || state.updatedAt,
  };
}

function authProblem(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json(
      { error: "শুধু সুপার অ্যাডমিন মেইনটেন্যান্স সুইচ ব্যবহার করতে পারেন।", errorEn: "Only a SuperAdmin can use the maintenance switch." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ ok: true, state: await loadState() });
  } catch (error) {
    const problem = authProblem(error);
    if (problem) return problem;
    console.error("[superadmin:maintenance:get]", error);
    return NextResponse.json({ error: "State unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const enabled = body.enabled === true || ["1", "true", "on", "yes"].includes(String(body.enabled ?? "").toLowerCase());
    const message = typeof body.message === "string" ? body.message.slice(0, 400).trim() : undefined;

    await setMaintenanceMode(enabled, message, session.email || session.name);
    await logActivity({
      actor_id: session.id,
      actor_name: session.name,
      actor_role: session.role,
      action: enabled ? "site.maintenance.on" : "site.maintenance.off",
      entity: "settings",
      entity_id: session.id,
      detail: enabled ? "Public site locked — maintenance page live" : "Public site restored",
    });

    return NextResponse.json({
      ok: true,
      state: await loadState(),
      message: enabled ? "Site is DOWN — visitors now see the maintenance page." : "Site is LIVE again.",
      messageBn: enabled ? "সাইট বন্ধ — দর্শকরা এখন মেইনটেন্যান্স পাতা দেখছেন।" : "সাইট চালু হয়েছে।",
    });
  } catch (error) {
    const problem = authProblem(error);
    if (problem) return problem;
    console.error("[superadmin:maintenance:post]", error);
    return NextResponse.json(
      { error: "সুইচটি চালু করা যায়নি।", errorEn: "The switch could not be flipped." },
      { status: 500 },
    );
  }
}
