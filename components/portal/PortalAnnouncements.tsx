"use client";

import { BellRing } from "lucide-react";
import { bn, formatDate } from "@/lib/format";
import { Empty, Panel, useApi } from "@/components/sf/console/ui";

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

export function PortalAnnouncements() {
  const { data, loading } = useApi<{ announcements: PortalAnnouncement[] }>("/api/portal/announcements");
  const items = data?.announcements ?? [];
  if (!loading && !items.length) return null;
  return (
    <Panel title="আপনার জন্য ঘোষণা" action={<span className="badge-soft"><BellRing size={13} /> {bn(items.length)}</span>}>
      <div className="portal-announcement-list">
        {items.map((item) => (
          <article className="portal-announcement" key={`${item.announcement_kind}-${item.id}`}>
            <div>
              <strong>{item.title}</strong>
              <span className="v2-muted">{item.type || item.kind || (item.announcement_kind === "notice" ? "নোটিশ" : "আপডেট")} · {formatDate(item.published_at || item.date || item.created_at || "")}</span>
            </div>
            {(item.body || item.description || item.excerpt) ? <p>{item.body || item.description || item.excerpt}</p> : null}
          </article>
        ))}
        {loading && !items.length ? <Empty>ঘোষণা লোড হচ্ছে…</Empty> : null}
      </div>
    </Panel>
  );
}
