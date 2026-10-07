/**
 * Role vocabulary — client-safe (no node imports), so the console components can
 * use the labels without dragging the database layer into the bundle.
 *
 * The vocabulary is canonical for the whole app:
 *
 *   superadmin → owner of the installation. Site settings + the emergency
 *                maintenance switch are SuperAdmin-only.
 *   admin      → school administrator (full content studio).
 *   teacher    → teaching staff (fair console, scanner, funds).
 *   staff      → office staff (fair console, imports, collections).
 *   club       → club admin (single club micro-site).
 *   student    → learner with a personal dashboard (/me).
 *   alumni     → former learner — same dashboard as a student.
 *   volunteer  → volunteer account with a personal portal.
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
  | "volunteer"
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
  volunteer: "স্বেচ্ছাসেবক",
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
  volunteer: "Volunteer",
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
  "volunteer",
  "guest",
];

/** Roles that can open the fair console (/sf) and use the scanner. */
export const staffRoles: PortalRole[] = ["superadmin", "admin", "teacher", "staff"];

/** Roles that rule the admin studio. */
export const adminRoles: PortalRole[] = ["superadmin", "admin"];

/** Roles a SuperAdmin may hand out from the user manager. */
export const assignableRoles: PortalRole[] = [...allRoles];

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

export function normalizePortalRole(value: unknown): PortalRole | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[\s_-]+/g, "");
  const direct = allRoles.find((role) => role.toLowerCase() === key);
  if (direct) return direct;
  const aliases: Record<string, PortalRole> = {
    superadministrator: "superadmin", superadmin: "superadmin", administrator: "admin", teacher: "teacher", teachers: "teacher",
    faculty: "teacher", staff: "staff", office: "staff", clubadmin: "club", clubadministrator: "club", student: "student", learner: "student",
    students: "student", pupil: "student", alumni: "alumni", alumnus: "alumni", volunteer: "volunteer", volunteers: "volunteer", guest: "guest", visitor: "guest",
  };
  if (aliases[key]) return aliases[key];
  return allRoles.find((role) => [roleLabels[role], roleLabelsEn[role]].some((label) => label.toLowerCase().replace(/[\s_-]+/g, "") === key)) ?? null;
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
