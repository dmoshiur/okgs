"use client";

import { useState, useCallback } from "react";
import { useApi, postJson } from "./ui";
import { Panel } from "./ui";
import { Mail, Check, X, Loader2, Shield, Lock, TestTube, Users } from "lucide-react";

interface SMTPConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean; // SSL/TLS
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  test_recipient: string;
}

interface SMTPTestResult {
  success: boolean;
  message: string;
  error?: string;
}

export function SMTPConfigPanel() {
  const [config, setConfig] = useState<SMTPConfig>({
    enabled: false,
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
    from_email: "",
    from_name: "OKGS Science Fair",
    test_recipient: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [testResult, setTestResult] = useState<SMTPTestResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Load existing SMTP configuration
  const { data: existingConfig, loading: configLoading } = useApi<SMTPConfig>("/api/staff/settings/smtp");

  // Initialize with existing config when loaded
  useCallback(() => {
    if (existingConfig && !configLoading) {
      setConfig({
        enabled: existingConfig.enabled || false,
        host: existingConfig.host || "",
        port: existingConfig.port || 587,
        secure: existingConfig.secure || false,
        username: existingConfig.username || "",
        password: "", // Don't pre-fill password for security
        from_email: existingConfig.from_email || "",
        from_name: existingConfig.from_name || "OKGS Science Fair",
        test_recipient: existingConfig.test_recipient || "",
      });
    }
  }, [existingConfig, configLoading]);

  const handleConfigChange = (field: keyof SMTPConfig, value: string | number | boolean) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
    setError("");
    setMessage("");
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    
    try {
      await postJson("/api/staff/settings/smtp", {
        ...config,
        port: Number(config.port) || 587,
      });
      
      setMessage("SMTP configuration saved successfully!");
      
      // Log activity
      await postJson("/api/staff/log-activity", {
        action: "smtp.update",
        entity: "settings",
        detail: `SMTP configuration ${config.enabled ? "enabled" : "disabled"}`,
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save SMTP configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.host || !config.port || !config.from_email) {
      setError("Please fill in host, port, and from email to test");
      return;
    }
    
    if (!config.test_recipient) {
      setError("Please provide a test recipient email");
      return;
    }
    
    setLoading(true);
    setError("");
    setMessage("");
    setTestResult(null);
    
    try {
      const response = await fetch("/api/staff/settings/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: config.host,
          port: Number(config.port) || 587,
          secure: config.secure,
          username: config.username,
          password: config.password,
          from_email: config.from_email,
          from_name: config.from_name,
          test_recipient: config.test_recipient,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "SMTP test failed");
      }
      
      setTestResult({
        success: true,
        message: "SMTP connection successful! Test email sent.",
      });
      
    } catch (err) {
      setTestResult({
        success: false,
        message: "SMTP connection failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const isConfigValid = config.host && config.port && config.from_email;

  return (
    <div className="v2-grid" style={{ gap: 16 }}>
      <Panel title="Central SMTP Configuration">
        <p style={{ margin: "0 0 16px", color: "var(--body)", fontSize: 14 }}>
          Configure the central SMTP server for sending emails. All email notifications, 
          welcome credentials, and announcements will use these settings.
        </p>

        {/* Enable/Disable Toggle */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 12, 
          padding: 12, 
          background: "var(--surface-alt)", 
          borderRadius: 8, 
          marginBottom: 16 
        }}>
          <label style={{ cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => handleConfigChange("enabled", e.target.checked)}
              style={{ marginRight: 8, width: 16, height: 16, cursor: "pointer" }}
            />
            Enable SMTP
          </label>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            {config.enabled ? "Email sending is active" : "Email sending is disabled"}
          </span>
        </div>

        {/* SMTP Settings Form */}
        <div style={{ display: "grid", gap: 12 }}>
          {/* Host and Port */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                SMTP Host *
              </label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => handleConfigChange("host", e.target.value)}
                placeholder="smtp.gmail.com"
                style={{ 
                  padding: 10, 
                  border: "1px solid var(--line)", 
                  borderRadius: 8, 
                  fontSize: 14 
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                Port *
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => handleConfigChange("port", parseInt(e.target.value) || 587)}
                placeholder="587"
                min="1"
                max="65535"
                style={{ 
                  padding: 10, 
                  border: "1px solid var(--line)", 
                  borderRadius: 8, 
                  fontSize: 14 
                }}
              />
            </div>
          </div>

          {/* Security and Authentication */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ cursor: "pointer", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={config.secure}
                  onChange={(e) => handleConfigChange("secure", e.target.checked)}
                  style={{ marginRight: 8, width: 16, height: 16, cursor: "pointer" }}
                />
                Use SSL/TLS
              </label>
              <Shield size={14} style={{ color: "var(--muted)" }} />
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                Username
              </label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => handleConfigChange("username", e.target.value)}
                placeholder="your-email@gmail.com"
                style={{ 
                  padding: 10, 
                  border: "1px solid var(--line)", 
                  borderRadius: 8, 
                  fontSize: 14 
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={config.password}
                  onChange={(e) => handleConfigChange("password", e.target.value)}
                  placeholder="••••••••"
                  style={{ 
                    padding: 10, 
                    border: "1px solid var(--line)", 
                    borderRadius: 8, 
                    fontSize: 14,
                    width: "100%"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ 
                    position: "absolute", 
                    right: 8, 
                    top: 8, 
                    background: "none", 
                    border: "none", 
                    cursor: "pointer", 
                    color: "var(--muted)"
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* From Address */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                From Email *
              </label>
              <input
                type="email"
                value={config.from_email}
                onChange={(e) => handleConfigChange("from_email", e.target.value)}
                placeholder="noreply@okgs.info"
                style={{ 
                  padding: 10, 
                  border: "1px solid var(--line)", 
                  borderRadius: 8, 
                  fontSize: 14 
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                From Name
              </label>
              <input
                type="text"
                value={config.from_name}
                onChange={(e) => handleConfigChange("from_name", e.target.value)}
                placeholder="OKGS Science Fair"
                style={{ 
                  padding: 10, 
                  border: "1px solid var(--line)", 
                  borderRadius: 8, 
                  fontSize: 14 
                }}
              />
            </div>
          </div>

          {/* Test Recipient */}
          <div style={{ display: "grid", gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
              Test Recipient Email
            </label>
            <input
              type="email"
              value={config.test_recipient}
              onChange={(e) => handleConfigChange("test_recipient", e.target.value)}
              placeholder="test@example.com"
              style={{ 
                padding: 10, 
                border: "1px solid var(--line)", 
                borderRadius: 8, 
                fontSize: 14 
              }}
            />
          </div>
        </div>

        {/* Error and Message Display */}
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

        {/* Test Result */}
        {testResult && (
          <p style={{ 
            margin: "16px 0 0", 
            padding: 12, 
            background: testResult.success ? "#dcfce7" : "#fef2f2", 
            border: testResult.success ? "1px solid #bbf7d0" : "1px solid #fecaca", 
            borderRadius: 8, 
            color: testResult.success ? "#15803d" : "#b91c1c", 
            fontSize: 14 
          }}>
            {testResult.message}
            {testResult.error && <br />}
            {testResult.error && <small style={{ fontSize: 12 }}>{testResult.error}</small>}
          </p>
        )}

        {/* Action Buttons */}
        <div style={{ 
          display: "flex", 
          gap: 8, 
          justifyContent: "flex-end", 
          paddingTop: 16 
        }}>
          <button 
            type="button" 
            className="v2-btn v2-btn-ghost v2-btn-sm"
            onClick={handleTestConnection}
            disabled={!isConfigValid || loading}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <TestTube size={14} />}
            Test Connection
          </button>
          <button 
            type="button" 
            className="v2-btn v2-btn-sm"
            onClick={handleSave}
            disabled={!isConfigValid || saving}
          >
            {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            Save Configuration
          </button>
        </div>

        {/* SMTP Settings Help */}
        <div style={{ 
          marginTop: 24, 
          padding: 16, 
          background: "var(--surface-alt)", 
          borderRadius: 8, 
          border: "1px solid var(--line)" 
        }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            SMTP Configuration Help
          </h4>
          <ul style={{ 
            margin: 0, 
            paddingLeft: 20, 
            fontSize: 13, 
            color: "var(--body)", 
            lineHeight: 1.6 
          }}>
            <li><strong>Gmail:</strong> smtp.gmail.com, Port: 587 (TLS) or 465 (SSL)</li>
            <li><strong>Outlook:</strong> smtp-mail.outlook.com, Port: 587 (TLS)</li>
            <li><strong>Yahoo:</strong> smtp.mail.yahoo.com, Port: 587 (TLS)</li>
            <li><strong>Custom SMTP:</strong> Use your email provider's SMTP server</li>
          </ul>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
            <strong>Note:</strong> For Gmail, you may need to enable "Less secure app access" or create an App Password.
          </p>
        </div>
      </Panel>

      {/* Multi-Channel Announcements Info */}
      <Panel title="Multi-Channel Announcements">
        <p style={{ margin: "0 0 16px", color: "var(--body)", fontSize: 14 }}>
          When updates or news items are published on the Science Fair dashboard or club sites,
          the system can automatically send email notifications to targeted audiences.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 12, 
            padding: 12, 
            background: "var(--surface-alt)", 
            borderRadius: 8 
          }}>
            <Mail size={18} style={{ color: "var(--brand-mid)" }} />
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                Email Notifications
              </h4>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--body)" }}>
                Send announcements via email to specific groups
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {["All", "Paid Students", "Unpaid Students", "Teachers", "Volunteers", "Admins"].map(audience => (
              <span 
                key={audience} 
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: 6, 
                  padding: "8px 12px", 
                  background: "var(--surface)", 
                  border: "1px solid var(--line)", 
                  borderRadius: 20, 
                  fontSize: 13, 
                  color: "var(--body)" 
                }}
              >
                <Users size={14} />
                {audience}
              </span>
            ))}
          </div>
        </div>

        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: "var(--mint-soft)", 
          border: "1px solid var(--mint-line)", 
          borderRadius: 8, 
          color: "var(--mint-text)" 
        }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            <strong>How it works:</strong> When you publish news or updates, select your target audience.
            The system will automatically send email notifications to all users in that category
            using the SMTP configuration above.
          </p>
        </div>
      </Panel>
    </div>
  );
}

// EyeOff component for password visibility toggle
function EyeOff({ size = 16, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg {...props} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// Eye component for password visibility toggle
function Eye({ size = 16, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg {...props} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}