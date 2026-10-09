import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { getPublicContent } from "@/lib/db";
import { activeFair } from "@/lib/site";
import { LoginForm } from "@/components/portal/LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student login", robots: { index: false, follow: false } };

export default async function StudentLoginPage() {
  const session = await getPortalSession();
  if (session) redirect("/me");
  const content = await getPublicContent();
  return <main className="v2 portal-auth-single"><LoginForm lang="en" fairName={activeFair(content)?.name ?? ""}
    note="Student portal: view your ticket, payment status and profile. Use the credentials issued by the school office. If you have no account or registered email, contact the office." /></main>;
}
