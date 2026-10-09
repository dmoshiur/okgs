"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, School } from "lucide-react";
import { sfSections, sfContentStudio, sfSectionForPath, isSfPanelPath } from "./sections";
import type { Fair } from "@/lib/types";
import { ThumbImage } from "@/components/public/Media";

export function DesktopSidebar({ fairs, activeSlug, logo, schoolName, userName, role }: {
  fairs: Fair[]; activeSlug: string; logo: string; schoolName: string; userName: string; role: string;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = sfSectionForPath(pathname);
  if (!isSfPanelPath(pathname) || pathname.startsWith("/sf/print")) return null;
  async function chooseFair(slug: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/staff/fair-preference", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      if (!response.ok) throw new Error("Could not save fair selection.");
      router.refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not save."); }
    finally { setBusy(false); }
  }
  return <aside className={`sf-desktop-sidebar sidebar no-print${collapsed ? " is-collapsed" : ""}`}>
    <div className="sf-sidebar-brand">
      <ThumbImage src={logo} alt={schoolName} fallback={<School size={30} />} />
      <strong className="sf-sidebar-copy">{schoolName}</strong>
      <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </div>
    <div className="sf-sidebar-fair sf-sidebar-copy">
      <label htmlFor="sidebar-fair">Active fair</label>
      <select id="sidebar-fair" value={activeSlug} disabled={busy} onChange={(event) => void chooseFair(event.target.value)}>
        {fairs.map((fair) => <option key={fair.slug} value={fair.slug}>{fair.name}</option>)}
      </select>
      {error ? <p role="alert">{error}</p> : null}
    </div>
    <nav aria-label="Desktop fair navigation">
      {sfSections.map((section) => <Link key={section.id} href={section.href} title={section.label} aria-current={active?.id === section.id ? "page" : undefined}>
        <section.icon size={19} aria-hidden="true" /><span className="sf-sidebar-copy">{section.label}</span>
      </Link>)}
      {["admin", "superadmin"].includes(role) ? <Link href={sfContentStudio.href} title="Content Studio"><sfContentStudio.icon size={19} /><span className="sf-sidebar-copy">Content Studio</span></Link> : null}
    </nav>
    <div className="sf-sidebar-profile">
      <div className="sf-sidebar-copy"><strong>{userName}</strong><small>{role}</small></div>
      <button type="button" title="Sign out" onClick={async () => {
        const response = await fetch("/api/portal/login", { method: "DELETE" });
        if (response.ok) { router.push("/sf/login"); router.refresh(); }
      }}><LogOut size={19} /><span className="sf-sidebar-copy">Sign out</span></button>
    </div>
  </aside>;
}
