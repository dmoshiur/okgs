"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";

export function MobileNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="মেনু খুলুন"><Menu size={22} /></button>
    {open ? <div className="mobile-nav-panel"><div className="mobile-nav-head"><span className="mobile-nav-label">ওকেজিএস / মেনু</span><button className="mobile-nav-close" onClick={() => setOpen(false)} aria-label="মেনু বন্ধ করুন"><X size={21} /></button></div><nav><a href="#about" onClick={() => setOpen(false)}>আমাদের সম্পর্কে <ArrowUpRight size={16} /></a><a href="#facilities" onClick={() => setOpen(false)}>সুবিধাসমূহ <ArrowUpRight size={16} /></a><a href="#clubs" onClick={() => setOpen(false)}>ক্লাবসমূহ <ArrowUpRight size={16} /></a><a href="#gallery" onClick={() => setOpen(false)}>গ্যালারি <ArrowUpRight size={16} /></a><a href="#contact" onClick={() => setOpen(false)}>যোগাযোগ <ArrowUpRight size={16} /></a></nav><a className="button button-gold" href={`mailto:${email}`} onClick={() => setOpen(false)}>যোগাযোগ করুন <ArrowUpRight size={15} /></a></div> : null}
  </>;
}
