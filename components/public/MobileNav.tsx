"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, LogIn, Menu, Phone, ShieldCheck, X } from "lucide-react";
import { primaryNav } from "@/components/public/Chrome";

interface SiteSummary {
  name: string;
  shortName: string;
  tagline: string;
  email: string;
  phone: string;
}

/**
 * Mobile navigation drawer: full-height panel, focus managed on open,
 * Escape to close and the page body locked while it is open.
 */
export function MobileNav({ site, active = "" }: { site: SiteSummary; active?: string }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [open]);

  return (
    <>
      <button
        className="mobile-menu"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="মেনু খুলুন"
        aria-expanded={open}
        aria-controls="mobile-nav"
      >
        <Menu size={22} aria-hidden />
      </button>

      {open ? (
        <>
          <div className="app-scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="mobile-nav-panel" id="mobile-nav" role="dialog" aria-modal="true" aria-label="প্রধান মেনু">
            <div className="mobile-nav-head">
              <span className="mobile-nav-label">{site.shortName} / মেনু</span>
              <button ref={closeRef} className="mobile-nav-close" type="button" onClick={() => setOpen(false)} aria-label="মেনু বন্ধ করুন">
                <X size={20} aria-hidden />
              </button>
            </div>

            <nav aria-label="প্রধান মেনু">
              {primaryNav.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className={active === item.key ? "is-active" : ""}
                  aria-current={active === item.key ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label} <ArrowUpRight size={16} aria-hidden />
                </a>
              ))}
            </nav>

            <div className="mobile-nav-cta">
              <div className="mobile-nav-actions">
                <a className="button button-primary button-block" href="/clubs" onClick={() => setOpen(false)}>
                  ক্লাব তথ্যকেন্দ্র <ArrowUpRight size={15} aria-hidden />
                </a>
                <a className="button button-outline button-block" href="/me" onClick={() => setOpen(false)}>
                  <LogIn size={15} aria-hidden /> শিক্ষার্থী পোর্টাল
                </a>
              </div>
              <div className="mobile-nav-foot">
                <a href={`tel:${site.phone.replace(/[\s-]/g, "")}`}><Phone size={13} aria-hidden /> {site.phone}</a>
                <p className="muted small" style={{ margin: "6px 0 0" }}>
                  <ShieldCheck size={13} aria-hidden style={{ display: "inline", verticalAlign: -2 }} /> {site.tagline}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
