/** Printable guest reference. The full database ID remains the authoritative identity. */
export function guestTicketId(id: string) {
  return id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "—";
}
