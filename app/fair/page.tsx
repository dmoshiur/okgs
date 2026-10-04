import { redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { activeFair } from "@/lib/site";

export const dynamic = "force-dynamic";

/** /fair always lands on whichever fair is currently switched on. */
export default async function FairIndexPage() {
  const content = await getPublicContent();
  const fair = activeFair(content);
  if (!fair) redirect("/");
  redirect(`/fair/${fair.slug}`);
}
