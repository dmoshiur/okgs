"use client";

import { useCallback, useEffect, useState } from "react";
import { bn } from "@/lib/format";

export function money(value: unknown) {
  const amount = Number(value ?? 0);
  return `৳${bn(Math.round(amount))}`;
}

export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(url, { cache: "no-store" });
      const payload = (await response.json()) as T & { error?: string };
      if (!response.ok) throw new Error(payload?.error || "তথ্য লোড করা যায়নি।");
      setData(payload);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "তথ্য লোড করা যায়নি।");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load, setData };
}

export async function postJson<T = Record<string, unknown>>(url: string, body: Record<string, unknown>, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.error || "সংরক্ষণ করা যায়নি।");
  return payload;
}

export function Panel({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {title || action ? (
        <header className="panel-head">
          {title ? <h2 style={{ margin: 0, fontSize: 19 }}>{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Metric({ label, value, note, icon, accent }: { label: string; value: string; note?: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`metric ${accent ? "metric-accent" : ""}`}>
      <span>{icon} {label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export function Bars({ rows, total, unit = "৳" }: { rows: { label: string; value: number; note?: string }[]; total?: number; unit?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span title={row.label} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.round((row.value / (total || max)) * 100)}%` }} />
          </span>
          <strong style={{ fontSize: 13, whiteSpace: "nowrap" }}>
            {unit === "৳" ? money(row.value) : `${bn(row.value)}${unit ? ` ${unit}` : ""}`}
            {row.note ? <em className="v2-muted" style={{ fontStyle: "normal", marginLeft: 6, fontWeight: 400 }}>{row.note}</em> : null}
          </strong>
        </div>
      ))}
      {!rows.length ? <p className="v2-muted" style={{ margin: 0 }}>এখনো কোনো তথ্য নেই।</p> : null}
    </div>
  );
}

export function Notice({ kind = "ok", children }: { kind?: "ok" | "bad"; children: React.ReactNode }) {
  return <p className={kind === "bad" ? "portal-error" : "portal-ok"}>{children}</p>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="v2-muted" style={{ margin: "6px 0" }}>{children}</p>;
}

export const money2 = money;
