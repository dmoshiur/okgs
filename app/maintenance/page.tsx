import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, ShieldCheck, Wrench } from "lucide-react";
import { getPublicContent } from "@/lib/db";
import { siteIdentity } from "@/lib/site-settings";
import { readMaintenanceFlag, DEFAULT_MAINTENANCE_NOTICE } from "@/lib/maintenance";
import { SchoolLogo } from "@/components/public/SchoolLogo";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "রক্ষণাবেক্ষণ চলছে · Site under maintenance",
  robots: { index: false, follow: false },
};

/**
 * /maintenance — the page every public visitor sees while the emergency switch
 * is ON. It is reachable without a session (otherwise nobody could read the
 * notice) and never redirects, so there is no way to loop.
 */
export default async function MaintenancePage() {
  const [flag, content, admin] = await Promise.all([
    readMaintenanceFlag(),
    getPublicContent().catch(() => null),
    isAdmin(),
  ]);
  const site = siteIdentity(content?.settings ?? []);
  const message = flag.message || DEFAULT_MAINTENANCE_NOTICE;

  return (
    <main className="maintenance-page">
      <div className="maintenance-card">
        <span className="maintenance-badge">
          <Wrench size={15} /> রক্ষণাবেক্ষণ চলছে
        </span>

        <SchoolLogo src={site.logo} name={site.shortName || site.siteName} />

        <h1>{site.siteName}</h1>
        <p className="maintenance-lead">{message}</p>
        <p className="maintenance-en">Site is currently under maintenance. Please check back later.</p>

        <div className="maintenance-meta">
          {site.phone ? (
            <a href={`tel:${site.phone.replace(/[\s-]/g, "")}`}>
              <Phone size={15} /> {site.phone}
            </a>
          ) : null}
          {site.email ? (
            <a href={`mailto:${site.email}`}>
              <Mail size={15} /> {site.email}
            </a>
          ) : null}
        </div>

        <div className="maintenance-actions">
          {admin ? (
            <Link className="v2-btn" href="/admin">
              <ShieldCheck size={16} /> Open the admin dashboard
            </Link>
          ) : (
            <Link className="v2-btn v2-btn-ghost" href="/admin/login">
              <ShieldCheck size={16} /> Administrator sign-in
            </Link>
          )}
          <Link className="v2-btn v2-btn-ghost" href="/">
            <ArrowLeft size={16} /> আবার চেষ্টা করুন
          </Link>
        </div>

        <small className="maintenance-note">
          Updated {flag.updatedAt ? new Date(flag.updatedAt).toLocaleString("en-GB") : "—"} · SuperAdmins can sign in and switch the site back on at any time.
        </small>
      </div>
    </main>
  );
}
