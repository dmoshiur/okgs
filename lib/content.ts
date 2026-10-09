/**
 * Request-scoped content loading.
 *
 * A page reads the database twice when it has a `generateMetadata` *and* a
 * default export: once for the `<title>`/Open Graph tags and once for the body.
 * Those two reads happen in the same request but are separate awaits, so an edit
 * saved between them (or a slow replica) can render a heading that disagrees
 * with the page — the classic “the title updated but the page didn't” report.
 *
 * `react`'s `cache()` memoises per request, so both calls share one read and the
 * metadata and the markup are guaranteed to describe the same row.
 */
import { cache } from "react";
import { getPublicContent } from "@/lib/db";
import type { PublicContent } from "@/lib/types";

export const loadContent: () => Promise<PublicContent> = cache(async () => getPublicContent());

export type { PublicContent };
