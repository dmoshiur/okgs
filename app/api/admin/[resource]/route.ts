import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/roles";
import { coerceFieldValue, defaultValueFor, fieldsFor, resourceSchema } from "@/lib/content-config";
import { findUniqueConflict, insertRow, listRows, resolveSlug, rowExists } from "@/lib/db";
import type { ResourceName } from "@/lib/types";

const resources = new Set(Object.keys(resourceSchema) as ResourceName[]);

function validResource(value: string): value is ResourceName {
  return resources.has(value as ResourceName);
}

function unauthorized(error: unknown) {
  return error instanceof Error && error.message === "UNAUTHORIZED";
}

/** Coerce an incoming body to schema-typed database values. */
export function buildPayload(resource: ResourceName, raw: Record<string, unknown>, fillDefaults: boolean) {
  const payload: Record<string, string | number> = {};
  for (const field of fieldsFor(resource)) {
    if (!(field.name in raw)) {
      if (fillDefaults) payload[field.name] = coerceFieldValue(field, defaultValueFor(field));
      continue;
    }
    payload[field.name] = coerceFieldValue(field, raw[field.name]);
  }
  return payload;
}

/**
 * Required / format checks. Fields missing from the payload are left alone, which
 * is what makes PATCH (inline publish toggle, partial saves) safe.
 */
export function validatePayload(resource: ResourceName, payload: Record<string, string | number>) {
  for (const field of fieldsFor(resource)) {
    if (!(field.name in payload)) continue;
    const value = String(payload[field.name] ?? "").trim();
    if (field.required && !value) {
      return { error: `“${field.label}” cannot be left empty.`, status: 422 as const };
    }
    if (field.pattern && value && !new RegExp(field.pattern, "u").test(value)) {
      return { error: field.patternError || `“${field.label}” is not in the right format.`, status: 422 as const };
    }
    if ((field.type === "url" || field.type === "image") && value && !/^https?:\/\//i.test(value)) {
      return { error: `“${field.label}” needs a full URL starting with https://`, status: 422 as const };
    }
  }
  return null;
}

/** Club-scoped rows must point at a club that exists — no orphans. */
export async function validateReferences(resource: ResourceName, payload: Record<string, string | number>) {
  for (const field of fieldsFor(resource)) {
    if (field.type !== "reference" || !field.reference) continue;
    // Same partial-payload rule as validatePayload: untouched fields stay untouched.
    if (!(field.name in payload)) continue;
    const value = String(payload[field.name] ?? "").trim();
    if (!value) {
      if (field.required) return { error: `Select a value for “${field.label}”.`, status: 422 as const };
      continue;
    }
    const column = field.reference === "clubs" || field.reference === "fairs" ? "slug" : "id";
    if (!(await rowExists(field.reference, column, value))) {
      const label = field.reference === "clubs" ? "club" : "science fair";
      return { error: `No ${label} called “${value}” exists — create it first.`, status: 422 as const };
    }
  }
  return null;
}

export const clubChildResources: ResourceName[] = [
  "club_events", "club_posts", "club_gallery", "club_members", "club_achievements",
];

export { resolveSlug };

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    await requireAdmin();
    const { resource } = await context.params;
    if (!validResource(resource)) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });

    const url = new URL(request.url);
    const clubSlug = url.searchParams.get("club") || undefined;
    const items = await listRows(resource, { clubSlug });
    return NextResponse.json({ items, resource });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    console.error("[admin:list]", error);
    return NextResponse.json({ error: "The data could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = await requireAdmin();
    const { resource } = await context.params;
    if (!validResource(resource)) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
    // The `settings` rows are the site's identity (name, logo, contact details).
    // They are editable by a SuperAdmin only — via the studio or /admin/settings.
    if (resource === "settings" && !isSuperAdminRole(session.role)) {
      return NextResponse.json(
        { error: "Only a SuperAdmin can change site settings.", errorEn: "Only a SuperAdmin can change site settings." },
        { status: 403 },
      );
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const payload = buildPayload(resource, raw, true);

    // Slugs are resolved first so an omitted one can be generated from the title.
    const slugProblem = await resolveSlug(resource, payload);
    if (slugProblem) return NextResponse.json(slugProblem, { status: slugProblem.status });

    const problem = validatePayload(resource, payload);
    if (problem) return NextResponse.json(problem, { status: problem.status });

    const clash = await findUniqueConflict(resource, payload);
    if (clash) return NextResponse.json(clash, { status: clash.status });

    const referenceProblem = await validateReferences(resource, payload);
    if (referenceProblem) return NextResponse.json(referenceProblem, { status: referenceProblem.status });

    const item = await insertRow(resource, payload);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    console.error("[admin:create]", error);
    const message = error instanceof Error && /UNIQUE/i.test(error.message)
      ? "This entry already exists (a unique field repeats)."
      : "Could not save. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
