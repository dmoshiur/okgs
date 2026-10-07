import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { listRows } from "@/lib/db";
import { listDues, listTickers } from "@/lib/portal-db";
import { announcementMatchesUser } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const [notices, news, updates, dues, tickers] = await Promise.all([
    listRows("notices", { activeOnly: true, limit: 40 }),
    listRows("news", { activeOnly: true, limit: 40 }),
    listRows("updates", { activeOnly: true, limit: 40 }),
    listDues({ user_id: session.user.id, limit: 200 }),
    listTickers({ activeOnly: true, limit: 80 }),
  ]);
  const hasDues = dues.length > 0;
  const outstanding = dues.reduce((sum, due) => sum + Math.max(0, Number(due.amount) - Number(due.paid_amount)), 0);
  const payment = !hasDues ? "unknown" : outstanding > 0 ? "unpaid" : "paid";
  const rows: Array<Record<string, unknown>> = [
    ...notices.map((row) => ({ ...row, announcement_kind: "notice" })),
    ...news.map((row) => ({ ...row, announcement_kind: "news" })),
    ...updates.map((row) => ({ ...row, announcement_kind: "update" })),
    ...tickers.map((row) => ({ ...row, title: row.name || "ঘোষণা", body: row.message, announcement_kind: "ticker", published_at: row.starts_at || row.created_at })),
  ];
  const merged = rows.filter((row) => {
    const targetRole = String(row.target_role ?? "").toLowerCase();
    const segment = String(row.payment_segment ?? "").toLowerCase();
    return (!targetRole || targetRole === session.role) &&
      (!segment || segment === payment) &&
      announcementMatchesUser(String(row.audience ?? "public"), session.role, payment as "paid" | "unpaid" | "unknown");
  });

  merged.sort((a, b) => String(b.published_at || b.date || b.created_at || "").localeCompare(String(a.published_at || a.date || a.created_at || "")));
  return NextResponse.json({ announcements: merged.slice(0, 20) });
}
