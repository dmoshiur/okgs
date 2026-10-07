import { boolFlag, fail, num, ok, safeId, staff, str } from "@/lib/api";
import { createTicker, deleteTicker, listTickers, logActivity, updateTicker } from "@/lib/portal-db";
import { isPortalRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const tickerAudiences = new Set(["all", "public", "teachers", "students", "admins", "paid_students", "unpaid_students"]);
function tickerTime(value: unknown) {
  const raw = str(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "INVALID" : date.toISOString();
}

/**
 * Fair ticker — the short scrolling notices on the fair site.
 * Every entry can carry a category, a name, a class/section and an email, so the
 * console can print/filter "who said what" without opening the whole entry.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fair = str(url.searchParams.get("fair"));
  const all = boolFlag(url.searchParams.get("all"), false);
  if (all) {
    const guard = await staff();
    if ("status" in guard) return guard;
  }
  const tickers = await listTickers({ fair_slug: fair || undefined, activeOnly: !all, publicOnly: !all });
  return ok({ tickers });
}

export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = str(body.action || "create");
  const id = safeId(str(body.id));

  if (action === "delete") {
    if (!id) return fail("কোন টিকারটি মুছবেন সেটি বোঝা যায়নি।", 422);
    await deleteTicker(id);
    await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "ticker.delete", entity: "tickers", entity_id: id });
    return ok({ deleted: id });
  }

  const values = {
    fair_slug: str(body.fair_slug),
    category: str(body.category),
    name: str(body.name),
    class_level: str(body.class_level),
    section: str(body.section),
    email: str(body.email),
    phone: str(body.phone),
    message: str(body.message),
    kind: str(body.kind) || "notice",
    audience: str(body.audience).toLowerCase() || "all",
    target_role: str(body.target_role).toLowerCase(),
    payment_segment: str(body.payment_segment).toLowerCase(),
    starts_at: tickerTime(body.starts_at),
    ends_at: tickerTime(body.ends_at),
    sort_order: num(body.sort_order, 0),
    is_active: body.is_active === undefined ? 1 : Number(boolFlag(body.is_active, true)),
  };

  if (!tickerAudiences.has(values.audience)) return fail("Select a valid ticker audience.", 422);
  if (values.target_role && !isPortalRole(values.target_role)) return fail("Select a valid target role.", 422);
  if (!["", "paid", "unpaid"].includes(values.payment_segment)) return fail("Select a valid payment group.", 422);
  if (values.starts_at === "INVALID" || values.ends_at === "INVALID") return fail("Enter a valid start and expiry time.", 422);
  if (values.starts_at && values.ends_at && values.ends_at <= values.starts_at) return fail("Expiry must be later than the start time.", 422);
  if (!values.message && !values.name) return fail("টিকারে অন্তত একটি নাম বা বার্তা দিন।", 422);

  if (action === "update") {
    if (!id) return fail("কোন টিকারটি বদলাবেন সেটি বোঝা যায়নি।", 422);
    await updateTicker(id, values);
    await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "ticker.update", entity: "tickers", entity_id: id, detail: values.message.slice(0, 80) });
    return ok({ id });
  }

  const created = await createTicker(values);
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "ticker.create", entity: "tickers", entity_id: created, detail: values.message.slice(0, 80) });
  return ok({ id: created });
}
