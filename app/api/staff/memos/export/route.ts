import { staff, str } from "@/lib/api";
import { listMemos } from "@/lib/portal-db";
import { formatDate, bn } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * CSV Export for Memos
 * Exports filtered memo data as CSV for Excel/Sheets
 */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  
  const params = new URL(request.url).searchParams;
  const fairSlug = params.get("fair") || undefined;
  const search = params.get("search") || "";
  const status = params.get("status") || "all";
  const category = params.get("category") || "all";
  
  const memos = await listMemos(fairSlug, 10000); // Large limit for export
  
  // Filter memos based on parameters
  const filteredMemos = memos.filter(memo => {
    if (fairSlug && memo.fair_slug !== fairSlug) return false;
    if (status !== "all" && memo.status !== status) return false;
    if (category !== "all" && memo.category !== category) return false;
    if (search && !memo.title.toLowerCase().includes(search.toLowerCase()) &&
        !memo.paid_to.toLowerCase().includes(search.toLowerCase()) &&
        !memo.memo_no.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  
  // Generate CSV content
  const csvContent = generateMemoCSV(filteredMemos);
  
  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="memos-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function generateMemoCSV(memos: Array<{
  id: string;
  fair_slug: string;
  memo_no: string;
  title: string;
  amount: number;
  category: string;
  paid_to: string;
  paid_at: string;
  method: string;
  voucher_no: string;
  note: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}>) {
  const headers = [
    "Memo No",
    "Date",
    "Title",
    "Category",
    "Paid To",
    "Amount (BDT)",
    "Method",
    "Voucher No",
    "Status",
    "Created By",
    "Created At",
    "Note"
  ];
  
  const rows = memos.map(memo => [
    `"${escapeCSV(memo.memo_no || memo.id.slice(0, 8).toUpperCase())}"`,
    `"${escapeCSV(formatDate(memo.paid_at || memo.created_at))}"`,
    `"${escapeCSV(memo.title)}"`,
    `"${escapeCSV(memo.category)}"`,
    `"${escapeCSV(memo.paid_to)}"`,
    `"${escapeCSV(bn(Math.round(memo.amount || 0)))}"`,
    `"${escapeCSV(memo.method)}"`,
    `"${escapeCSV(memo.voucher_no)}"`,
    `"${escapeCSV(memo.status)}"`,
    `"${escapeCSV(memo.created_by)}"`,
    `"${escapeCSV(formatDate(memo.created_at))}"`,
    `"${escapeCSV(memo.note)}"`
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