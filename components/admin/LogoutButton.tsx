"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

/**
 * Signs out of every surface (studio + portal cookie) and lands on the login
 * page. Used by the studio sidebar and the system pages.
 */
export function LogoutButton({ className = "", label = "Sign out" }: { className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirect: "/admin/login" }),
      });
    } finally {
      window.location.href = "/admin/login";
    }
  }

  return (
    <button type="button" className={className} onClick={() => void logout()} disabled={busy} aria-busy={busy}>
      <span className="nav-item-label">
        <LogOut size={15} />
        <span className="whitespace-nowrap">{busy ? "Signing out…" : label}</span>
      </span>
    </button>
  );
}
