"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { en } from "@/lib/format";

export function money(value: unknown) {
  const amount = Number(value ?? 0);
  return `৳${en(Math.round(amount))}`;
}

/* ------------------------------------------------------------------ *
 * A tiny SWR-style cache for the console.
 *
 * Every panel used to re-fetch its data with `cache: "no-store"` on mount, so
 * moving between menu items always showed an empty table for the length of a
 * round-trip — that is the "slow navigation" the office reported. The cache is a
 * module-level Map (never localStorage: the panel keeps no state in the browser),
 * so:
 *
 *   • a section that was opened before paints instantly and revalidates quietly,
 *   • identical URLs in flight are deduped into one request,
 *   • a reload after a save writes through, so the next visitor sees fresh data.
 *
 * A refresh keeps the previous rows on screen while it runs; only a brand-new
 * query clears the table, so a filter change can never show another class's data.
 * ------------------------------------------------------------------ */

export const API_STALE_MS = 30_000;

interface CacheEntry {
  data: unknown;
  at: number;
}

const apiCache = new Map<string, CacheEntry>();
const apiInflight = new Map<string, Promise<unknown>>();

/** Pre-seed a URL — used by a mutation that already knows the new payload. */
export function seedApiCache<T>(url: string, data: T) {
  apiCache.set(url, { data, at: Date.now() });
}

/** Drops cached entries so the next read goes to the server. No argument clears all. */
export function invalidateApi(match?: string | RegExp) {
  if (!match) {
    apiCache.clear();
    return;
  }
  for (const key of Array.from(apiCache.keys())) {
    const hit = typeof match === "string" ? key.includes(match) : match.test(key);
    if (hit) apiCache.delete(key);
  }
}

async function fetchJson<T>(url: string, force: boolean): Promise<T> {
  const cached = apiCache.get(url);
  if (!force && cached && Date.now() - cached.at < API_STALE_MS) return cached.data as T;
  const running = apiInflight.get(url);
  if (running && !force) return running as Promise<T>;

  const request = (async () => {
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(payload?.error || "Could not load data.");
    apiCache.set(url, { data: payload, at: Date.now() });
    return payload;
  })();

  apiInflight.set(url, request);
  void request.catch(() => undefined).finally(() => {
    if (apiInflight.get(url) === request) apiInflight.delete(url);
  });
  return request;
}

export interface UseApiOptions {
  /** Milliseconds a cached answer is served without revalidating. */
  staleTime?: number;
}

export function useApi<T>(url: string | null, deps: unknown[] = [], options: UseApiOptions = {}) {
  const staleTime = options.staleTime ?? API_STALE_MS;
  const [data, setDataState] = useState<T | null>(() => (url ? ((apiCache.get(url)?.data as T | undefined) ?? null) : null));
  const [loading, setLoading] = useState(() => Boolean(url) && !apiCache.has(String(url)));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  // Guards against a slow answer for a previous query overwriting a newer one.
  const requestRef = useRef(0);

  const load = useCallback(
    async (force = false) => {
      if (!url) {
        setDataState(null);
        setLoading(false);
        return;
      }
      const requestId = ++requestRef.current;
      const cached = apiCache.get(url);
      if (cached && Date.now() - cached.at < staleTime && !force) {
        setDataState(cached.data as T);
        setLoading(false);
        setError("");
        return;
      }
      // A fresh query clears the table; a revalidation keeps the old rows visible.
      if (!cached) {
        setDataState(null);
        setLoading(true);
      } else {
        setDataState(cached.data as T);
      }
      setRefreshing(true);
      setError("");
      try {
        const payload = await fetchJson<T>(url, force || !cached);
        if (requestRef.current !== requestId) return;
        setDataState(payload);
      } catch (issue) {
        if (requestRef.current !== requestId) return;
        // A failed revalidation keeps the rows already on screen.
        if (!cached) setError(issue instanceof Error ? issue.message : "Could not load data.");
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, staleTime, ...deps],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const setData = useCallback(
    (next: T) => {
      setDataState(next);
      if (url) apiCache.set(url, { data: next, at: Date.now() });
    },
    [url],
  );

  return { data, loading, error, refreshing, reload: () => load(true), setData };
}

export async function postJson<T = Record<string, unknown>>(url: string, body: Record<string, unknown>, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.error || "Could not save.");
  return payload;
}

export function Panel({ title, action, children, className = "", id }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`panel ${className}`}>
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
            {unit === "৳" ? money(row.value) : `${en(row.value)}${unit ? ` ${unit}` : ""}`}
            {row.note ? <em className="v2-muted" style={{ fontStyle: "normal", marginLeft: 6, fontWeight: 400 }}>{row.note}</em> : null}
          </strong>
        </div>
      ))}
      {!rows.length ? <p className="v2-muted" style={{ margin: 0 }}>No data yet.</p> : null}
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
