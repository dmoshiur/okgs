"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Home,
  Images,
  Mail,
  MapPin,
  Menu,
  MoreHorizontal,
  Newspaper,
  Phone,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { primaryNav } from "@/components/public/NavigationData";
import { VisualModeToggle } from "@/components/public/VisualModeToggle";

interface SiteSummary {
  name: string;
  shortName: string;
  tagline: string;
  email: string;
  phone: string;
}

type Panel = "drawer" | "more" | null;
type PrimaryKey = (typeof primaryNav)[number]["key"];

const navIcons = {
  home: Home,
  clubs: UsersRound,
  news: Newspaper,
  notices: Bell,
  gallery: Images,
  contact: MapPin,
} satisfies Record<PrimaryKey, LucideIcon>;

const compactLabels: Partial<Record<PrimaryKey, string>> = {
  home: "হোম",
  clubs: "ক্লাব",
  news: "সংবাদ",
  notices: "নোটিশ",
};

const quickLinks = [primaryNav[0], primaryNav[1], primaryNav[2], primaryNav[3]];

/**
 * Desktop keeps its full navigation in the header. Phones get a compact,
 * persistent bottom dock and a complete, accessible "আরও" sheet; tablets keep
 * the familiar full-screen menu button.
 */
export function MobileNav({ site, active = "" }: { site: SiteSummary; active?: string }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closePanelRef = useRef<(restoreFocus?: boolean) => void>(() => undefined);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPanel = (nextPanel: Exclude<Panel, null>) => {
    clearCloseTimer();
    setClosing(false);
    setPanel(nextPanel);
  };

  const closePanel = (restoreFocus = true) => {
    if (!panel) return;
    clearCloseTimer();
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      const trigger = panel === "more" ? moreButtonRef.current : menuButtonRef.current;
      setPanel(null);
      setClosing(false);
      closeTimerRef.current = null;
      if (restoreFocus) window.requestAnimationFrame(() => trigger?.focus());
    }, 240);
  };

  closePanelRef.current = closePanel;

  const closeImmediately = () => {
    clearCloseTimer();
    setPanel(null);
    setClosing(false);
  };

  useEffect(() => {
    if (!panel) return;

    document.body.classList.add("no-scroll");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanelRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(focusFrame);
      document.body.classList.remove("no-scroll");
    };
  }, [panel]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const phoneHref = site.phone ? `tel:${site.phone.replace(/[\s-]/g, "")}` : "";
  const isMoreOpen = panel === "more";

  return (
    <>
      <button
        ref={menuButtonRef}
        className="mobile-menu"
        type="button"
        onClick={() => openPanel("drawer")}
        aria-label="মেনু খুলুন"
        aria-expanded={panel === "drawer"}
        aria-controls="mobile-navigation-panel"
      >
        <Menu size={21} aria-hidden />
      </button>

      <nav className="mobile-bottom-nav" aria-label="প্রধান নেভিগেশন">
        {quickLinks.map((item) => {
          const Icon = navIcons[item.key];
          return (
            <a
              key={item.key}
              href={item.href}
              className={`mobile-bottom-link${active === item.key ? " is-active" : ""}`}
              aria-current={active === item.key ? "page" : undefined}
            >
              <span className="mobile-bottom-icon"><Icon size={19} strokeWidth={1.9} aria-hidden /></span>
              <span className="mobile-bottom-label">{compactLabels[item.key] || item.label}</span>
            </a>
          );
        })}
        <button
          ref={moreButtonRef}
          className={`mobile-bottom-link mobile-bottom-more${isMoreOpen ? " is-open" : ""}`}
          type="button"
          onClick={() => (isMoreOpen ? closePanel() : openPanel("more"))}
          aria-label="More — সব পেজ ও সেবা দেখুন"
          aria-expanded={isMoreOpen}
          aria-controls="mobile-navigation-panel"
        >
          <span className="mobile-bottom-icon"><MoreHorizontal size={20} strokeWidth={2} aria-hidden /></span>
          <span className="mobile-bottom-label">More</span>
        </button>
      </nav>

      {panel ? (
        <>
          <button
            className={`mobile-panel-backdrop${closing ? " is-closing" : ""}`}
            type="button"
            tabIndex={-1}
            aria-label="মেনু বন্ধ করুন"
            onClick={() => closePanel()}
          />
          <div
            ref={panelRef}
            id="mobile-navigation-panel"
            className={`mobile-panel ${panel === "more" ? "mobile-panel-more" : "mobile-panel-drawer"}${closing ? " is-closing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-panel-title"
          >
            {panel === "more" ? <span className="mobile-panel-handle" aria-hidden /> : null}
            <div className="mobile-panel-head">
              <div>
                <p className="mobile-panel-kicker">{site.shortName} <span aria-hidden>·</span> নেভিগেশন</p>
                <h2 id="mobile-panel-title">{panel === "more" ? "আরও দেখুন" : "প্রধান মেনু"}</h2>
              </div>
              <button
                ref={closeButtonRef}
                className="mobile-panel-close"
                type="button"
                onClick={() => closePanel()}
                aria-label="মেনু বন্ধ করুন"
              >
                <X size={19} aria-hidden />
              </button>
            </div>

            {panel === "more" ? (
              <>
                <p className="mobile-panel-intro">প্রয়োজনীয় সব পেজ, সেবা ও যোগাযোগের তথ্য এক জায়গায়।</p>
                <p className="mobile-panel-section-title">সব পেজ</p>
                <nav className="mobile-panel-grid" aria-label="সব পেজ">
                  {primaryNav.map((item) => {
                    const Icon = navIcons[item.key];
                    return (
                      <a
                        key={item.key}
                        href={item.href}
                        className={`mobile-panel-link${active === item.key ? " is-active" : ""}`}
                        aria-current={active === item.key ? "page" : undefined}
                        onClick={closeImmediately}
                      >
                        <span className="mobile-panel-link-icon"><Icon size={19} strokeWidth={1.9} aria-hidden /></span>
                        <span className="mobile-panel-link-label">{item.label}</span>
                        <ChevronRight size={15} className="mobile-panel-link-arrow" aria-hidden />
                      </a>
                    );
                  })}
                </nav>

                <p className="mobile-panel-section-title">দ্রুত সেবা</p>
                <div className="mobile-panel-actions">
                  <a className="button button-primary" href="/me" onClick={closeImmediately}>
                    <GraduationCap size={17} aria-hidden /> শিক্ষার্থী পোর্টাল <ArrowUpRight size={14} aria-hidden />
                  </a>
                  <a className="button button-outline" href="/clubs" onClick={closeImmediately}>
                    <BookOpen size={17} aria-hidden /> ক্লাব তথ্যকেন্দ্র <ArrowUpRight size={14} aria-hidden />
                  </a>
                </div>

                <div className="mobile-panel-mode"><VisualModeToggle /></div>
                <div className="mobile-panel-contact">
                  {phoneHref ? <a href={phoneHref}><Phone size={14} aria-hidden /> {site.phone}</a> : null}
                  {site.email ? <a href={`mailto:${site.email}`}><Mail size={14} aria-hidden /> {site.email}</a> : null}
                </div>
                <p className="mobile-panel-tagline">
                  <ShieldCheck size={13} aria-hidden /> {site.tagline}
                </p>
              </>
            ) : (
              <>
                <nav className="mobile-drawer-nav" aria-label="প্রধান মেনু">
                  {primaryNav.map((item) => {
                    const Icon = navIcons[item.key];
                    return (
                      <a
                        key={item.key}
                        href={item.href}
                        className={active === item.key ? "is-active" : ""}
                        aria-current={active === item.key ? "page" : undefined}
                        onClick={closeImmediately}
                      >
                        <span className="mobile-drawer-item-icon"><Icon size={19} aria-hidden /></span>
                        <span>{item.label}</span>
                        <ArrowUpRight size={15} aria-hidden />
                      </a>
                    );
                  })}
                </nav>
                <div className="mobile-drawer-actions">
                  <VisualModeToggle />
                  <a className="button button-primary button-block" href="/clubs" onClick={closeImmediately}>
                    <BookOpen size={16} aria-hidden /> ক্লাব তথ্যকেন্দ্র <ArrowUpRight size={14} aria-hidden />
                  </a>
                  <a className="button button-outline button-block" href="/me" onClick={closeImmediately}>
                    <GraduationCap size={16} aria-hidden /> শিক্ষার্থী পোর্টাল <ArrowUpRight size={14} aria-hidden />
                  </a>
                </div>
                <div className="mobile-panel-contact">
                  {phoneHref ? <a href={phoneHref}><Phone size={14} aria-hidden /> {site.phone}</a> : null}
                  {site.email ? <a href={`mailto:${site.email}`}><Mail size={14} aria-hidden /> {site.email}</a> : null}
                </div>
                <p className="mobile-panel-tagline">
                  <ShieldCheck size={13} aria-hidden /> {site.tagline}
                </p>
              </>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
