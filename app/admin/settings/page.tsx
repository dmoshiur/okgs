import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { loadSiteSettings, siteSettingFields } from "@/lib/site-settings";
import { AdminSystemShell } from "@/components/admin/AdminSystemShell";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";
import { SmtpSettingsForm } from "@/components/admin/SmtpSettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Site Settings",
  robots: { index: false, follow: false },
};

/** /admin/settings — dynamic site metadata, SuperAdmin only. */
export default async function SiteSettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.isSuperAdmin) redirect("/admin");

  const { values } = await loadSiteSettings();

  return (
    <AdminSystemShell
      session={session}
      active="settings"
      title="Site settings"
      description="Site name, contact details and branding — stored in the database, applied sitewide immediately. No code changes, no redeploy."
    >
      <div className="settings-stack">
        <SiteSettingsForm fields={siteSettingFields} initialValues={values} />
        <SmtpSettingsForm />
      </div>
    </AdminSystemShell>
  );
}
