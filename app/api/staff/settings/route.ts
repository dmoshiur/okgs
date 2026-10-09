import { errorResponse, fail, ok, safeId, staff, str } from "@/lib/api";
import { listRows, updateRow } from "@/lib/db";
import { setSetting } from "@/lib/site";
import { logActivity } from "@/lib/portal-db";
import { isAdminRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { fairPreferenceCookieHeader } from "@/lib/sf-preference";
import type { Fair, SiteTheme } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Site switches that the console flips: the science-fair mode of the whole site,
 * which fair is "live", and which template theme paints it.
 */
export async function POST(request: Request) {
  try {
    const guard = await staff();
    if ("status" in guard) return guard;
    const { session } = guard;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = str(body.action);
    const done: string[] = [];
    if (!isAdminRole(session.role)) return fail("Administrator rights are required to change site settings.", 403);
    if (["fair-mode", "fair-slug", "fair", "fair-name"].includes(action) && (action !== "fair-mode" || str(body.slug))) {
      const fairs = (await listRows("fairs")) as unknown as Fair[];
      const target = fairs.find((fair) => fair.slug === str(body.slug) && fair.is_active !== false);
      if (!target) return fail("Active fair not found.", 404);
      if (action === "fair-name") {
        const name = str(body.name);
        if (!name || name.length > 160) return fail("Fair name must contain 1–160 characters.", 422);
        await updateRow("fairs", target.id, { name });
        done.push("fair-name");
      }
    }

    if (action === "fair-mode") {
      const mode = str(body.mode) === "fair" ? "fair" : "school";
      await setSetting("fair_mode", mode, { label: "Site mode", description: "school or fair" });
      if (str(body.slug)) await setSetting("fair_mode_slug", str(body.slug), { label: "Active fair" });
      done.push(`mode=${mode}`);
    }

    if (action === "fair-slug" || action === "fair") {
      await setSetting("fair_mode_slug", str(body.slug), { label: "Active fair" });
      done.push("fair_mode_slug");
    }

    if (action === "banner") {
      await setSetting("fair_banner_enabled", Number(body.enabled) ? "1" : "0", { label: "Large fair banner on homepage" });
      done.push(`banner=${Number(body.enabled) ? "on" : "off"}`);
    }

    if (action === "registration") {
      await setSetting("fair_registration_open", Number(body.enabled) ? "1" : "0", { label: "Registration open" });
      done.push("registration");
    }

    if (action === "theme") {
      const id = safeId(str(body.id));
      const key = str(body.key);
      const themes = (await listRows("themes")) as unknown as SiteTheme[];
      const target = themes.find((theme) => theme.id === id || (key && theme.key === key));
      if (!target) return fail("Theme not found.", 404);
      for (const theme of themes) {
        await updateRow("themes", theme.id, { is_default: theme.id === target.id ? 1 : 0 });
      }
      done.push(`theme=${target.key}`);
    }

    if (action === "theme-css") {
      const themes = (await listRows("themes")) as unknown as SiteTheme[];
      const target = themes.find((theme) => theme.id === safeId(str(body.id))) ?? themes.find((theme) => theme.is_default);
      if (!target) return fail("Theme not found.", 404);
      await updateRow("themes", target.id, {
        ...(("custom_css" in body) ? { custom_css: String(body.custom_css ?? "") } : {}),
        ...(("custom_head" in body) ? { custom_head: String(body.custom_head ?? "") } : {}),
        ...(("accent" in body) ? { accent: str(body.accent) } : {}),
        ...(("accent_2" in body) ? { accent_2: str(body.accent_2) } : {}),
        ...(("radius" in body) ? { radius: Number(body.radius) || 18 } : {}),
      });
      done.push("theme-css");
    }

    if (!done.length) return fail("Unknown request.", 400);

    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: `site.${action}`,
      entity: "settings",
      detail: done.join(", "),
    });
    revalidatePath("/", "layout");
    const response = ok({ success: true, message: "Settings updated", applied: done });
    if (["fair-slug", "fair", "fair-mode"].includes(action) && str(body.slug)) {
      response.headers.append("Set-Cookie", fairPreferenceCookieHeader(str(body.slug)));
    }
    return response;
  } catch (error) {
    return errorResponse(error, "staff:settings");
  }
}
