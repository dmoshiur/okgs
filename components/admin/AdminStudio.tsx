"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Eye,
  Layers,
  Menu,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { fieldsFor, resourceMeta, resourceSchema, studioGroups } from "@/lib/content-config";
import type { ResourceName } from "@/lib/types";
import { iconFor } from "@/lib/icons";
import { FieldControl } from "@/components/admin/FieldControl";
import { loadMediaConfig, type MediaConfig } from "@/lib/upload-client";
import { bn, formatDate } from "@/lib/format";
import { AdminSidebar, type ResourceCounts } from "@/components/admin/AdminSidebar";
import {
  CloudinaryPanel,
  ClubCoverageTable,
  MetricGrid,
  QuickActionsPanel,
  RecentActivityList,
  clubChildResources,
  type CoverageEntry,
  type MetricStats,
  type OverviewItem,
} from "@/components/admin/DashboardMetrics";
import { ContentListTable, type ContentItem } from "@/components/admin/ContentListTable";

type Item = ContentItem;
type DataMap = Record<ResourceName, Item[]>;

const resourceList = Object.keys(resourceSchema) as ResourceName[];
const emptyData = Object.fromEntries(resourceList.map((resource) => [resource, []])) as unknown as DataMap;

function hasField(resource: ResourceName, name: string) {
  return fieldsFor(resource).some((field) => field.name === name);
}

function sortRows(resource: ResourceName, rows: Item[]): Item[] {
  const copy = [...rows];
  if (hasField(resource, "sort_order")) {
    return copy.sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || String(b.created_at).localeCompare(String(a.created_at)));
  }
  const dateField = resource === "updates" ? "date" : hasField(resource, "published_at") ? "published_at" : hasField(resource, "event_date") ? "event_date" : "updated_at";
  return copy.sort((a, b) => String(b[dateField] ?? "").localeCompare(String(a[dateField] ?? "")));
}

function titleOf(resource: ResourceName, item: Item) {
  const field = resourceMeta[resource].titleField;
  return String(item[field] || item.title || item.name || item.label || item.caption || "শিরোনামহীন");
}

function previewHref(resource: ResourceName, item: Item) {
  if (resource === "clubs") return `/clubs/${item.slug}`;
  if (resource === "news") return `/news/${item.slug}`;
  if (resource === "club_posts") return `/clubs/${item.club_slug}/posts/${item.slug}`;
  if (item.club_slug) return `/clubs/${item.club_slug}/${resource.replace("club_", "")}`;
  return "/";
}

