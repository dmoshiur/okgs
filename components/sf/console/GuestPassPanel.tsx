"use client";

import { useState, useCallback } from "react";
import { useApi, postJson, money } from "./ui";
import { Panel } from "./ui";
import { formatDateEn, en } from "@/lib/format";
import { QrCode, Plus, Search, User, Clock, Check, X, Loader2, Calendar, Settings } from "lucide-react";

interface Student {
  id: string;
  name: string;
  student_id: string;
  class_level: string;
  section: string;
  email: string;
  phone: string;
}

interface GuestPass {
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
}

interface GuestPassStats {
  totalPasses: number;
  totalStudents: number;
  passesByClass: { class_level: string; section: string; total: number; students: number }[];
  guestPasses: GuestPass[];
  students: Student[];
}

export function GuestPassPanel({ fairSlug }: { fairSlug: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [expiryDate, setExpiryDate] = useState(formatDateEn(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()));
  const [note, setNote] = useState("");
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [selectedPass, setSelectedPass] = useState<GuestPass | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { data, loading: dataLoading, reload } = useApi<GuestPassStats>(
    `/api/staff/passes?fair=${encodeURIComponent(fairSlug)}&search=${encodeURIComponent(searchQuery)}`,
    [fairSlug, searchQuery]
  );

  const handleAssignGuestPasses = async () => {
    if (!selectedStudent) return;
    
    setLoading(true);
    setError("");
    setMessage("");
    
    try {
      const response = await postJson("/api/staff/passes/guest", {
        fair_slug: fairSlug,
        user_id: selectedStudent.id,
        student_id: selectedStudent.student_id,
        holder_name: selectedStudent.name,
        email: selectedStudent.email,
        phone: selectedStudent.phone,
        class_level: selectedStudent.class_level,
        section: selectedStudent.section,
        guest_count: guestCount,
        expires_at: expiryDate,
        note,
      });
      
      setMessage(`Successfully assigned ${guestCount} guest pass(es) to ${selectedStudent.name}`);
      setShowAssignForm(false);
      setSelectedStudent(null);
      setGuestCount(1);
      setNote("");
      await reload();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign guest passes");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async (pass: GuestPass) => {
    setSelectedPass(pass);
    setLoading(true);
    
    try {
      // Generate QR code URL for this pass
      const qrUrl = `/api/staff/passes/qr?token=${encodeURIComponent(pass.token)}&pass_id=${pass.id}`;
      setQrCodeUrl(qrUrl);
      setShowQRModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokePass = async (passId: string) => {
    setLoading(true);
    setError("");
    
    try {
      await postJson("/api/staff/passes/revoke", {
        pass_id: passId,
      });
      
      setMessage("Pass revoked successfully");
      await reload();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke pass");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch(
        `/api/staff/passes/export?fair=${encodeURIComponent(fairSlug)}&guest=true`
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guest-passes-${fairSlug}-${formatDateEn(new Date().toISOString(), "short")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export CSV");
    }
  };

  const guestCounts = [1, 2, 3, 4];

  return (
    <div className="v2-grid" style={{ gap: 16 }}>
      {/* Header */}
      <div className="panel-head" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>Multi-Pass / Parent QR Access</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button 
            className="v2-btn v2-btn-sm" 
            type="button" 
            onClick={() => setShowAssignForm(true)}
          >
            <Plus size={14} /> Assign Guest Passes
          </button>
          <button 
            className="v2-btn v2-btn-sm v2-btn-ghost" 
            type="button" 
            onClick={handleExportCSV}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {data && (
        <div className="metric-grid" style={{ marginBottom: 16 }}>
          <div className="metric">
            <span>Total Students</span>
            <strong>{en(data.totalStudents)}</strong>
          </div>
          <div className="metric metric-accent">
            <span>Total Passes</span>
            <strong>{en(data.totalPasses)}</strong>
          </div>
          <div className="metric">
            <span>Guest Passes</span>
            <strong>{en(data.guestPasses?.length || 0)}</strong>
          </div>
          <div className="metric">
            <span>Active Passes</span>
            <strong>{en(data.guestPasses?.filter(p => p.status === "active").length || 0)}</strong>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <Search size={16} style={{ color: "var(--muted)" }} />
        <input
          type="text"
          placeholder="Search students or passes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
        />
      </div>

      {/* Assign Guest Passes Form */}
      {showAssignForm && (
        <Panel title="Assign Guest Passes">
          <div style={{ display: "grid", gap: 12 }}>
            {error && <p style={{ color: "var(--danger)", margin: 0, fontSize: 14 }}>{error}</p>}
            
            {/* Student Selection */}
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                Select Student *
              </label>
              <select
                value={selectedStudent?.id || ""}
                onChange={(e) => {
                  const studentId = e.target.value;
                  const student = data?.students?.find(s => s.id === studentId);
                  setSelectedStudent(student || null);
                }}
                style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
              >
                <option value="">Select a student</option>
                {data?.students?.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.student_id}) - {student.class_level}{student.section ? ` · ${student.section}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedStudent && (
              <div style={{ 
                display: "grid", 
                gap: 8, 
                padding: 12, 
                background: "var(--surface-alt)", 
                borderRadius: 8 
              }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                  Selected Student:
                </p>
                <p style={{ margin: 0, fontSize: 13 }}>
                  <strong>{selectedStudent.name}</strong> ({selectedStudent.student_id})
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                  {selectedStudent.class_level}{selectedStudent.section ? ` · ${selectedStudent.section}` : ""}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                  {selectedStudent.email} · {selectedStudent.phone}
                </p>
              </div>
            )}

            {/* Guest Count */}
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                Number of Guest Passes *
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {guestCounts.map(count => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setGuestCount(count)}
                    style={{
                      padding: "8px 16px",
                      border: guestCount === count ? "2px solid var(--brand)" : "1px solid var(--line)",
                      borderRadius: 8,
                      background: guestCount === count ? "var(--brand)" : "var(--surface)",
                      color: guestCount === count ? "#fff" : "var(--ink)",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {count} Pass{count > 1 ? "es" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiry Date */}
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                Expiry Date *
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={formatDateEn(new Date().toISOString())}
                style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            {/* Note */}
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Additional notes about these guest passes"
                rows={3}
                style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 14, resize: "vertical" }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button 
                type="button" 
                className="v2-btn v2-btn-ghost v2-btn-sm"
                onClick={() => {
                  setShowAssignForm(false);
                  setSelectedStudent(null);
                  setGuestCount(1);
                  setNote("");
                }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="v2-btn v2-btn-sm"
                onClick={handleAssignGuestPasses}
                disabled={!selectedStudent || loading}
              >
                {loading ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                Assign Guest Passes
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* Guest Passes List */}
      <Panel title="Guest Passes">
        {dataLoading ? (
          <p style={{ margin: 0, color: "var(--muted)", textAlign: "center", padding: 20 }}>Loading...</p>
        ) : data?.guestPasses?.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {data.guestPasses.map((pass) => (
              <div 
                key={pass.id} 
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <User size={16} style={{ color: "var(--brand-mid)" }} />
                    <strong style={{ fontSize: 14 }}>
                      {pass.holder_name}
                    </strong>
                    <span style={{ 
                      fontSize: 11, 
                      padding: "2px 6px", 
                      borderRadius: 4, 
                      background: "var(--mint-soft)", 
                      color: "var(--mint-text)"
                    }}>
                      +{pass.guest_limit} Guest{pass.guest_limit > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {pass.student_id} · {pass.class_level}{pass.section ? ` · ${pass.section}` : ""}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                    <Calendar size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                    Expires: {formatDateEn(pass.expires_at)}
                    {pass.last_scan_at && (
                      <>
                        <span style={{ marginLeft: 12 }}>|</span>
                        <span style={{ marginLeft: 12 }}>
                          Last scan: {formatDateEn(pass.last_scan_at)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button 
                    type="button" 
                    className="v2-btn v2-btn-sm"
                    onClick={() => handleGenerateQR(pass)}
                    title="Generate QR Code"
                  >
                    <QrCode size={14} />
                  </button>
                  {pass.status === "active" && (
                    <button 
                      type="button" 
                      className="v2-btn v2-btn-sm v2-btn-danger"
                      onClick={() => handleRevokePass(pass.id)}
                      title="Revoke Pass"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: "var(--muted)", textAlign: "center", padding: 20 }}>
            No guest passes assigned yet. Use the "Assign Guest Passes" button to get started.
          </p>
        )}
      </Panel>

      {/* Class-wise Distribution */}
      {data?.passesByClass?.length ? (
        <Panel title="Passes by Class">
          <div style={{ display: "grid", gap: 8 }}>
            {data.passesByClass.map((item) => (
              <div 
                key={`${item.class_level}-${item.section}`} 
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  {item.class_level}{item.section && item.section !== "—" ? ` · ${item.section}` : ""}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {en(item.students)} students
                </span>
                <strong style={{ fontSize: 14 }}>
                  {en(item.total)} passes
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* Time-Bound Notification Ticker */}
      <Panel title="Time-Bound Notification Ticker">
        <p style={{ margin: "0 0 16px", color: "var(--body)", fontSize: 14 }}>
          Create global or targeted banner tickers that are scheduled by Start Date/Time and End Date/Time with automatic expiration.
        </p>
        
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="v2-btn v2-btn-sm" type="button">
              <Plus size={14} /> Create Ticker
            </button>
            <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button">
              <Settings size={14} /> Manage Active Tickers
            </button>
          </div>
          
          <div style={{ 
            padding: 16, 
            background: "var(--surface-alt)", 
            borderRadius: 8, 
            border: "1px solid var(--line)" 
          }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>
              Ticker Features:
            </h4>
            <ul style={{ 
              margin: 0, 
              paddingLeft: 20, 
              fontSize: 13, 
              color: "var(--body)", 
              lineHeight: 1.6 
            }}>
              <li>Schedule tickers with start and end dates/times</li>
              <li>Automatic expiration when end time is reached</li>
              <li>Target specific audiences (students, teachers, parents)</li>
              <li>Display on Science Fair dashboard and club sites</li>
              <li>Multiple active tickers with priority ordering</li>
            </ul>
          </div>
        </div>
      </Panel>

      {message && (
        <p style={{ margin: 0, color: "var(--mint-text)", textAlign: "center", padding: 12, background: "var(--mint-soft)", borderRadius: 8 }}>
          {message}
        </p>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedPass && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: "white",
            borderRadius: 12,
            padding: 24,
            maxWidth: 500,
            width: "90%",
            maxHeight: "80vh",
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>QR Code for Guest Pass</h3>
              <button 
                type="button" 
                onClick={() => setShowQRModal(false)}
                style={{ 
                  background: "none", 
                  border: "none", 
                  cursor: "pointer", 
                  fontSize: 20, 
                  color: "var(--muted)" 
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--body)" }}>
                <strong>{selectedPass.holder_name}</strong>
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                {selectedPass.student_id} · {selectedPass.class_level}{selectedPass.section ? ` · ${selectedPass.section}` : ""}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                +{selectedPass.guest_limit} Guest Pass{selectedPass.guest_limit > 1 ? "es" : ""}
              </p>
              <p style={{ margin: "4px 0 8px", fontSize: 12, color: "var(--muted)" }}>
                Expires: {formatDateEn(selectedPass.expires_at)}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                Pass ID: {selectedPass.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            
            <div style={{ 
              textAlign: "center", 
              padding: 20, 
              background: "var(--surface-alt)", 
              borderRadius: 8, 
              marginBottom: 16 
            }}>
              {/* QR Code Display */}
              <div style={{ 
                display: "inline-block",
                padding: 16,
                background: "white",
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
              }}>
                <img 
                  src={qrCodeUrl}
                  alt={`QR Code for ${selectedPass.holder_name}`}
                  style={{ width: 200, height: 200 }}
                />
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--muted)" }}>
                Scan this QR code for guest entry verification
              </p>
            </div>
            
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button 
                type="button" 
                className="v2-btn v2-btn-ghost v2-btn-sm"
                onClick={() => setShowQRModal(false)}
              >
                Close
              </button>
              <button 
                type="button" 
                className="v2-btn v2-btn-sm"
                onClick={() => {
                  // Download QR code
                  const link = document.createElement("a");
                  link.href = qrCodeUrl;
                  link.download = `qr-pass-${selectedPass.id}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                Download QR Code
              </button>
              <button 
                type="button" 
                className="v2-btn v2-btn-sm"
                onClick={() => {
                  // Print QR code
                  const printWindow = window.open("", "_blank");
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>QR Pass - ${selectedPass.holder_name}</title>
                          <style>
                            body { text-align: center; padding: 20px; font-family: Arial, sans-serif; }
                            h1 { font-size: 18px; margin-bottom: 10px; }
                            p { font-size: 12px; color: #666; margin: 5px 0; }
                            .qr-code { margin: 20px 0; }
                            .qr-code img { width: 200px; height: 200px; }
                          </style>
                        </head>
                        <body>
                          <h1>Guest Pass QR Code</h1>
                          <p><strong>${selectedPass.holder_name}</strong></p>
                          <p>${selectedPass.student_id} · ${selectedPass.class_level}${selectedPass.section ? ` · ${selectedPass.section}` : ""}</p>
                          <p>+${selectedPass.guest_limit} Guest Pass${selectedPass.guest_limit > 1 ? "es" : ""}</p>
                          <p>Expires: ${formatDateEn(selectedPass.expires_at)}</p>
                          <p>Pass ID: ${selectedPass.id.slice(0, 8).toUpperCase()}</p>
                          <div class="qr-code">
                            <img src="${qrCodeUrl}" alt="QR Code" />
                          </div>
                          <p>Scan this QR code for guest entry verification</p>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                  }
                }}
              >
                Print Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Download icon component
function Download({ size = 14, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg {...props} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}