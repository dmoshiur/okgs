/**
 * Role vocabulary — client-safe (no node imports), so the console components can
 * use the labels without dragging the database layer into the bundle.
 *
 * The vocabulary is canonical for the whole app:
 *
 *   superadmin → owner of the installation. Site settings + the emergency
 *                maintenance switch are SuperAdmin-only, and a SuperAdmin can
 *                always reach the dashboard while the public site is down.
 *   admin      → school administrator (full content studio, no system switch).
 *   teacher    → teaching staff (fair console, scanner, funds).
 *   staff      → office staff (fair console, imports, collections).
 *   club       → club admin (single club micro-site).
 *   student    → “User” in the UI: a learner with a personal dashboard (/me).
 *   alumni     → former learner — same dashboard as a student.
 *   guest      → read-only portal visitor.
 */
export type PortalRole =
  | "superadmin"
  | "admin"
  | "teacher"
  | "club"
  | "staff"
  | "student"
  | "alumni"
  | "guest";

/** Bangla labels — the public portal (/sf, /me) keeps speaking Bangla. */
export const roleLabels: Record<PortalRole, string> = {
  superadmin: "সুপার অ্যাডমিন",
  admin: "অ্যাডমিন",
  teacher: "শিক্ষক",
  club: "ক্লাব অ্যাডমিন",
  staff: "কর্মচারী",
  student: "শিক্ষার্থী",
  alumni: "প্রাক্তন শিক্ষার্থী",
  guest: "অতিথি",
};

/** English labels — the admin studio is English-only. */
export const roleLabelsEn: Record<PortalRole, string> = {
  superadmin: "SuperAdmin",
  admin: "Admin",
  teacher: "Teacher",
  club: "Club Admin",
  staff: "Staff",
  student: "Student",
  alumni: "Alumni",
  guest: "Guest",
};

export const allRoles: PortalRole[] = [
  "superadmin",
  "admin",
  "teacher",
  "club",
  "staff",
  "student",
  "alumni",
  "guest",
];

/** Roles that can open the fair console (/sf) and use the scanner. */
export const staffRoles: PortalRole[] = ["superadmin", "admin", "teacher", "staff"];

/** Roles that rule the admin studio. */
export const adminRoles: PortalRole[] = ["superadmin", "admin"];

/** Roles a SuperAdmin may hand out from the user manager. */
export const assignableRoles: PortalRole[] = [
  "superadmin",
  "admin",
  "teacher",
  "staff",
  "club",
  "student",
  "alumni",
  "guest",
];

export function isSuperAdminRole(role: string): boolean {
  return role === "superadmin";
}

export function isAdminRole(role: string): boolean {
  return adminRoles.includes(role as PortalRole);
}

export function isStaffRole(role: string): boolean {
  return staffRoles.includes(role as PortalRole);
}

export function isPortalRole(role: string): role is PortalRole {
  return allRoles.includes(role as PortalRole);
}

/**
 * Where a role lands after signing in — used by both login APIs so no page has
 * to guess. Club admins get their own micro-site (the API resolves the slug and
 * falls back to the fair console when the account has none).
 */
export function dashboardPathForRole(role: PortalRole): string {
  if (isAdminRole(role)) return "/admin";
  if (role === "club") return "/sf";
  if (role === "teacher" || role === "staff") return "/sf";
  return "/me";
}
