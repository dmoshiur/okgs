"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { primaryNav } from "@/components/public/Chrome";

export function MobileNav({ email, active = "" }: { email: string; active?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button className="mobile-menu" type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "মেনু বন্ধ করুন" : "মেনু খুলুন"} aria-expanded={open}>
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open ? (
        <div className="mobile-nav-panel" role="dialog" aria-label="প্রধান মেনু">
          <div className="mobile-nav-head">
            <span className="mobile-nav-label">ওকেজিএস / মেনু</span>
            <button className="mobile-nav-close" type="button" onClick={() => setOpen(false)} aria-label="মেনু বন্ধ করুন"><X size={21} /></button>
          </div>
          <nav>
            {primaryNav.map((item) => (
              <a key={item.key} href={item.href} className={active === item.key ? "is-active" : ""} onClick={() => setOpen(false)}>
                {item.label} <ArrowUpRight size={16} />
              </a>
            ))}
          </nav>
          <a className="button button-gold" href={`mailto:${email}`} onClick={() => setOpen(false)}>যোগাযোগ করুন <ArrowUpRight size={15} /></a>
        </div>
      ) : null}
    </>
  );
}
