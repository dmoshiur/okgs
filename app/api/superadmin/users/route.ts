/**
 * /api/superadmin/users — email-first account management (SuperAdmin only).
 *
 * GET  → the account list (filter by role or free-text search)
 * POST → create an account from an **email address**; the address is normalised
 *        and written to `users.email` in the primary database, then a
 *        single-use “set your password” link is mailed to it.
 * PATCH → change the role of an account (self-demotion is refused).
 *
 * Every writer funnels through lib/portal-db.ts, so the email a SuperAdmin types
 * here is the same email the login page authenticates against — one source of
 * truth, no drift between surfaces.
 */
import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import {
  createPasswordReset,
  createUser,
  getUser,
  isEmailAddress,
  listUsers,
  logActivity,
  normalizeEmail,
  publicUser,
  updateUser,
} from "@/lib/portal-db";
import { assignPassword, defaultPortalPassword } from "@/lib/portal-auth";
import { assignableRoles, isPortalRole, roleLabelsEn } from "@/lib/roles";
import { hashResetToken } from "@/lib/password-reset";
import { mailAvailable, sendMail, welcomeMail } from "@/lib/mailer";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

function authProblem(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json(
      { error: "শুধু সুপার অ্যাডমিন ইউজার ব্যবস্থাপনা করতে পারেন।", errorEn: "Only a SuperAdmin can manage accounts." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const params = new URL(request.url).searchParams;
    const users = await listUsers({
      role: params.get("role") || undefined,
      search: params.get("q") || undefined,
      limit: Number(params.get("limit")) || 500,
    });
    return NextResponse.json({
      ok: true,
      users: users.map(publicUser),
      roles: assignableRoles.map((role) => ({ value: role, label: roleLabelsEn[role] })),
    });
  } catch (error) {
    const problem = authProblem(error);
    if (problem) return problem;
    console.error("[superadmin:users:get]", error);
    return NextResponse.json({ error: "Unable to load accounts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const email = normalizeEmail(body.email);
    const name = String(body.name ?? "").trim();
    const role = String(body.role ?? "student");
    const studentId = String(body.student_id ?? body.studentId ?? "").trim().toUpperCase();
    const password = String(body.password ?? "");
    const sendInvite = body.sendInvite !== false;

    if (!isEmailAddress(email)) {
      return NextResponse.json(
        { error: "সঠিক ইমেইল ঠিকানা দিন।", errorEn: "Enter a valid email address.", field: "email" },
        { status: 422 },
      );
    }
    if (!isPortalRole(role) || !assignableRoles.includes(role)) {
      return NextResponse.json({ error: "অজানা ভূমিকা।", errorEn: "Unknown role.", field: "role" }, { status: 422 });
    }
    if (role === "superadmin" && !session.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden", errorEn: "Only a SuperAdmin can create a SuperAdmin." }, { status: 403 });
    }
    if (password && password.length < 8) {
      return NextResponse.json(
        { error: "পাসওয়ার্ড অন্তত ৮ অক্ষরের দিন।", errorEn: "Use at least 8 characters.", field: "password" },
        { status: 422 },
      );
    }

    const { findUserByEmail } = await import("@/lib/portal-db");
    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { error: "এই ইমেইলে আগেই অ্যাকাউন্ট আছে।", errorEn: "An account already exists for that email.", field: "email" },
        { status: 409 },
      );
    }

    // Either the SuperAdmin typed a password, or the account starts on the shared
    // default and is asked to change it on first sign-in.
    const initialPassword = password || defaultPortalPassword();
    const created = await createUser({
      role,
      name: name || email.split("@")[0],
      name_en: String(body.name_en ?? ""),
      email,
      student_id: studentId,
      class_level: String(body.class_level ?? body.classLevel ?? ""),
      section: String(body.section ?? ""),
      designation: String(body.designation ?? ""),
      phone: String(body.phone ?? ""),
      club_slug: String(body.club_slug ?? ""),
      is_active: 1,
      must_change_password: password ? 0 : 1,
    });
    await assignPassword(created, initialPassword, { mustChange: !password });

    // A welcome / set-password link keeps email delivery identical to the reset flow.
    let invite: { sent: boolean; link?: string } = { sent: false };
    if (sendInvite) {
      const token = randomBytes(32).toString("base64url");
      await createPasswordReset({ userId: created.id, email, tokenHash: hashResetToken(token), purpose: "invite", ttlMinutes: 60 * 24 * 7 });
      const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
      const link = `${origin}/admin/reset-password?token=${encodeURIComponent(token)}`;
      const result = await sendMail(welcomeMail(created.name || email, email, link));
      invite = { sent: result.delivered, link: result.delivered || await mailAvailable() ? undefined : link };
    }

    await logActivity({
      actor_id: session.id,
      actor_name: session.name,
      actor_role: session.role,
      action: "user.create",
      entity: "users",
      entity_id: created.id,
      detail: `${email} · ${roleLabelsEn[role]}`,
    });

    return NextResponse.json(
      {
        ok: true,
        user: publicUser(created),
        invite,
        message: `Account created for ${email}.`,
        messageEn: invite.sent ? "Welcome mail sent with a set-password link." : "Account created — share the set-password link below.",
      },
      { status: 201 },
    );
  } catch (error) {
    const problem = authProblem(error);
    if (problem) return problem;
    console.error("[superadmin:users:post]", error);
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE/i.test(message) || message === "EMAIL_TAKEN") {
      return NextResponse.json(
        { error: "এই ইমেইল বা আইডি নম্বর আগেই নিবন্ধিত।", errorEn: "That email or school ID is already registered." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "অ্যাকাউন্ট তৈরি করা যায়নি।", errorEn: "The account could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id ?? "");
    const target = id ? await getUser(id) : null;
    if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const patch: Record<string, string | number> = {};
    if ("role" in body) {
      const role = String(body.role);
      if (!isPortalRole(role) || !assignableRoles.includes(role)) {
        return NextResponse.json({ error: "Unknown role.", field: "role" }, { status: 422 });
      }
      if (target.id === session.id && role !== "superadmin") {
        return NextResponse.json(
          { error: "নিজের সুপার অ্যাডমিন ভূমিকা বদলানো যাবে না।", errorEn: "You cannot remove your own SuperAdmin role." },
          { status: 400 },
        );
      }
      patch.role = role;
    }
    if ("is_active" in body) patch.is_active = Number(body.is_active) ? 1 : 0;
    if ("email" in body) {
      const email = normalizeEmail(body.email);
      if (!isEmailAddress(email)) return NextResponse.json({ error: "Invalid email.", field: "email" }, { status: 422 });
      patch.email = email;
    }
    if ("password" in body) {
      const password = String(body.password ?? "");
      if (password.length < 8) {
        return NextResponse.json({ error: "Use at least 8 characters.", field: "password" }, { status: 422 });
      }
      await assignPassword(target, password, { mustChange: false });
    }
    if (Object.keys(patch).length) await updateUser(target.id, patch);

    await logActivity({
      actor_id: session.id,
      actor_name: session.name,
      actor_role: session.role,
      action: "user.update",
      entity: "users",
      entity_id: target.id,
      detail: Object.keys(patch).join(", ") || "password",
    });

    const fresh = (await getUser(target.id)) ?? target;
    return NextResponse.json({ ok: true, user: publicUser(fresh) });
  } catch (error) {
    const problem = authProblem(error);
    if (problem) return problem;
    console.error("[superadmin:users:patch]", error);
    return NextResponse.json({ error: "The account could not be updated." }, { status: 500 });
  }
}
