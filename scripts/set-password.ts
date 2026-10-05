/**
 * Local ops helper — set (or reset) the password of any account.
 *
 * Used when the school's mail provider is not configured yet, or when a
 * SuperAdmin has locked themselves out of the studio and needs the documented
 * default back:
 *
 *   npx tsx scripts/set-password.ts admin@okgs.info 'change-this-password'
 *   npx tsx scripts/set-password.ts teacher@okgs.info            # → generates one
 *
 * The password policy mirrors the reset form (8+ chars, letters + numbers); pass
 * `--force` to bypass it for the seeded development credential only.
 */
import { randomBytes } from "node:crypto";
import { hashPassword, passwordProblem } from "../lib/portal-auth";
import { findUserByEmail, getUser, listUsers, setUserPassword } from "../lib/portal-db";

function usage(): never {
  console.error("Usage: npx tsx scripts/set-password.ts <email|school-id> [password] [--force]");
  process.exit(1);
}

function generate() {
  // Readable but strong: three words worth of entropy in base36 chunks.
  const raw = randomBytes(9).toString("base64url");
  return `${raw.slice(0, 6)}-${raw.slice(6, 12)}`;
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--force");
  const force = process.argv.includes("--force");
  const identifier = (args[0] || "").trim();
  if (!identifier) usage();

  let user = await findUserByEmail(identifier).catch(() => null);
  if (!user) {
    const all = await listUsers();
    user =
      all.find((row) => String(row.student_id || "").toUpperCase() === identifier.toUpperCase()) || null;
  }
  if (!user) {
    console.error(`No account found for “${identifier}”.`);
    process.exit(1);
  }

  const password = args[1]?.trim() || generate();
  if (!args[1]) console.log(`No password given — generated: ${password}`);

  const problem = passwordProblem(password);
  if (problem && !force) {
    console.error(`${problem} (pass --force to set it anyway.)`);
    process.exit(1);
  }

  const { hash, salt } = hashPassword(password);
  await setUserPassword(user.id, hash, salt);
  const fresh = await getUser(user.id);

  console.log(`Password updated for ${fresh?.name || user.name} <${fresh?.email || user.email || user.student_id}>`);
  console.log(`Role: ${fresh?.role || user.role} · ID: ${user.id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
