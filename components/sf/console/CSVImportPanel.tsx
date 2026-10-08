"use client";

import { useState, useCallback } from "react";
import { useApi, postJson, money } from "./ui";
import { Panel } from "./ui";
import { formatDateEn, en } from "@/lib/format";
import { Upload, Users, Check, X, Loader2, FileText, Eye, EyeOff } from "lucide-react";

interface CSVRow {
  id: string;
  name: string;
  name_en: string;
  email: string;
  student_id: string;
  class_level: string;
  section: string;
  roll: string;
  phone: string;
  role: string;
  club_slug: string;
  designation: string;
  [key: string]: string;
}

interface CSVPreview {
  headers: string[];
  rows: CSVRow[];
  totalRows: number;
  mappedRoles: Record<string, string>;
}

export function CSVImportPanel({ fairSlug }: { fairSlug: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [roleMapping, setRoleMapping] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [passwordSettings, setPasswordSettings] = useState({
    generatePasswords: true,
    passwordLength: 8,
    sendCredentials: true,
  });

  // Available roles for mapping
  const availableRoles = ["student", "teacher", "volunteer", "admin", "superadmin", "alumni"];

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    setError("");
    setMessage("");
    setFile(uploadedFile);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setLoading(true);
        const content = event.target?.result as string;
        const parsed = parseCSV(content);
        
        // Auto-detect role column and create initial mapping
        const roleColumn = parsed.headers.find(h => 
          h.toLowerCase().includes("role") || h.toLowerCase().includes("type")
        );
        
        const initialMapping: Record<string, string> = {};
        if (roleColumn) {
          // Get unique roles from the CSV
          const uniqueRoles = [...new Set(parsed.rows.map(row => row[roleColumn]?.toLowerCase().trim()))];
          uniqueRoles.forEach(role => {
            if (role && !availableRoles.includes(role)) {
              // Map unknown roles to student by default
              initialMapping[role] = "student";
            }
          });
        }
        
        setRoleMapping(initialMapping);
        setPreview({
          ...parsed,
          mappedRoles: initialMapping,
        });
        
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV file");
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsText(uploadedFile);
  }, []);

  const handleRoleChange = (csvRole: string, targetRole: string) => {
    setRoleMapping(prev => ({
      ...prev,
      [csvRole]: targetRole,
    }));
  };

  const handleImport = async () => {
    if (!preview || !file) return;
    
    setLoading(true);
    setError("");
    setMessage("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fair_slug", fairSlug);
      formData.append("role_mapping", JSON.stringify(roleMapping));
      formData.append("generate_passwords", String(passwordSettings.generatePasswords));
      formData.append("password_length", String(passwordSettings.passwordLength));
      formData.append("send_credentials", String(passwordSettings.sendCredentials));
      
      const response = await fetch("/api/staff/import/csv", {
        method: "POST",
        body: formData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to import CSV");
      }
      
      setMessage(`Successfully imported ${result.imported || 0} users!`);
      setFile(null);
      setPreview(null);
      setRoleMapping({});
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import CSV");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setError("");
    setMessage("");
    setRoleMapping({});
  };

  const parseCSV = (content: string): CSVPreview => {
    const lines = content.split("\n").filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error("CSV file must have headers and at least one data row");
    }
    
    // Parse headers
    const headers = parseCSVLine(lines[0]);
    
    // Parse data rows
    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row = { id: `row-${i}` } as CSVRow;
      
      headers.forEach((header, index) => {
        const cleanHeader = header.toLowerCase().trim();
        const cleanValue = values[index]?.trim() || "";
        
        // Map common header names to our schema
        if (cleanHeader.includes("name") && !cleanHeader.includes("en")) {
          row.name = cleanValue;
        } else if (cleanHeader.includes("name") && cleanHeader.includes("en")) {
          row.name_en = cleanValue;
        } else if (cleanHeader.includes("email")) {
          row.email = cleanValue;
        } else if (cleanHeader.includes("student") || cleanHeader.includes("id")) {
          row.student_id = cleanValue;
        } else if (cleanHeader.includes("class")) {
          row.class_level = cleanValue;
        } else if (cleanHeader.includes("section")) {
          row.section = cleanValue;
        } else if (cleanHeader.includes("roll")) {
          row.roll = cleanValue;
        } else if (cleanHeader.includes("phone") || cleanHeader.includes("mobile")) {
          row.phone = cleanValue;
        } else if (cleanHeader.includes("role") || cleanHeader.includes("type")) {
          row.role = cleanValue;
        } else if (cleanHeader.includes("club")) {
          row.club_slug = cleanValue;
        } else if (cleanHeader.includes("designation")) {
          row.designation = cleanValue;
        } else {
          // Store additional columns with their header names
          row[header] = cleanValue;
        }
      });
      
      rows.push(row);
    }
    
    return {
      headers,
      rows,
      totalRows: rows.length,
      mappedRoles: {},
    };
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  // Get unique roles from preview that need mapping
  const uniqueRoles = preview ? [...new Set(
    preview.rows
      .map(row => row.role?.toLowerCase().trim())
      .filter(Boolean)
      .filter(role => !availableRoles.includes(role))
  )] : [];

  return (
    <div className="v2-grid" style={{ gap: 16 }}>
      <Panel title="Smart CSV Student Import">
        <p style={{ margin: "0 0 16px", color: "var(--body)", fontSize: 14 }}>
          Upload a CSV file containing student, teacher, or user records. The system will parse the data and allow you to map roles before importing.
        </p>
        
        {/* Upload Section */}
        <div 
          style={{
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            gap: 16, 
            padding: 24, 
            border: "2px dashed var(--line)", 
            borderRadius: 12, 
            background: "var(--surface-alt)",
            cursor: "pointer",
            transition: "border-color 0.2s ease",
          }}
          onClick={() => document.getElementById("csv-upload")?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = "var(--brand-mid)";
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = "var(--line)";
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = "var(--line)";
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile) {
              const event = { target: { files: [droppedFile] } } as unknown as React.ChangeEvent<HTMLInputElement>;
              handleFileUpload(event);
            }
          }}
        >
          <input
            id="csv-upload"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <Upload size={24} style={{ color: "var(--brand-mid)" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              {file ? file.name : "Click to upload or drag and drop CSV file"}
            </p>
            <p style={{ margin: 4, fontSize: 12, color: "var(--muted)" }}>
              {file ? `(${formatFileSize(file.size)})` : "Supports .csv files"}
            </p>
          </div>
        </div>

        {error && (
          <p style={{ 
            margin: "16px 0 0", 
            padding: 12, 
            background: "#fef2f2", 
            border: "1px solid #fecaca", 
            borderRadius: 8, 
            color: "#b91c1c", 
            fontSize: 14 
          }}>
            {error}
          </p>
        )}

        {message && (
          <p style={{ 
            margin: "16px 0 0", 
            padding: 12, 
            background: "var(--mint-soft)", 
            border: "1px solid var(--mint-line)", 
            borderRadius: 8, 
            color: "var(--mint-text)", 
            fontSize: 14 
          }}>
            {message}
          </p>
        )}

        {loading && !preview && (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: 8, 
            padding: 16, 
            color: "var(--muted)" 
          }}>
            <Loader2 size={16} className="spin" />
            <span>Parsing CSV file...</span>
          </div>
        )}

        {/* Preview Section */}
        {preview && (
          <>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between", 
              gap: 12, 
              padding: "12px 0", 
              borderBottom: "1px solid var(--line-2)",
              margin: "16px 0" 
            }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                Preview ({preview.totalRows} records)
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  type="button" 
                  className="v2-btn v2-btn-sm v2-btn-ghost"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <EyeOff size={14} /> : <Eye size={14} />} 
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </button>
              </div>
            </div>

            {/* Role Mapping Section */}
            {uniqueRoles.length > 0 && (
              <Panel title="Role Mapping">
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--body)" }}>
                  The following roles from your CSV need to be mapped to OKGS roles:
                </p>
                <div style={{ display: "grid", gap: 12 }}>
                  {uniqueRoles.map(csvRole => (
                    <div 
                      key={csvRole} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 12, 
                        padding: 8, 
                        background: "var(--surface-alt)", 
                        borderRadius: 8 
                      }}
                    >
                      <span style={{ 
                        flex: 1, 
                        fontSize: 13, 
                        fontWeight: 600, 
                        color: "var(--ink)" 
                      }}>
                        {csvRole}
                      </span>
                      <select
                        value={roleMapping[csvRole] || "student"}
                        onChange={(e) => handleRoleChange(csvRole, e.target.value)}
                        style={{ 
                          padding: 6, 
                          border: "1px solid var(--line)", 
                          borderRadius: 6, 
                          fontSize: 13 
                        }}
                      >
                        {availableRoles.map(role => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Credential Settings */}
            <Panel title="Credential Settings">
              <div style={{ display: "grid", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={passwordSettings.generatePasswords}
                    onChange={(e) => setPasswordSettings({ 
                      ...passwordSettings, 
                      generatePasswords: e.target.checked 
                    })}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 13, color: "var(--ink)" }}>
                    Auto-generate secure passwords
                  </span>
                </label>
                
                {passwordSettings.generatePasswords && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--body)" }}>
                      Password length:
                    </span>
                    <select
                      value={passwordSettings.passwordLength}
                      onChange={(e) => setPasswordSettings({ 
                        ...passwordSettings, 
                        passwordLength: Number(e.target.value) 
                      })}
                      style={{ padding: 6, border: "1px solid var(--line)", borderRadius: 6, fontSize: 13 }}
                    >
                      {[6, 8, 10, 12].map(len => (
                        <option key={len} value={len}>{len} characters</option>
                      ))}
                    </select>
                  </div>
                )}

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={passwordSettings.sendCredentials}
                    onChange={(e) => setPasswordSettings({ 
                      ...passwordSettings, 
                      sendCredentials: e.target.checked 
                    })}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 13, color: "var(--ink)" }}>
                    Send welcome credentials via email (requires SMTP configuration)
                  </span>
                </label>
              </div>
            </Panel>

            {/* CSV Preview Table */}
            {showPreview && (
              <div style={{ 
                border: "1px solid var(--line)", 
                borderRadius: 8, 
                background: "var(--surface)", 
                overflow: "hidden" 
              }}>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8, 
                  padding: 12, 
                  background: "var(--surface-alt)", 
                  borderBottom: "1px solid var(--line)", 
                  fontSize: 12, 
                  fontWeight: 600, 
                  color: "var(--muted)",
                  overflowX: "auto"
                }}>
                  {preview.headers.map((header, index) => (
                    <span key={index} style={{ minWidth: 120, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {header}
                    </span>
                  ))}
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {preview.rows.slice(0, 10).map((row, rowIndex) => (
                    <div 
                      key={row.id} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 8, 
                        padding: "8px 12px", 
                        borderBottom: "1px solid var(--line-2)",
                        fontSize: 12,
                        minWidth: "fit-content"
                      }}
                    >
                      {preview.headers.map((header, colIndex) => {
                        const cleanHeader = header.toLowerCase().trim();
                        let value = row[header] || row[cleanHeader] || row[header.replace(/\s+/g, "_")] || "";
                        
                        // Map role to the mapped value
                        if ((cleanHeader.includes("role") || cleanHeader.includes("type")) && row.role) {
                          value = roleMapping[row.role.toLowerCase()] || row.role;
                        }
                        
                        return (
                          <span 
                            key={colIndex} 
                            style={{ 
                              minWidth: 120, 
                              textOverflow: "ellipsis", 
                              whiteSpace: "nowrap",
                              color: cleanHeader.includes("role") || cleanHeader.includes("type") 
                                ? "var(--brand-mid)" 
                                : "var(--ink)"
                            }}
                          >
                            {value}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                  {preview.totalRows > 10 && (
                    <div style={{ 
                      padding: "8px 12px", 
                      textAlign: "center", 
                      color: "var(--muted)", 
                      fontSize: 12 
                    }}>
                      + {preview.totalRows - 10} more records
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Import Actions */}
            <div style={{ 
              display: "flex", 
              gap: 8, 
              justifyContent: "flex-end", 
              paddingTop: 16 
            }}>
              <button 
                type="button" 
                className="v2-btn v2-btn-ghost v2-btn-sm"
                onClick={handleReset}
                disabled={loading}
              >
                <X size={14} /> Cancel
              </button>
              <button 
                type="button" 
                className="v2-btn v2-btn-sm"
                onClick={handleImport}
                disabled={loading || uniqueRoles.length > 0}
              >
                {loading ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                Import {preview.totalRows} Records
              </button>
            </div>
          </>
        )}

        {/* Summary */}
        {!preview && !file && !loading && (
          <div style={{ 
            display: "grid", 
            gap: 12, 
            padding: 16, 
            background: "var(--surface-alt)", 
            borderRadius: 8, 
            border: "1px solid var(--line)" 
          }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              CSV Import Features:
            </h4>
            <ul style={{ 
              margin: 0, 
              paddingLeft: 20, 
              fontSize: 13, 
              color: "var(--body)", 
              lineHeight: 1.6 
            }}>
              <li>Bulk upload students, teachers, and users</li>
              <li>Automatic role mapping with preview</li>
              <li>Auto-generate secure passwords</li>
              <li>Send welcome credentials via SMTP</li>
              <li>Real-time preview before import</li>
              <li>Support for custom CSV formats</li>
            </ul>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
              <strong>CSV Format:</strong> Include columns for name, email, student_id, class, section, role, etc.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}