import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { listUsers, publicUser } from "@/lib/portal-db";
import { assignableRoles, roleLabelsEn } from "@/lib/roles";
import { AdminSystemShell } from "@/components/admin/AdminSystemShell";
import { UserManager, type ManagedUser } from "@/components/admin/UserManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accounts",
  robots: { index: false, follow: false },
};

/** /admin/users — email-based account creation and role management. */
export default async function AdminUsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.isSuperAdmin) redirect("/admin");

  const users = (await listUsers({ limit: 500 })).map(publicUser) as unknown as ManagedUser[];

  return (
    <AdminSystemShell
      session={session}
      active="users"
      title="Accounts"
      description="Every account is keyed by an email address in the primary database. Create one here and the person can sign in from any door — the role decides which dashboard opens."
    >
      <UserManager
        initialUsers={users}
        roles={assignableRoles.map((role) => ({ value: role, label: roleLabelsEn[role] }))}
      />
    </AdminSystemShell>
  );
}
