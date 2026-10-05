import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { readMaintenanceFlag } from "@/lib/maintenance";
import { AdminStudio } from "@/components/admin/AdminStudio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Content Studio",
  robots: { index: false, follow: false },
};

/**
 * /admin — the content studio.
 *
 * Guarded by the database-backed session: only `superadmin` and `admin` may open
 * it. Everybody else is sent to the dashboard their role owns (teachers → /sf,
 * students → /me), so a wrong URL never shows them a half-loaded studio.
 */
export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const maintenance = await readMaintenanceFlag();

  return (
    <AdminStudio
      session={{
        name: session.name,
        email: session.email,
        role: session.role,
        isSuperAdmin: session.isSuperAdmin,
      }}
      maintenanceEnabled={maintenance.enabled}
    />
  );
}
