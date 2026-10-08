import type { Metadata } from "next";
import { sfConsoleProps } from "@/lib/sf-console";
import { FairConsole } from "@/components/sf/FairConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Science Fair console",
  robots: { index: false, follow: false },
};

/** `/sf` — the console dashboard. Every other section has its own route. */
export default async function ConsolePage() {
  const props = await sfConsoleProps("dashboard");
  return <FairConsole {...props} />;
}
