import { listUsers, type PortalRole } from "@/lib/portal-db";
import { isAdminRole } from "@/lib/roles";
import { mailAvailable, sendMailBatch } from "@/lib/mailer";

export type AnnouncementAudience = "public" | "all" | "teachers" | "students" | "admins" | "paid_students" | "unpaid_students";

export interface AnnouncementMailResult {
  attempted: number;
  delivered: number;
  failed: number;
  configured: boolean;
}

export function isPublicAudience(value: unknown) {
  const audience = String(value ?? "public").toLowerCase();
  return audience === "public";
}

export function announcementMatchesUser(
  audienceValue: unknown,
  role: PortalRole,
  payment: "paid" | "unpaid" | "unknown" = "unknown",
) {
  const audience = String(audienceValue ?? "public").toLowerCase();
  if (audience === "public" || audience === "all") return true;
  if (audience === "teachers") return role === "teacher";
  if (audience === "students") return role === "student" || role === "alumni";
  if (audience === "admins") return isAdminRole(role);
  if (audience === "paid_students") return payment === "paid" && (role === "student" || role === "alumni");
  if (audience === "unpaid_students") return payment === "unpaid" && (role === "student" || role === "alumni");
  return false;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character] ?? character));
}

export async function sendAnnouncementEmail(
  resource: "notices" | "news" | "updates",
  row: Record<string, unknown>,
  requestOrigin: string,
): Promise<AnnouncementMailResult> {
  const audience = String(row.audience || "public").toLowerCase();
  const filter: Parameters<typeof listUsers>[0] = { limit: 5000 };
  if (audience === "teachers") filter.role = "teacher";
  if (audience === "students") {
    // Fetch both student and alumni below, keeping role-specific filtering explicit.
  }
  if (audience === "admins") {
    // Admins and SuperAdmins are combined by the account-manager query.
  }
  if (audience === "paid_students" || audience === "unpaid_students") {
    filter.payment_status = audience === "paid_students" ? "paid" : "unpaid";
  }

  let users = await listUsers(filter);
  if (audience === "students" || audience === "paid_students" || audience === "unpaid_students") {
    users = users.filter((user) => user.role === "student" || user.role === "alumni");
  } else if (audience === "admins") {
    users = users.filter((user) => isAdminRole(user.role));
  }
  users = users.filter((user) => Number(user.is_active) === 1 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(user.email));

  const title = String(row.title || "OKGS update").trim();
  const detail = String(row.body || row.description || row.excerpt || "").trim();
  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL || requestOrigin).replace(/\/$/, "");
  const slug = String(row.slug || "");
  const publicHref = resource === "news" && slug ? `${siteOrigin}/news/${encodeURIComponent(slug)}` : resource === "notices" ? `${siteOrigin}/news#notices` : `${siteOrigin}/`;
  const href = isPublicAudience(audience) ? publicHref : `${siteOrigin}/me`;
  const configured = await mailAvailable();
  if (!configured) return { attempted: users.length, delivered: 0, failed: users.length, configured: false };
  return sendMailBatch(
    {
      subject: `${title} — OKGS`,
      text: `${title}\n\n${detail}${detail ? "\n\n" : ""}${href}`,
      html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;line-height:1.7"><h2>${escapeHtml(title)}</h2>${detail ? `<p>${escapeHtml(detail).replace(/\n/g, "<br>")}</p>` : ""}<p><a href="${escapeHtml(href)}">ওয়েবসাইটে দেখুন</a></p></div>`,
    },
    users.map((user) => ({ email: user.email })),
  );
}
