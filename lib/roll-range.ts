/**
 * Roll-number expressions for bulk payment marking.
 *
 * "1, 2, 5, 8, 12-15" → {1, 2, 5, 8, 12, 13, 14, 15}
 *
 * Separators can be commas, semicolons or spaces. Numeric rolls are compared by
 * value (so "01" and "1" match), non-numeric rolls by exact text.
 */
export const MAX_ROLL_RANGE = 1000;

export function normalizeRoll(value: unknown): string {
  const text = String(value ?? "").trim();
  if (/^\d+$/.test(text)) return String(Number(text));
  return text;
}

export function parseRollExpression(input: string): { rolls: Set<string>; error: string } {
  const rolls = new Set<string>();
  const tokens = String(input ?? "")
    .split(/[,;\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from > to) return { rolls, error: `Invalid range "${token}": start is greater than end.` };
      if (to - from + 1 > MAX_ROLL_RANGE) return { rolls, error: `Range "${token}" is too large (max ${MAX_ROLL_RANGE} rolls).` };
      for (let value = from; value <= to; value += 1) rolls.add(String(value));
      continue;
    }
    if (/^[0-9A-Za-z._/-]+$/.test(token)) {
      rolls.add(normalizeRoll(token));
      continue;
    }
    return { rolls, error: `"${token}" is not a valid roll number.` };
  }
  return { rolls, error: "" };
}
