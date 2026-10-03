import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { AdminStudio } from "@/components/admin/AdminStudio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "কনটেন্ট স্টুডিও",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <AdminStudio />;
}
