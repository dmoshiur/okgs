"use client";

/**
 * BottomNav — the global mobile navigation bar of the Science Fair panel.
 *
 * Mounted once in the root layout so every staff screen carries the same bar:
 * the console (`/sf`), every section (`/sf/students`, `/sf/settings`, …), the gate
 * scanner (`/sf/scan`) and the ticket/print surfaces. It is `position: fixed` with
 * `z-index: 9999`, so no card, sticky header or camera overlay can cover it, and
 * the panels reserve `--sf-nav-space` (70px) of bottom padding so nothing hides
 * behind it.
 *
 * The active item is read from the URL — there is no saved state, no
 * localStorage, and nothing that can drift away from the database.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Grid2x2Plus, LogOut, ScanLine, X } from "lucide-react";
import {
  isSfPanelPath,
  sfBarSections,
  sfContentStudio,
  sfMoreSections,
  sfSectionForPath,
} from "@/components/sf/sections";

/** Sections left of the scan button, and the ones right of it. */
const LEFT = sfBarSections.filter((section) => section.id === "dashboard" || section.id === "students");
const RIGHT = sfBarSections.filter((section) => section.id !== "dashboard" && section.id !== "students");

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const visible = isSfPanelPath(pathname);
  const active = sfSectionForPath(pathname);

  const closeMore = useCallback(() => {
    setMoreOpen(false);
    toggleRef.current?.focus();
  }, []);

  // Any navigation (including the browser back button) closes the drawer.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMore();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    // The page behind the full-screen sheet must not scroll under the finger.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [moreOpen, closeMore]);

  if (!visible) return null;

  const scanActive = active?.id === "scan";

  return (
    <>
      {moreOpen ? (
        <div className="sf-more-root" role="presentation" onClick={closeMore}>
          <div
            id="sf-more-sheet"
            ref={sheetRef}
            className="sf-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sf-more-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="sf-more-head">
              <div className="sf-more-head-copy">
                <h2 id="sf-more-sheet-title">More sections</h2>
                <p>{active?.label ?? "Science Fair console"}</p>
              </div>
              <button type="button" className="sf-more-close" onClick={closeMore} aria-label="Close the menu">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="sf-more-grid">
              {sfMoreSections.map((section) => (
                <Link
                  key={section.id}
                  href={section.href}
                  className={`sf-more-card${active?.id === section.id ? " is-active" : ""}`}
                  aria-current={active?.id === section.id ? "page" : undefined}
                >
                  <span className="sf-more-card-icon" aria-hidden="true">
                    <section.icon size={20} />
                  </span>
                  <span className="sf-more-card-title">{section.label}</span>
                  <span className="sf-more-card-hint">{section.hint}</span>
                </Link>
              ))}

              <Link href={sfContentStudio.href} className="sf-more-card">
                <span className="sf-more-card-icon" aria-hidden="true">
                  <sfContentStudio.icon size={20} />
                </span>
                <span className="sf-more-card-title">{sfContentStudio.label}</span>
                <span className="sf-more-card-hint">{sfContentStudio.hint}</span>
              </Link>

              <button
                type="button"
                className="sf-more-card sf-more-card-plain"
                onClick={() => {
                  setMoreOpen(false);
                  void signOut(router);
                }}
              >
                <span className="sf-more-card-icon" aria-hidden="true">
                  <LogOut size={20} />
                </span>
                <span className="sf-more-card-title">Sign out</span>
                <span className="sf-more-card-hint">End this session on this device</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="sf-bottom-nav" aria-label="Science Fair navigation">
        <div className="sf-bottom-nav-inner">
          {LEFT.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              className={`sf-bottom-item${active?.id === section.id ? " is-active" : ""}`}
              aria-current={active?.id === section.id ? "page" : undefined}
            >
              <span className="sf-bottom-icon" aria-hidden="true">
                <section.icon size={20} />
              </span>
              <span className="sf-bottom-label">{section.label}</span>
            </Link>
          ))}

          <Link
            href="/sf/scan"
            className={`sf-bottom-item sf-bottom-item-scan${scanActive ? " is-active" : ""}`}
            aria-label="Gate scanner"
            aria-current={scanActive ? "page" : undefined}
          >
            <span className="sf-bottom-icon" aria-hidden="true">
              <ScanLine size={22} />
            </span>
            <span className="sf-bottom-label">Scan</span>
          </Link>

          {RIGHT.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              className={`sf-bottom-item${active?.id === section.id ? " is-active" : ""}`}
              aria-current={active?.id === section.id ? "page" : undefined}
            >
              <span className="sf-bottom-icon" aria-hidden="true">
                <section.icon size={20} />
              </span>
              <span className="sf-bottom-label">{section.label}</span>
            </Link>
          ))}

          <button
            type="button"
            ref={toggleRef}
            className={`sf-bottom-item${moreOpen ? " is-active" : ""}`}
            aria-expanded={moreOpen}
            aria-controls="sf-more-sheet"
            aria-label="More sections"
            onClick={() => setMoreOpen((open) => !open)}
          >
            <span className="sf-bottom-icon" aria-hidden="true">
              <Grid2x2Plus size={20} />
            </span>
            <span className="sf-bottom-label">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

async function signOut(router: ReturnType<typeof useRouter>) {
  await fetch("/api/portal/login", { method: "DELETE" });
  router.push("/sf/login");
  router.refresh();
}
