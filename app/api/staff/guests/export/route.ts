import { defaultFairSlug, staff, str } from "@/lib/api";
import { listGuests } from "@/lib/student-db";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * GET /api/staff/guests/export?fair= — the outside-guest register as CSV.
 *
 * Carries the Cloudinary photo URL and the fee columns (entry 50 BDT,
 * optional lunch box 150 BDT, total), so the Excel file the office keeps
 * holds every image path the tickets print from.
 */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;

  const url = new URL(request.url);
  const fair = str(url.searchParams.get("fair")) || (await defaultFairSlug());
  const guests = await listGuests({ fair_slug: fair, limit: 2000 });

  const header = [
    "Guest ID",
    "Name",
    "Relation",
    "Contact",
    "Tagged Student",
    "Student ID",
    "Class",
    "Section",
    "Photo URL",
    "Entry Fee",
    "Lunch Box",
    "Lunch Fee",
    "Total Fee",
    "Fee Status",
    "Status",
    "Registered At",
  ];
  const rows = guests.map((guest) => [
    guest.id.slice(0, 8).toUpperCase(),
    guest.name,
    guest.relation,
    guest.contact,
    guest.related_student_name ?? "",
    guest.related_student_code ?? "",
    guest.related_student_class ?? "",
    guest.related_student_section ?? "",
    guest.photo_url,
    String(guest.entry_fee ?? 50),
    Number(guest.has_lunch) ? "Yes" : "No",
    String(guest.lunch_fee ?? 0),
    String(guest.total_fee ?? 50),
    guest.fee_status || "PAID",
    guest.status,
    guest.created_at,
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="guests-${fair || "fair"}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
