"use client";

import { InternalPageError } from "@/components/public/InternalPageError";

export default function ClubsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <InternalPageError onRetry={reset} />;
}
