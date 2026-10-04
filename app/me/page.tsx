import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { activeFair, fairMode } from "@/lib/site";
import { StudentHome } from "@/components/portal/StudentHome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "আমার ড্যাশবোর্ড",
  robots: { index: false, follow: false },
};

/** /me — student & alumni home (dues, contributions, QR pass). */
export default async function StudentPage() {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login?next=/me");
  if (isStaffRole(session.role)) redirect("/sf");

  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  const fair = activeFair(content, mode.slug);

  return <StudentHome fair={fair} />;
}
