"use client";

/**
 * AdminAuthShell — the shared frame of every English admin authentication page
 * (sign in, forgot password, reset password).
 *
 * Layout contract:
 * · the page is exactly `100dvh` tall and never scrolls as a whole;
 * · the art column hides below 1024px and the form column scrolls on its own
 *   (`overflow-y:auto`), so the form stays usable on a 360px phone with the
 *   keyboard open — the same independent-scroll rule as the studio shell.
 */
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function AdminAuthShell({
  title,
  subtitle,
  kicker,
  children,
  footer,
  brandNote,
}: {
  title: string;
  subtitle: string;
  kicker: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  brandNote?: string;
}) {
  return (
    <main className="login-page">
      <section className="login-art">
        <div className="login-art-shape shape-one" />
        <div className="login-art-shape shape-two" />
        <div className="login-art-shape shape-three" />
        <Link className="login-brand" href="/">
          <span className="brand-mark">
            <span>O</span>
          </span>
          <span>
            <b>OKGS</b>
            <small>Content Studio</small>
          </span>
        </Link>

        <div className="login-art-copy">
          <p className="eyebrow eyebrow-light">
            <span className="eyebrow-dot" /> One sign-in for every role
          </p>
          <h1>
            Sign in once.
            <br />
            <em>Land where you belong.</em>
          </h1>
          <p>
            The system reads your role from the database and routes you to the right dashboard — SuperAdmin, Admin,
            Teacher, Club Admin or Student. No role to pick, no wrong door.
          </p>
        </div>

        <div className="login-art-footer">
          <span>
            <ShieldCheck size={14} /> Email-based accounts · secure password reset
          </span>
          <span>OKGS · Admin</span>
        </div>
      </section>

      <section className="login-form-side">
        {/* Scrollable column: the shell itself is height-locked, this scrolls. */}
        <div className="login-scroll">
          <div className="login-form-wrap">
            <div className="login-mobile-brand">
              <Link className="login-brand" href="/">
                <span className="brand-mark">
                  <span>O</span>
                </span>
                <span>
                  <b>OKGS</b>
                  <small>Admin Studio</small>
                </span>
              </Link>
            </div>

            <div className="login-heading">
              <span className="login-kicker">
                <LockKeyhole size={14} /> {kicker}
              </span>
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </div>

            {children}

            {footer}

            <Link className="back-home" href="/">
              <ArrowLeft size={14} /> Back to the public site
            </Link>
            {brandNote ? <p className="login-brand-note">{brandNote}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
