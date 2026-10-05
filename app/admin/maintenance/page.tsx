import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { loadSiteSettings, maintenanceState, DEFAULT_MAINTENANCE_MESSAGE } from "@/lib/site-settings";
import { readMaintenanceFlag } from "@/lib/maintenance";
import { AdminSystemShell } from "@/components/admin/AdminSystemShell";
import { MaintenancePanel } from "@/components/admin/MaintenancePanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maintenance Switch",
  robots: { index: false, follow: false },
};

/** /admin/maintenance — SuperAdmin-only emergency shutdown control. */
export default async function MaintenancePage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.isSuperAdmin) redirect("/admin");

  const [{ rows, identity }, flag] = await Promise.all([loadSiteSettings(), readMaintenanceFlag()]);
  const stored = maintenanceState(rows);

  return (
    <AdminSystemShell
      session={session}
      active="maintenance"
      title="Emergency maintenance switch"
      description="Take the whole public site offline in one click — and bring it back just as fast. Visitors see a maintenance page while admins keep working."
      banner={
        flag.enabled ? (
          <div className="system-banner is-danger" role="alert">
            <strong>Site is DOWN.</strong> Public visitors are being served the maintenance page right now.
          </div>
        ) : null
      }
    >
      <MaintenancePanel
        siteName={identity.siteName}
        initialState={{
          enabled: flag.enabled,
          message: flag.message || stored.message,
          defaultMessage: DEFAULT_MAINTENANCE_MESSAGE,
          updatedAt: flag.updatedAt || stored.updatedAt,
        }}
      />
    </AdminSystemShell>
  );
}
