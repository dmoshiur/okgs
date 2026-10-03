import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminCredentials, createSession, SESSION_COOKIE } from "@/lib/auth";

function matches(input: string, expected: string) {
  const actualBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";
    const credentials = adminCredentials();

    if (!matches(email, credentials.email.toLowerCase()) || !matches(password, credentials.password)) {
      return NextResponse.json({ error: "Those credentials do not match our records." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: createSession(credentials.email),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 400 });
  }
}
