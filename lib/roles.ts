/**
 * Role vocabulary — client-safe (no node imports), so the console components can
 * use the Bangla labels without dragging the database layer into the bundle.
 */
export type PortalRole = "admin" | "teacher" | "club" | "student" | "alumni" | "staff" | "guest";

export const roleLabels: Record<PortalRole, string> = {
  admin: "অ্যাডমিন",
  teacher: "শিক্ষক",
  club: "ক্লাব অ্যাডমিন",
  staff: "কর্মচারী",
  student: "শিক্ষার্থী",
  alumni: "প্রাক্তন শিক্ষার্থী",
  guest: "অতিথি",
};

export const allRoles: PortalRole[] = ["admin", "teacher", "club", "staff", "student", "alumni", "guest"];

/** Roles that can open the fair console (/sf) and use the scanner. */
export const staffRoles: PortalRole[] = ["admin", "teacher", "staff"];

export function isStaffRole(role: string): boolean {
  return staffRoles.includes(role as PortalRole);
}

export function isAdminRole(role: string): boolean {
  return role === "admin";
}
