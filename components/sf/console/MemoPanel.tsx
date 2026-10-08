"use client";

import { useState, useCallback } from "react";
import { useApi, postJson, money } from "./ui";
import { Panel } from "./ui";
import { formatDate, bn } from "@/lib/format";
import { Receipt, Plus, Search, Filter, Download, Printer } from "lucide-react";

interface Memo {
  id: string;
  memo_no: string;
  fair_slug: string;
  title: string;
  amount: number;
  category: string;
  paid_to: string;
  paid_at: string;
  method: string;
  voucher_no: string;
  status: string;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface MemoStats {
  totalMemos: number;
  totalAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  memosByCategory: { category: string; count: number; total: number }[];
  recentMemos: Memo[];
}

export function MemoPanel({ fairSlug }: { fairSlug: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMemo, setNewMemo] = useState({
    title: "",
    amount: "",
    category: "",
    paid_to: "",
    paid_at: formatDate(new Date().toISOString()),
    method: "cash",
    note: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { data, loading, reload } = useApi<MemoStats>(
    `/api/staff/memos?fair=${encodeURIComponent(fairSlug)}&search=${encodeURIComponent(searchQuery)}&status=${statusFilter}&category=${categoryFilter}`,
    [fairSlug, searchQuery, statusFilter, categoryFilter]
  );

  const handleCreateMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    
    try {
      await postJson("/api/staff/memos", {
        ...newMemo,
        fair_slug: fairSlug,
        amount: parseFloat(newMemo.amount) || 0,
        status: "approved",
      });
      setMessage("Memo created successfully!");
      setNewMemo({
        title: "",
        amount: "",
        category: "",
        paid_to: "",
        paid_at: formatDate(new Date().toISOString()),
        method: "cash",
        note: "",
      });
      setShowCreateForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create memo");
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch(
        `/api/staff/memos/export?fair=${encodeURIComponent(fairSlug)}&search=${encodeURIComponent(searchQuery)}&status=${statusFilter}&category=${categoryFilter}`
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memos-${fairSlug}-${formatDate(new Date().toISOString(), "compact")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export CSV");
    }
  };

  const categories = ["all", ...(data?.memosByCategory?.map(c => c.category) || [])];
  const statuses = ["all", "approved", "pending", "rejected", "draft"];

  return (
    <div className="v2-grid" style={{ gap: 16 }}>
      {/* Header with actions */}
      <div className="panel-head" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>Memo Ledger System</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button 
            className="v2-btn v2-btn-sm" 
            type="button" 
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <Plus size={14} /> Create Memo
          </button>
          <button 
            className="v2-btn v2-btn-sm v2-btn-ghost" 
            type="button" 
            onClick={handleExportCSV}
          >
            <Download size={14} /> Export CSV
          </button>
          <button 
            className="v2-btn v2-btn-sm v2-btn-ghost" 
            type="button"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {data && (
        <div className="metric-grid" style={{ marginBottom: 16 }}>
          <div className="metric">
            <span>Total Memos</span>
            <strong>{bn(data.totalMemos)}</strong>
          </div>
          <div className="metric metric-accent">
            <span>Total Amount</span>
            <strong>{money(data.totalAmount)}</strong>
          </div>
          <div className="metric">
            <span>Pending Amount</span>
            <strong>{money(data.pendingAmount)}</strong>
          </div>
          <div className="metric">
            <span>Approved Amount</span>
            <strong>{money(data.approvedAmount)}</strong>
          </div>
        </div>
      )}

      {/* Filters */}
      <Panel title="Filter Memos">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Search size={16} style={{ color: "var(--muted)" }} />
            <input
              type="text"
              placeholder="Search memos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Filter size={16} style={{ color: "var(--muted)" }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ flex: 1, padding: 8, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
            >
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Receipt size={16} style={{ color: "var(--muted)" }} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ flex: 1, padding: 8, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === "all" ? "All Categories" : category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Panel>

      {/* Create Memo Form */}
      {showCreateForm && (
        <Panel title="Create New Memo">
          <form onSubmit={handleCreateMemo} style={{ display: "grid", gap: 12 }}>
            {error && <p style={{ color: "var(--danger)", margin: 0, fontSize: 14 }}>{error}</p>}
            
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Title *</label>
              <input
                type="text"
                value={newMemo.title}
                onChange={(e) => setNewMemo({ ...newMemo, title: e.target.value })}
                placeholder="Memo title or description"
                required
                style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Amount (BDT) *</label>
              <input
                type="number"
                value={newMemo.amount}
                onChange={(e) => setNewMemo({ ...newMemo, amount: e.target.value })}
                placeholder="0"
                required
                step="0.01"
                min="0"
                style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Category *</label>
                <select
                  value={newMemo.category}
                  onChange={(e) => setNewMemo({ ...newMemo, category: e.target.value })}
                  required
                  style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                >
                  <option value="">Select Category</option>
                  <option value="Materials">Materials</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Services">Services</option>
                  <option value="Transport">Transport</option>
                  <option value="Food">Food & Refreshments</option>
                  <option value="Prizes">Prizes & Awards</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Paid To *</label>
                <input
                  type="text"
                  value={newMemo.paid_to}
                  onChange={(e) => setNewMemo({ ...newMemo, paid_to: e.target.value })}
                  placeholder="Recipient name"
                  required
                  style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Method</label>
                <select
                  value={newMemo.method}
                  onChange={(e) => setNewMemo({ ...newMemo, method: e.target.value })}
                  style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="mobile">Mobile Banking</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Date</label>
                <input
                  type="date"
                  value={newMemo.paid_at}
                  onChange={(e) => setNewMemo({ ...newMemo, paid_at: e.target.value })}
                  style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Note</label>
              <textarea
                value={newMemo.note}
                onChange={(e) => setNewMemo({ ...newMemo, note: e.target.value })}
                placeholder="Additional notes (optional)"
                rows={3}
                style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button 
                type="button" 
                className="v2-btn v2-btn-ghost v2-btn-sm"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="v2-btn v2-btn-sm"
              >
                <Receipt size={14} /> Create Memo
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* Memo List */}
      <Panel title={`Recent Memos (${data?.totalMemos || 0})`}>
        {loading ? (
          <p style={{ margin: 0, color: "var(--muted)", textAlign: "center", padding: 20 }}>Loading...</p>
        ) : data?.recentMemos?.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {data.recentMemos.map((memo) => (
              <div 
                key={memo.id} 
                style={{
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12, 
                  padding: "12px 0", 
                  borderBottom: "1px solid var(--line-2)",
                  minWidth: 0
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
                    {memo.memo_no || `Memo #${memo.id.slice(0, 8).toUpperCase()}`}
                  </strong>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    {memo.title} · {memo.category} · {memo.paid_to}
                  </span>
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                    {formatDate(memo.paid_at || memo.created_at)} · {memo.method}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: 16, color: "var(--ink)" }}>
                    {money(memo.amount)}
                  </strong>
                  <span 
                    style={{
                      display: "inline-block", 
                      marginTop: 4, 
                      padding: "2px 8px", 
                      borderRadius: 12, 
                      fontSize: 11, 
                      fontWeight: 600,
                      background: memo.status === "approved" ? "var(--mint-soft)" : 
                                 memo.status === "pending" ? "var(--warn-bg)" : 
                                 "var(--surface-alt-2)",
                      color: memo.status === "approved" ? "var(--mint-text)" : 
                             memo.status === "pending" ? "var(--warn-text)" : 
                             "var(--muted)"
                    }}
                  >
                    {memo.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: "var(--muted)", textAlign: "center", padding: 20 }}>
            No memos found. Create your first memo to get started.
          </p>
        )}
      </Panel>

      {/* Category Distribution */}
      {data?.memosByCategory?.length ? (
        <Panel title="Memos by Category">
          <div style={{ display: "grid", gap: 8 }}>
            {data.memosByCategory.map((item) => (
              <div 
                key={item.category} 
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  {item.category}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {bn(item.count)} memos
                </span>
                <strong style={{ fontSize: 14 }}>
                  {money(item.total)}
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {message && (
        <p style={{ margin: 0, color: "var(--mint-text)", textAlign: "center", padding: 12, background: "var(--mint-soft)", borderRadius: 8 }}>
          {message}
        </p>
      )}
    </div>
  );
}