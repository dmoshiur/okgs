"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";

export function MobileNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
    {open ? <div className="mobile-nav-panel"><div className="mobile-nav-head"><span className="mobile-nav-label">OKGS / Explore</span><button className="mobile-nav-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={21} /></button></div><nav><a href="#about" onClick={() => setOpen(false)}>Our story <ArrowUpRight size={16} /></a><a href="#community" onClick={() => setOpen(false)}>Community <ArrowUpRight size={16} /></a><a href="#clubs" onClick={() => setOpen(false)}>Clubs <ArrowUpRight size={16} /></a><a href="#news" onClick={() => setOpen(false)}>Journal <ArrowUpRight size={16} /></a></nav><a className="button button-gold" href={`mailto:${email}`} onClick={() => setOpen(false)}>Start a conversation <ArrowUpRight size={15} /></a></div> : null}
  </>;
}
