import { staff, str } from "@/lib/api";
import { listPasses } from "@/lib/portal-db";
import { formatDate, bn } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * CSV Export for Guest Passes
 * Exports guest pass data as CSV for Excel/Sheets
 */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  
  const params = new URL(request.url).searchParams;
  const fairSlug = params.get("fair") || undefined;
  const guestOnly = params.get("guest") === "true";
  
  const passes = await listPasses(fairSlug, 10000); // Large limit for export
  
  // Filter passes if needed
  const filteredPasses = guestOnly 
    ? passes.filter(pass => pass.holder_role === "guest" || pass.guest_limit > 0)
    : passes;
  
  // Generate CSV content
  const csvContent = generatePassCSV(filteredPasses);
  
  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="guest-passes-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function generatePassCSV(passes: Array<{
  id: string;
  fair_slug: string;
  user_id: string;
  holder_name: string;
  holder_role: string;
  student_id: string;
  class_level: string;
  section: string;
  email: string;
  phone: string;
  token: string;
  status: string;
  scan_count: number;
  last_scan_at: string;
  parent_pass_id: string;
  guest_index: number;
  guest_limit: number;
  expires_at: string;
  note: string;
  created_at: string;
  updated_at: string;
}>) {
  const headers = [
    "Pass ID",
    "Type",
    "Holder Name",
    "Student ID",
    "Class",
    "Section",
    "Email",
    "Phone",
    "Guest Limit",
    "Guest Index",
    "Parent Pass ID",
    "Status",
    "Scan Count",
    "Last Scan",
    "Expires At",
    "Created At",
    "Note"
  ];
  
  const rows = passes.map(pass => [
    `"${escapeCSV(pass.id)}"`,
    `"${escapeCSV(pass.holder_role)}"`,
    `"${escapeCSV(pass.holder_name)}"`,
    `"${escapeCSV(pass.student_id)}"`,
    `"${escapeCSV(pass.class_level)}"`,
    `"${escapeCSV(pass.section)}"`,
    `"${escapeCSV(pass.email)}"`,
    `"${escapeCSV(pass.phone)}"`,
    `"${escapeCSV(String(pass.guest_limit))}"`,
    `"${escapeCSV(String(pass.guest_index))}"`,
    `"${escapeCSV(pass.parent_pass_id)}"`,
    `"${escapeCSV(pass.status)}"`,
    `"${escapeCSV(String(pass.scan_count))}"`,
    `"${escapeCSV(formatDate(pass.last_scan_at))}"`,
    `"${escapeCSV(formatDate(pass.expires_at))}"`,
    `"${escapeCSV(formatDate(pass.created_at))}"`,
    `"${escapeCSV(pass.note)}"`
  ]);
  
  // Combine headers and rows
  const csvLines = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ];
  
  return csvLines.join("\n");
}

function escapeCSV(value: string): string {
  if (!value) return "";
  // Escape double quotes by doubling them
  return String(value).replace(/"/g, '""');
}