export function AdminStudio() {
  const [data, setData] = useState<DataMap>(emptyData);
  const [active, setActive] = useState<ResourceName | "overview">("overview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "draft">("all");
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<{ resource: ResourceName; item?: Item; mode: "create" | "edit" } | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<{ resource: ResourceName; item: Item } | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [media, setMedia] = useState<MediaConfig | null>(null);
  const [busyRow, setBusyRow] = useState<string>("");

  const clubs = data.clubs as unknown as Item[];

  const notify = useCallback((kind: "success" | "error", message: string) => setToast({ kind, message }), []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/all", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!response.ok) throw new Error("studio");
      const result = (await response.json()) as { items: DataMap };
      const next = { ...emptyData };
      for (const resource of resourceList) {
        next[resource] = sortRows(resource, result.items?.[resource] ?? []);
      }
      setData(next);
    } catch {
      setLoadError("স্টুডিও লোড করা যায়নি — ডেটাবেস বা লগইন পরীক্ষা করুন।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadMediaConfig().then(setMedia);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".search-box input")?.focus();
      }
      if (event.key === "Escape") {
        if (confirming) setConfirming(null);
        else if (modal) closeModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const currentItems = useMemo(() => (active === "overview" ? [] : data[active] ?? []), [active, data]);

  const filtered = useMemo(() => {
    let rows = currentItems;
    const needle = search.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((item) =>
        Object.entries(item)
          .filter(([key]) => !key.endsWith("_at") && key !== "id")
          .some(([, value]) => String(value ?? "").toLowerCase().includes(needle)),
      );
    }
    if (clubFilter) rows = rows.filter((item) => String(item.club_slug || "") === clubFilter);
    if (statusFilter !== "all") {
      rows = rows.filter((item) => (statusFilter === "live" ? item.is_active !== false : item.is_active === false));
    }
    return rows;
  }, [currentItems, search, clubFilter, statusFilter]);

  // Sidebar pills need live/total per resource — computed once, passed down.
  const counts = useMemo(() => {
    const map: ResourceCounts = {};
    for (const group of studioGroups) {
      for (const resource of group.resources) {
        const rows = data[resource] ?? [];
        map[resource] = { live: rows.filter((row) => row.is_active !== false).length, total: rows.length };
      }
    }
    return map;
  }, [data]);

  const usesClubFilter = active !== "overview" && hasField(active, "club_slug");
  const reorderable = active !== "overview" && hasField(active, "sort_order");

  function initialForm(resource: ResourceName, item?: Item) {
    const values: Record<string, any> = {};
    for (const field of fieldsFor(resource)) {
      if (item && item[field.name] !== undefined) {
        values[field.name] = field.type === "boolean" ? Boolean(Number(item[field.name])) : item[field.name];
        continue;
      }
      if (field.type === "boolean") values[field.name] = field.name === "is_active" ? true : Boolean(field.default);
      else if (field.type === "number") values[field.name] = Number(field.default ?? 0);
      else values[field.name] = field.default ?? "";
      if (field.type === "date" && !values[field.name]) values[field.name] = new Date().toISOString().slice(0, 10);
      if (field.type === "datetime" && !values[field.name]) values[field.name] = new Date().toISOString().slice(0, 16);
    }
    if (clubFilter && hasField(resource, "club_slug")) values.club_slug = clubFilter;
    if (resource !== "settings" && hasField(resource, "sort_order") && !item) {
      values.sort_order = (data[resource].length || 0) + 1;
    }
    return values;
  }

  function openCreate(resource: ResourceName) {
    setErrors({});
    setForm(initialForm(resource));
    setModal({ resource, mode: "create" });
  }

  function openEdit(resource: ResourceName, item: Item) {
    setErrors({});
    setForm(initialForm(resource, item));
    setModal({ resource, item, mode: "edit" });
  }

  function openDuplicate(resource: ResourceName, item: Item) {
    const copy = initialForm(resource, item);
    // Leave the slug blank: the API derives one from the copied title and guarantees uniqueness.
    if (hasField(resource, "slug")) copy.slug = "";
    if (hasField(resource, "title")) copy.title = `${String(item.title || "")} (নকল)`;
    if (hasField(resource, "name")) copy.name = `${String(item.name || "")} (নকল)`;
    if (hasField(resource, "key")) copy.key = `${String(item.key || "copy")}_2`;
    setErrors({});
    setForm(copy);
    setModal({ resource, mode: "create" });
  }

  function closeModal() {
    setModal(null);
    setErrors({});
  }

  function update(field: string, value: any) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: "" } : current));
  }

  function mergeItem(resource: ResourceName, item: Item) {
    setData((current) => {
      const rows = current[resource];
      const index = rows.findIndex((row) => row.id === item.id);
      const next = index === -1 ? [...rows, item] : rows.map((row) => (row.id === item.id ? { ...row, ...item } : row));
      return { ...current, [resource]: sortRows(resource, next) };
    });
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!modal) return;
    const { resource, item, mode } = modal;

    const missing: Record<string, string> = {};
    for (const field of fieldsFor(resource)) {
      const value = String(form[field.name] ?? "").trim();
      if (field.required && !value) missing[field.name] = `“${field.label}” খালি রাখা যাবে না।`;
      if (field.pattern && value && !new RegExp(field.pattern, "u").test(value)) missing[field.name] = field.patternError || `“${field.label}” সঠিক ফরম্যাটে নয়।`;
    }
    if (Object.keys(missing).length) {
      setErrors(missing);
      notify("error", "অবশ্যই পূরণ করতে হবে এমন ঘরগুলো দেখুন।");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(mode === "edit" ? `/api/admin/${resource}/${item!.id}` : `/api/admin/${resource}`, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!response.ok) throw new Error(result.error || "সংরক্ষণ করা যায়নি।");
      mergeItem(resource, result.item as Item);
      closeModal();
      notify("success", mode === "edit" ? "পরিবর্তন সংরক্ষিত হয়েছে।" : "নতুন এন্ট্রি যোগ হয়েছে এবং সাইটে দেখাচ্ছে।");
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "সংরক্ষণ করা যায়নি।");
    } finally {
      setSaving(false);
    }
  }

  async function quickPatch(resource: ResourceName, item: Item, patch: Record<string, unknown>, message: string) {
    setBusyRow(item.id);
    setData((current) => ({
      ...current,
      [resource]: current[resource].map((row) => (row.id === item.id ? { ...row, ...patch } : row)),
    }));
    try {
      const response = await fetch(`/api/admin/${resource}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        throw new Error(problem.error || "সংরক্ষণ করা যায়নি।");
      }
      const result = await response.json();
      mergeItem(resource, result.item as Item);
      notify("success", message);
    } catch (error) {
      await load();
      notify("error", error instanceof Error ? error.message : "সংরক্ষণ করা যায়নি।");
    } finally {
      setBusyRow("");
    }
  }

  async function move(resource: ResourceName, item: Item, direction: -1 | 1, visibleIds: string[]) {
    const rows = data[resource];
    const ids = rows.map((row) => String(row.id));
    const visibleIndex = visibleIds.indexOf(String(item.id));
    const neighbourId = visibleIds[visibleIndex + direction];
    if (visibleIndex === -1 || !neighbourId) return;
    const from = ids.indexOf(String(item.id));
    const to = ids.indexOf(neighbourId);
    if (from === -1 || to === -1) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const reordered = ids.map((id) => {
      const row = rows.find((entry) => entry.id === id)!;
      return { ...row, sort_order: ids.indexOf(id) + 1 };
    });
    setData((current) => ({ ...current, [resource]: reordered }));
    try {
      const response = await fetch("/api/admin/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, ids }),
      });
      if (!response.ok) throw new Error("ক্রম সংরক্ষণ করা যায়নি।");
      notify("success", "ক্রম হালনাগাদ হয়েছে।");
    } catch (error) {
      await load();
      notify("error", error instanceof Error ? error.message : "ক্রম সংরক্ষণ করা যায়নি।");
    }
  }

  async function remove(resource: ResourceName, item: Item) {
    try {
      const response = await fetch(`/api/admin/${resource}/${item.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "মুছে ফেলা যায়নি।");
      setData((current) => ({ ...current, [resource]: current[resource].filter((row) => row.id !== item.id) }));
      setConfirming(null);
      const extra = resource === "clubs" && result.cascade ? ` ${bn(result.cascade)} টি সংশ্লিষ্ট এন্ট্রিও মুছে গেছে।` : "";
      notify("success", `“${titleOf(resource, item)}” মুছে ফেলা হয়েছে।${extra}`);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "মুছে ফেলা যায়নি।");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  function navigate(next: ResourceName | "overview") {
    setActive(next);
    setSearch("");
    setClubFilter("");
    setStatusFilter("all");
    setMobileNav(false);
  }

  const coverage = useMemo<CoverageEntry[]>(() => {
    return clubs.map((club) => ({
      club,
      counts: Object.fromEntries(
        clubChildResources.map((resource) => [resource, data[resource].filter((row) => String(row.club_slug) === String(club.slug)).length]),
      ) as Record<string, number>,
      draft: club.is_active === false,
    }));
  }, [clubs, data]);

  const stats = useMemo<MetricStats>(() => {
    const all = Object.values(data).flat();
    const live = all.filter((item) => item.is_active !== false).length;
    const today = new Date().toISOString().slice(0, 10);
    return {
      loading,
      clubs: data.clubs.length,
      activeClubs: coverage.filter((entry) => !entry.draft).length,
      upcoming: data.club_events.filter((event) => String(event.event_date || "") >= today).length,
      totalEvents: data.club_events.length,
      cloudinaryImages: all.filter((item) => Object.values(item).some((value) => typeof value === "string" && value.includes("res.cloudinary.com"))).length,
      mediaNote: media?.enabled ? `${media.cloudName} · ${media.folder}/` : "সেটআপ বাকি",
      drafts: all.length - live,
      live,
    };
  }, [data, coverage, loading, media]);

  const recentItems = useMemo<OverviewItem[]>(() => {
    return Object.values(data)
      .flatMap((rows, index) => rows.map((item) => ({ item, resource: resourceList[index] })))
      .sort((a, b) => String(b.item.updated_at || "").localeCompare(String(a.item.updated_at || "")))
      .slice(0, 6)
      .map(({ item, resource }) => ({ key: `${resource}-${item.id}`, resource, item }));
  }, [data]);

  const missingCover = data.clubs.filter((club) => !String(club.cover_image_url || club.image_url || "").trim()).length;

  return (
    <div className="admin-shell">
      <AdminSidebar
        active={active}
        counts={counts}
        loading={loading}
        media={media}
        mobileNav={mobileNav}
        onClose={() => setMobileNav(false)}
        onNavigate={navigate}
        onLogout={() => void logout()}
      />

      {mobileNav ? <button className="admin-scrim" onClick={() => setMobileNav(false)} aria-label="মেনু বন্ধ করুন" /> : null}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" onClick={() => setMobileNav(true)} aria-label="মেনু খুলুন"><Menu size={20} /></button>
          <div className="admin-breadcrumb" aria-label="ব্রেডক্রাম্ব">
            <span className="whitespace-nowrap">ওকেজিএস স্টুডিও</span>
            <ChevronRight size={14} aria-hidden="true" />
            <strong className="truncate whitespace-nowrap">{active === "overview" ? "ওভারভিউ" : resourceMeta[active].label}</strong>
            {clubFilter ? (
              <>
                <ChevronRight size={14} aria-hidden="true" />
                <span className="truncate whitespace-nowrap">{String(clubs.find((club) => club.slug === clubFilter)?.name ?? clubFilter)}</span>
              </>
            ) : null}
          </div>
          <div className="admin-top-actions">
            <button className="topbar-preview" onClick={() => void load()} title="আবার লোড করুন">
              <RefreshCw size={13} className={loading ? "spin" : ""} /> রিফ্রেশ
            </button>
            <a href="/" target="_blank" rel="noreferrer" className="topbar-preview"><span aria-hidden="true" /> লাইভ সাইট <ArrowUpRight size={13} /></a>
          </div>
        </header>

        <div className="admin-content">
          {loadError ? <p className="studio-error">{loadError}</p> : null}
          {active === "overview" ? (
            <Overview
              stats={stats}
              media={media}
              coverage={coverage}
              loading={loading}
              recentItems={recentItems}
              missingCover={missingCover}
              onNavigate={navigate}
              onCreate={openCreate}
              onClub={async (resource, slug) => {
                navigate(resource);
                setClubFilter(slug);
              }}
            />
          ) : (
            <>
              <div className="admin-page-heading manager-heading">
                <div className="min-w-0">
                  <p className="admin-kicker">
                    {(() => {
                      const Icon = iconFor(resourceMeta[active].icon);
                      return <Icon size={14} />;
                    })()}
                    <span className="whitespace-nowrap">
                      {resourceMeta[active].group === "clubs" ? "ক্লাব তথ্যকেন্দ্র" : "কনটেন্ট ম্যানেজমেন্ট"} <span className="heading-dot" /> মোট {bn(currentItems.length)} টি
                    </span>
                  </p>
                  <h1>{resourceMeta[active].label}</h1>
                  <p className="heading-sub leading-relaxed">{resourceMeta[active].description}</p>
                </div>
                <div className="heading-buttons">
                  <button className="admin-primary-button" onClick={() => openCreate(active)}>
                    <Plus size={16} /> নতুন {resourceMeta[active].singular}
                  </button>
                </div>
              </div>

              <div className="manager-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="খুঁজুন…" aria-label="খুঁজুন" />
                  <kbd>Ctrl K</kbd>
                </div>
                <div className="toolbar-filters">
                  {usesClubFilter ? (
                    <label className="filter-select">
                      <span>ক্লাব</span>
                      <select value={clubFilter} onChange={(event) => setClubFilter(event.target.value)}>
                        <option value="">সব</option>
                        {clubs.map((club) => <option key={club.id} value={club.slug}>{club.name}</option>)}
                        <option value="none">ক্লাববিহীন</option>
                      </select>
                    </label>
                  ) : null}
                  {hasField(active, "is_active") ? (
                    <label className="filter-select">
                      <span>অবস্থা</span>
                      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as any)}>
                        <option value="all">সব</option>
                        <option value="live">প্রকাশিত</option>
                        <option value="draft">খসড়া</option>
                      </select>
                    </label>
                  ) : null}
                  {reorderable ? <span className="toolbar-note"><Layers size={13} /> তীর দিয়ে ক্রম বদলানো যায়</span> : null}
                </div>
              </div>

              <ContentListTable
                resource={active}
                rows={filtered}
                loading={loading}
                clubs={clubs}
                busyRowId={busyRow}
                reorderable={reorderable}
                hasFilters={Boolean(search || clubFilter || statusFilter !== "all")}
                onCreate={() => openCreate(active)}
                onClearFilters={() => { setSearch(""); setClubFilter(""); setStatusFilter("all"); }}
                onEdit={(item) => openEdit(active, item)}
                onDuplicate={(item) => openDuplicate(active, item)}
                onDelete={(item) => setConfirming({ resource: active, item })}
                onToggle={(item) => void quickPatch(active, item, { is_active: item.is_active === false }, item.is_active === false ? "প্রকাশ করা হয়েছে।" : "খসড়াতে নেওয়া হয়েছে।")}
                onMove={(item, direction) => void move(active, item, direction, filtered.map((row) => String(row.id)))}
              />
            </>
          )}
        </div>
      </main>

      {modal ? (
        <EditorModal
          resource={modal.resource}
          item={modal.item}
          mode={modal.mode}
          form={form}
          errors={errors}
          saving={saving}
          clubs={clubs as unknown as any}
          fairs={(data.fairs ?? []) as unknown as any[]}
          onClose={closeModal}
          onSubmit={saveItem}
          update={update}
        />
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title={titleOf(confirming.resource, confirming.item)}
          resource={confirming.resource}
          childCount={
            confirming.resource === "clubs"
              ? clubChildResources.reduce((total, resource) => total + data[resource].filter((row) => String(row.club_slug) === String(confirming.item.slug)).length, 0)
              : 0
          }
          onCancel={() => setConfirming(null)}
          onConfirm={() => void remove(confirming.resource, confirming.item)}
        />
      ) : null}

      {toast ? (
        <div className={`admin-toast ${toast.kind}`} role="status">
          <span>{toast.kind === "success" ? <Check size={16} /> : <X size={16} />}</span>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Overview({
  stats,
  media,
  coverage,
  loading,
  recentItems,
  missingCover,
  onNavigate,
  onCreate,
  onClub,
}: {
  stats: MetricStats;
  media: MediaConfig | null;
  coverage: CoverageEntry[];
  loading: boolean;
  recentItems: OverviewItem[];
  missingCover: number;
  onNavigate: (resource: ResourceName | "overview") => void;
  onCreate: (resource: ResourceName) => void;
  onClub: (resource: ResourceName, slug: string) => void;
}) {
  return (
    <div className="overview-page">
      <div className="admin-page-heading">
        <div className="min-w-0">
          <p className="admin-kicker">
            <span className="whitespace-nowrap">{formatDate(new Date().toISOString())}</span>
            <span className="heading-dot" />
            <span className="whitespace-nowrap">লাইভ ওয়ার্কস্পেস</span>
          </p>
          <h1>ক্লাব তথ্য <em>প্যানেল</em></h1>
          <p className="heading-sub leading-relaxed">স্কুলের সব ক্লাবের আয়োজন, ছবি, সদস্য ও অর্জন এখান থেকেই চালিত হয়। প্রতিটি ঘর সম্পাদনাযোগ্য।</p>
        </div>
        <div className="heading-buttons">
          <button className="admin-primary-button" onClick={() => onCreate("clubs")}><Trophy size={15} /> নতুন ক্লাব</button>
          <button className="secondary-button" onClick={() => onCreate("club_events")}><Plus size={15} /> আয়োজন</button>
        </div>
      </div>

      <MetricGrid stats={stats} />

      <div className="overview-grid">
        <ClubCoverageTable
          coverage={coverage}
          loading={loading}
          onOpenClubs={() => onNavigate("clubs")}
          onOpenClubResource={(resource, slug) => onClub(resource, slug)}
        />
        <QuickActionsPanel onCreateClub={() => onCreate("clubs")} onCreateEvent={() => onCreate("club_events")} onNavigate={onNavigate} />
      </div>

      <div className="overview-grid">
        <RecentActivityList items={recentItems} onOpen={(resource) => onNavigate(resource)} />
        <CloudinaryPanel media={media} missingCover={missingCover} onOpenClubs={() => onNavigate("clubs")} />
      </div>
    </div>
  );
}

function EditorModal({
  resource,
  item,
  mode,
  form,
  errors,
  saving,
  clubs,
  fairs,
  onClose,
  onSubmit,
  update,
}: {
  resource: ResourceName;
  item?: Item;
  mode: "create" | "edit";
  form: Record<string, any>;
  errors: Record<string, string>;
  saving: boolean;
  clubs: any[];
  fairs: any[];
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  update: (field: string, value: any) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const fields = fieldsFor(resource);
  const groups = Array.from(new Set(fields.map((field) => field.group || "তথ্য")));
  const clubSlug = form.club_slug || (resource === "clubs" ? form.slug : "");
  const preview = mode === "edit" ? previewHref(resource, item!) : null;
  const Icon = iconFor(resourceMeta[resource].icon);

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="editor-modal" role="dialog" aria-modal="true" aria-label={`${resourceMeta[resource].label} সম্পাদনা`}>
        <header className="editor-header">
          <div className="min-w-0">
            <span className="editor-kicker"><Icon size={14} /> <span className="truncate">{mode === "edit" ? "সম্পাদনা" : "নতুন"} · {resourceMeta[resource].label}</span></span>
            <h2 className="truncate leading-normal">{mode === "edit" ? titleOf(resource, item!) : `${resourceMeta[resource].singular} যোগ করুন`}</h2>
          </div>
          <div className="editor-header-actions">
            {preview && preview !== "/" ? (
              <a className="ghost-button" href={preview} target="_blank" rel="noreferrer"><Eye size={13} /> সাইটে দেখুন</a>
            ) : null}
            <button className="modal-close" onClick={onClose} aria-label="বন্ধ করুন"><X size={18} /></button>
          </div>
        </header>

        <form onSubmit={onSubmit}>
          <div className="editor-body" ref={bodyRef} tabIndex={-1}>
            <div className="editor-fields">
              {groups.map((group) => (
                <section className="field-group" key={group}>
                  {groups.length > 1 ? <h3 className="field-group-title">{group}</h3> : null}
                  <div className="field-grid">
                    {fields.filter((field) => (field.group || "তথ্য") === group).map((field) => (
                      <div key={field.name} className={`field-cell ${field.full || field.type === "image" || field.type === "textarea" ? "is-wide" : ""}`}>
                        <FieldControl
                          def={field}
                          resource={resource}
                          value={form[field.name]}
                          update={update}
                          clubs={clubs}
                          fairs={fairs as unknown as { name: string; slug: string }[]}
                          form={form}
                          invalid={Boolean(errors[field.name])}
                          prefix={clubSlug || undefined}
                          title={String(form.title || form.name || form.caption || "")}
                        />
                        {errors[field.name] ? <p className="field-error">{errors[field.name]}</p> : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <aside className="editor-aside">
              {resource !== "settings" && hasField(resource, "is_active") ? (
                <div className="editor-aside-card">
                  <span>প্রকাশনা</span>
                  <FieldControl
                    def={{ name: "is_active", label: "সাইটে দেখান", type: "boolean", help: "বন্ধ রাখলে সাইটে থাকবে না, কিন্তু এখানে থেকে যাবে।" }}
                    value={form.is_active}
                    update={update}
                    clubs={clubs}
                    form={form}
                  />
                </div>
              ) : null}
              {hasField(resource, "club_slug") ? (
                <div className="editor-aside-card">
                  <span>ক্লাব</span>
                  <p>{clubSlug ? String(clubs.find((club) => club.slug === clubSlug)?.name ?? clubSlug) : "সাধারণ — কোনো ক্লাবের সাথে যুক্ত নয়"}</p>
                  {clubSlug ? (
                    <a className="text-link" href={`/clubs/${clubSlug}`} target="_blank" rel="noreferrer">ক্লাব পাতা <ArrowUpRight size={13} /></a>
                  ) : null}
                </div>
              ) : null}
              {resource === "clubs" ? (
                <div className="editor-aside-card">
                  <span>ক্লাবের অন্যান্য তথ্য</span>
                  <p className="editor-aside-note">আয়োজন, ছবি, সদস্য ও অর্জন প্রতিটি ক্লাবের জন্য আলাদা তালিকায় রাখা হয় — বাঁ মেনু থেকে।</p>
                </div>
              ) : null}
              <div className="editor-tip">
                <Sparkles size={16} />
                <b>সহজ লেখাই ভালো।</b>
                <p>প্রথম লাইনে মূল কথা লিখুন; বাকি তথ্য ছোট ছোট অনুচ্ছেদে দিন।</p>
              </div>
            </aside>
          </div>

          <footer className="editor-footer">
            <span className="editor-footer-note">
              <span className="status-pulse" /> {mode === "edit" ? "বিদ্যমান এন্ট্রি সম্পাদনা" : "সংরক্ষণ করলেই সাইটে দেখাবে"}
            </span>
            <div>
              <button className="secondary-button" type="button" onClick={onClose}>বাতিল</button>
              <button className="admin-primary-button" type="submit" disabled={saving}>
                {saving ? <><RefreshCw size={14} className="spin" /> সংরক্ষণ…</> : <><Save size={15} /> {mode === "edit" ? "পরিবর্তন সংরক্ষণ" : "যোগ করুন"}</>}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ConfirmDialog({
  title,
  resource,
  childCount,
  onCancel,
  onConfirm,
}: {
  title: string;
  resource: ResourceName;
  childCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop is-alert" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="confirm-card" role="alertdialog" aria-modal="true" aria-label="মুছে ফেলা নিশ্চিত করুন">
        <span className="confirm-icon"><Trash2 size={18} /></span>
        <h2>“{title}” মুছে ফেলবেন?</h2>
        <p>
          {resource === "clubs" && childCount ? (
            <>এই ক্লাবের {bn(childCount)} টি সংশ্লিষ্ট এন্ট্রি (আয়োজন, ছবি, সদস্য, অর্জন, লেখা) ও মুছে যাবে।</>
          ) : (
            <>এই এন্ট্রিটি সাইট থেকে সরে যাবে। ফেরানো যাবে না।</>
          )}
        </p>
        <div className="confirm-actions">
          <button className="secondary-button" onClick={onCancel}>না, রাখি</button>
          <button className="danger-button" onClick={onConfirm}>হ্যাঁ, মুছে দিন</button>
        </div>
      </section>
    </div>
  );
}
