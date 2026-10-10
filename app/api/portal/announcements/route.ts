import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { listRows } from "@/lib/db";
import { listReadAnnouncementKeys, listStudentDues, listTickers, markAnnouncementsRead } from "@/lib/portal-db";
import { announcementMatchesUser } from "@/lib/announcements";
import { announcementCategory, announcementKey, type AnnouncementCategory } from "@/lib/announcement-category";

export const dynamic = "force-dynamic";

export interface FeedAnnouncement {
  key: string;
  id: string;
  announcement_kind: "notice" | "news" | "update" | "ticker";
  category: AnnouncementCategory;
  /** The office's own label (e.g. "সাধারণ", "জরুরি", "বিজ্ঞান"). Shown as written. */
  label: string;
  urgent: boolean;
  title: string;
  body: string;
  published_at: string;
  read: boolean;
}

/**
 * GET /api/portal/announcements — the notices feed for the signed-in person.
 * Only items this person is allowed to see are returned, each with a category,
 * an urgency flag and its own read state, plus the unread total.
 */
export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const isLearner = session.role === "student" || session.role === "alumni";
  const [notices, news, updates, dues, tickers, readKeys] = await Promise.all([
    listRows("notices", { activeOnly: true, limit: 60 }),
    listRows("news", { activeOnly: true, limit: 60 }),
    listRows("updates", { activeOnly: true, limit: 60 }),
    isLearner ? listStudentDues(session.user.id, session.user.student_id ?? "", 200) : Promise.resolve([]),
    listTickers({ activeOnly: true, limit: 80 }),
    listReadAnnouncementKeys(session.user.id),
  ]);
  const hasDues = dues.length > 0;
  const outstanding = dues.reduce((sum, due) => sum + Math.max(0, Number(due.amount) - Number(due.paid_amount)), 0);
  const payment = !hasDues ? "unknown" : outstanding > 0 ? "unpaid" : "paid";

  const rows: Array<Record<string, unknown>> = [
    ...notices.map((row) => ({ ...row, announcement_kind: "notice" })),
    ...news.map((row) => ({ ...row, announcement_kind: "news" })),
    ...updates.map((row) => ({ ...row, announcement_kind: "update" })),
    ...tickers.map((row) => ({
      ...row,
      title: row.name || "ঘোষণা",
      body: row.message,
      announcement_kind: "ticker",
      published_at: row.starts_at || row.created_at,
    })),
  ];

  const items: FeedAnnouncement[] = rows
    .filter((row) => {
      const targetRole = String(row.target_role ?? "").toLowerCase();
      const segment = String(row.payment_segment ?? "").toLowerCase();
      return (!targetRole || targetRole === session.role) &&
        (!segment || segment === payment) &&
        announcementMatchesUser(String(row.audience ?? "public"), session.role, payment as "paid" | "unpaid" | "unknown");
    })
    .map((row) => {
      const kind = String(row.announcement_kind) as FeedAnnouncement["announcement_kind"];
      const id = String(row.id ?? "");
      const key = announcementKey(kind, id);
      const { category, urgent, label } = announcementCategory(kind, row);
      return {
        key,
        id,
        announcement_kind: kind,
        category,
        label,
        urgent,
        title: String(row.title ?? ""),
        body: String(row.body ?? row.description ?? row.excerpt ?? ""),
        published_at: String(row.published_at || row.date || row.created_at || ""),
        read: readKeys.has(key),
      };
    })
    .filter((item) => item.id && item.title)
    .sort((a, b) => {
      // Urgent first, then newest. Read items keep their place.
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return b.published_at.localeCompare(a.published_at);
    })
    .slice(0, 60);

  const unread = items.filter((item) => !item.read).length;
  const counts = {
    science_fair: { total: 0, unread: 0 },
    notice: { total: 0, unread: 0 },
    update: { total: 0, unread: 0 },
  };
  for (const item of items) {
    counts[item.category].total += 1;
    if (!item.read) counts[item.category].unread += 1;
  }

  return NextResponse.json({ announcements: items, unread, counts });
}

/** POST /api/portal/announcements — { keys: string[] } marks those items as read. */
export async function POST(request: Request) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { keys?: unknown };
  const keys = Array.isArray(body.keys) ? body.keys.map((key) => String(key)) : [];
  const marked = await markAnnouncementsRead(session.user.id, keys);
  return NextResponse.json({ marked });
}
