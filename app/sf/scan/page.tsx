import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { activeFair, fairMode } from "@/lib/site";
import { Scanner } from "@/components/sf/Scanner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QR gate scanner",
  robots: { index: false, follow: false },
};

export default async function ScanPage() {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login?next=/sf/scan");
  if (!isStaffRole(session.role)) redirect("/me");

  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  const fair = activeFair(content, mode.slug);

  return <Scanner fairSlug={fair?.slug ?? ""} fairName={fair?.name ?? "Science Fair"} />;
}
