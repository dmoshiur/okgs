/**
 * Gate result vocabulary shared by the scanner, the console dashboard and the
 * reports panel, so a row is described with the same English words everywhere.
 *
 * The database keeps the lowercase code (`success` / `duplicate` / `expired` /
 * `invalid`); the UI never shows the raw value.
 */
export type GateResult = "success" | "duplicate" | "expired" | "invalid";

export const GATE_RESULTS: GateResult[] = ["success", "duplicate", "expired", "invalid"];

export const GATE_RESULT_LABEL: Record<string, string> = {
  success: "Success",
  duplicate: "Duplicate",
  expired: "Expired",
  invalid: "Invalid",
};

/** Badge modifier for the SF badge styles (green / amber / red). */
export function gateResultClass(result: string) {
  return result === "success" ? "is-good" : result === "duplicate" || result === "expired" ? "is-warn" : "is-bad";
}

export function gateResultLabel(result: string) {
  return GATE_RESULT_LABEL[result] ?? "Recorded";
}
