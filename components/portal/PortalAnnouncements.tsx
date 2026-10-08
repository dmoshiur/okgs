"use client";

import { BellRing } from "lucide-react";
import { bn, en, formatDate, formatDateEn } from "@/lib/format";
import { Empty, Panel, useApi } from "@/components/sf/console/ui";

/**
 * The same announcement list for the student portal (Bangla) and the staff
 * console (English): the panel chrome is English-only, the notice text itself is
 * whatever the office wrote, so titles and bodies are never translated.
 */
const copy = {
  en: { title: "Notices for this fair", kind: { notice: "Notice", update: "Update" }, loading: "Loading notices…" },
  bn: { title: "আপনার জন্য ঘোষণা", kind: { notice: "নোটিশ", update: "আপডেট" }, loading: "ঘোষণা লোড হচ্ছে…" },
};

interface PortalAnnouncement {
  id: string;
  title: string;
  body?: string;
  description?: string;
  excerpt?: string;
  type?: string;
  kind?: string;
  announcement_kind: string;
  published_at?: string;
  date?: string;
  created_at?: string;
}

export function PortalAnnouncements({ lang = "bn" }: { lang?: "bn" | "en" }) {
  const { data, loading } = useApi<{ announcements: PortalAnnouncement[] }>("/api/portal/announcements");
  const items = data?.announcements ?? [];
  const text = copy[lang];
  if (!loading && !items.length) return null;
  return (
    <Panel title={text.title} action={<span className="badge-soft"><BellRing size={13} /> {lang === "en" ? en(items.length) : bn(items.length)}</span>}>
      <div className="portal-announcement-list">
        {items.map((item) => (
          <article className="portal-announcement" key={`${item.announcement_kind}-${item.id}`}>
            <div>
              <strong>{item.title}</strong>
              <span className="v2-muted">{item.type || item.kind || (item.announcement_kind === "notice" ? text.kind.notice : text.kind.update)} · {lang === "en" ? formatDateEn(item.published_at || item.date || item.created_at || "", "short") : formatDate(item.published_at || item.date || item.created_at || "")}</span>
            </div>
            {(item.body || item.description || item.excerpt) ? <p>{item.body || item.description || item.excerpt}</p> : null}
          </article>
        ))}
        {loading && !items.length ? <Empty>{text.loading}</Empty> : null}
      </div>
    </Panel>
  );
}
