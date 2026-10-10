import { Scanner } from "@/components/sf/Scanner";
import { sfConsoleProps } from "@/lib/sf-console";
import type { ScanMode } from "@/lib/scan-types";

/** Both stations use the same staff guard and cookie-selected fair as the console. */
export async function ScannerPage({ mode }: { mode: ScanMode }) {
  const props = await sfConsoleProps(mode === "lunch" ? "canteen" : "scan");
  return <Scanner fairSlug={props.activeFairSlug} fairName={props.fairName} initialMode={mode} />;
}
