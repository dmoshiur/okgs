import { getPublicContent } from "@/lib/db";
import { PublicHome } from "@/components/public/PublicHome";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = await getPublicContent();
  return <PublicHome content={content} />;
}
