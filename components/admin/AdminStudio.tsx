"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  CloudUpload,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { fieldsFor, resourceMeta, resourceSchema, studioGroups } from "@/lib/content-config";
import type { ResourceName } from "@/lib/types";
import { iconFor } from "@/lib/icons";
import { FieldControl } from "@/components/admin/FieldControl";
import { loadMediaConfig, type MediaConfig } from "@/lib/upload-client";
import { bn, formatDate } from "@/lib/format";

type Item = Record<string, any> & { id: string };
type DataMap = Record<ResourceName, Item[]>;

const resourceList = Object.keys(resourceSchema) as ResourceName[];
const emptyData = Object.fromEntries(resourceList.map((resource) => [resource, []])) as unknown as DataMap;

const clubChildren: ResourceName[] = ["club_events", "club_posts", "club_gallery", "club_members", "club_achievements"];

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

function subtitleOf(resource: ResourceName, item: Item) {
  if (resource === "settings") return item.description || String(item.value || "").slice(0, 80);
  if (resource === "clubs") return item.tagline || item.description;
  if (resource === "gallery" || resource === "club_gallery") return item.event_name || item.caption;
  return String(item.description || item.excerpt || item.body || item.tagline || item.value || item.venue || "").slice(0, 110);
}

function thumbOf(item: Item) {
  return String(item.image_url || item.cover_image_url || item.photo_url || item.certificate_url || "");
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

  const coverage = useMemo(() => {
    return clubs.map((club) => ({
      club,
      counts: Object.fromEntries(
        clubChildren.map((resource) => [resource, data[resource].filter((row) => String(row.club_slug) === String(club.slug)).length]),
      ) as Record<string, number>,
      draft: data.clubs.some((entry) => entry.id === club.id && entry.is_active === false),
    }));
  }, [clubs, data]);

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="admin-sidebar-top">
          <a href="/" className="admin-logo">
            <span className="brand-mark"><span>অ</span></span>
            <span><b>ওকেজিএস</b><small>কনটেন্ট স্টুডিও</small></span>
          </a>
          <button className="sidebar-close" onClick={() => setMobileNav(false)} aria-label="মেনু বন্ধ করুন"><X size={19} /></button>
        </div>

        <div className="workspace-chip">
          <span className="workspace-avatar">A</span>
          <span><b>ওমর কিন্ডারগার্টেন স্কুল</b><small>সব ক্লাবের তথ্য এক জায়গায়</small></span>
        </div>

        <nav className="admin-nav">
          <button className={active === "overview" ? "is-active" : ""} onClick={() => navigate("overview")}>
            <LayoutDashboard size={16} />
            <span>ওভারভিউ</span>
          </button>
        </nav>

        {studioGroups.map((group) => (
          <div className="admin-nav-group" key={group.id}>
            <p className="admin-nav-label">{group.label}</p>
            <nav className="admin-nav">
              {group.resources.map((resource) => {
                const Icon = iconFor(resourceMeta[resource].icon);
                const rows = data[resource] ?? [];
                const live = rows.filter((row) => row.is_active !== false).length;
                return (
                  <button key={resource} className={active === resource ? "is-active" : ""} onClick={() => navigate(resource)}>
                    <Icon size={16} strokeWidth={active === resource ? 2.2 : 1.8} />
                    <span>{resourceMeta[resource].label}</span>
                    <small>{rows.length ? `${bn(live)}/${bn(rows.length)}` : "০"}</small>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="sidebar-bottom">
          <div className={`media-chip ${media?.enabled ? "is-on" : "is-off"}`}>
            <CloudUpload size={14} />
            <span>
              <b>{media?.enabled ? "Cloudinary সংযুক্ত" : "Cloudinary সেটআপ বাকি"}</b>
              <small>{media?.enabled ? `${media.cloudName} · ${media.folder}/` : "ছবি আপলোডের জন্য কনফিগ দরকার"}</small>
            </span>
          </div>
          <a href="/" target="_blank" rel="noreferrer"><Eye size={15} /> সাইট দেখুন</a>
          <button onClick={logout}><LogOut size={15} /> প্রস্থান</button>
        </div>
      </aside>

      {mobileNav ? <button className="admin-scrim" onClick={() => setMobileNav(false)} aria-label="মেনু বন্ধ করুন" /> : null}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" onClick={() => setMobileNav(true)} aria-label="মেনু খুলুন"><Menu size={20} /></button>
          <div className="admin-breadcrumb">
            <span>ওকেজিএস স্টুডিও</span>
            <ChevronRight size={14} />
            <strong>{active === "overview" ? "ওভারভিউ" : resourceMeta[active].label}</strong>
            {clubFilter ? <><ChevronRight size={14} /><span>{String(clubs.find((club) => club.slug === clubFilter)?.name ?? clubFilter)}</span></> : null}
          </div>
          <div className="admin-top-actions">
            <button className="topbar-preview" onClick={() => void load()} title="আবার লোড করুন"><RefreshCw size={13} className={loading ? "spin" : ""} /> রিফ্রেশ</button>
            <a href="/" target="_blank" rel="noreferrer" className="topbar-preview"><span /> লাইভ সাইট <ArrowUpRight size={13} /></a>
          </div>
        </header>

        <div className="admin-content">
          {loadError ? <p className="studio-error">{loadError}</p> : null}
          {active === "overview" ? (
            <Overview
              data={data}
              loading={loading}
              media={media}
              coverage={coverage}
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
                <div>
                  <p className="admin-kicker">
                    {(() => {
                      const Icon = iconFor(resourceMeta[active].icon);
                      return <Icon size={14} />;
                    })()}
                    {resourceMeta[active].group === "clubs" ? "ক্লাব তথ্যকেন্দ্র" : "কনটেন্ট ম্যানেজমেন্ট"} <span className="heading-dot" /> মোট {bn(currentItems.length)} টি
                  </p>
                  <h1>{resourceMeta[active].label}</h1>
                  <p className="heading-sub">{resourceMeta[active].description}</p>
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

              <section className="content-panel">
                <div className="content-table-head">
                  <span>{resourceMeta[active].singular}</span>
                  <span>{active === "clubs" ? "স্লাগ" : "বিভাগ / ধরন"}</span>
                  <span>অবস্থা</span>
                  <span>হালনাগাদ</span>
                  <span />
                </div>
                {loading ? (
                  <div className="table-loading"><span /><span /><span /></div>
                ) : filtered.length ? (
                  filtered.map((item) => (
                    <ContentRow
                      key={item.id}
                      resource={active}
                      item={item}
                      clubs={clubs}
                      busy={busyRow === item.id}
                      reorderable={reorderable}
                      isFirst={filtered[0]?.id === item.id}
                      isLast={filtered[filtered.length - 1]?.id === item.id}
                      onEdit={() => openEdit(active, item)}
                      onDuplicate={() => openDuplicate(active, item)}
                      onDelete={() => setConfirming({ resource: active, item })}
                      onToggle={() => void quickPatch(active, item, { is_active: item.is_active === false }, item.is_active === false ? "প্রকাশ করা হয়েছে।" : "খসড়াতে নেওয়া হয়েছে।")}
                      onMove={(direction) => void move(active, item, direction, filtered.map((row) => String(row.id)))}
                    />
                  ))
                ) : (
                  <div className="empty-dashboard content-empty">
                    <span className="empty-orb">{(() => {
                      const Icon = iconFor(resourceMeta[active].icon);
                      return <Icon size={23} />;
                    })()}</span>
                    <h3>{search || clubFilter || statusFilter !== "all" ? "এই ছাঁকনিতে কিছু নেই" : `এখনো ${resourceMeta[active].label} নেই`}</h3>
                    <p>{search || clubFilter ? "ছাঁকনি সরিয়ে দেখুন, অথবা নতুন এন্ট্রি যোগ করুন।" : "প্রথম এন্ট্রিটি যোগ করলেই সাইটে দেখা যাবে।"}</p>
                    <div className="empty-actions">
                      <button onClick={() => openCreate(active)}><Plus size={14} /> নতুন {resourceMeta[active].singular}</button>
                      {search || clubFilter || statusFilter !== "all" ? (
                        <button onClick={() => { setSearch(""); setClubFilter(""); setStatusFilter("all"); }}><X size={14} /> ছাঁকনি সরান</button>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
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
              ? clubChildren.reduce((total, resource) => total + data[resource].filter((row) => String(row.club_slug) === String(confirming.item.slug)).length, 0)
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

function ContentRow({
  resource,
  item,
  clubs,
  busy,
  reorderable,
  isFirst,
  isLast,
  onEdit,
  onToggle,
  onDelete,
  onDuplicate,
  onMove,
}: {
  resource: ResourceName;
  item: Item;
  clubs: Item[];
  busy: boolean;
  reorderable: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const Icon = iconFor(resourceMeta[resource].icon);
  const thumb = thumbOf(item);
  const isLive = item.is_active !== false;
  const detail =
    resource === "clubs"
      ? String(item.domain || item.slug || "").replace(/^https?:\/\//, "")
      : item.category || item.type || item.kind || item.role || item.event_type || item.level || item.field_kind || "—";
  const clubName = item.club_slug ? String(clubs.find((club) => club.slug === item.club_slug)?.name ?? item.club_slug) : "";
  const dateValue = item.published_at || item.event_date || item.date || item.achieved_on || item.taken_on || item.updated_at;
  const canPreview = previewHref(resource, item) !== "/";

  return (
    <div className={`content-row ${isLive ? "" : "is-draft"}`}>
      <span className="row-title">
        <span className={`row-icon row-${resource}`}>
          {thumb ? <img src={thumb} alt="" loading="lazy" /> : <Icon size={16} />}
        </span>
        <span>
          <b>{titleOf(resource, item)}</b>
          <small>{clubName ? `${clubName} · ` : ""}{subtitleOf(resource, item) || "—"}{hasField(resource, "slug") && item.slug ? ` · /${item.slug}` : ""}</small>
        </span>
      </span>
      <span className="row-details">{detail}</span>
      <button
        type="button"
        className={`status-pill ${isLive ? "" : "is-draft"}`}
        onClick={onToggle}
        disabled={busy}
        title={isLive ? "খসড়াতে নিতে ক্লিক করুন" : "প্রকাশ করতে ক্লিক করুন"}
      >
        <i />{busy ? "…" : isLive ? "প্রকাশিত" : "খসড়া"} {isLive ? <Eye size={11} /> : <EyeOff size={11} />}
      </button>
      <span className="row-date">{dateValue ? formatDate(dateValue, "short") : "—"}</span>
      <span className="row-actions">
        {reorderable ? (
          <>
            <button onClick={() => onMove(-1)} disabled={isFirst || busy} aria-label="উপরে নিন"><ArrowUp size={14} /></button>
            <button onClick={() => onMove(1)} disabled={isLast || busy} aria-label="নিচে নিন"><ArrowDown size={14} /></button>
          </>
        ) : null}
        {canPreview ? (
          <a href={previewHref(resource, item)} target="_blank" rel="noreferrer" aria-label="সাইটে দেখুন"><Eye size={15} /></a>
        ) : null}
        <button onClick={onDuplicate} aria-label="নকল তৈরি করুন"><Copy size={15} /></button>
        <button onClick={onEdit} aria-label="সম্পাদনা করুন"><Pencil size={15} /></button>
        <button className="is-danger" onClick={onDelete} aria-label="মুছে ফেলুন"><Trash2 size={15} /></button>
      </span>
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
          <div>
            <span className="editor-kicker"><Icon size={14} /> {mode === "edit" ? "সম্পাদনা" : "নতুন"} · {resourceMeta[resource].label}</span>
            <h2>{mode === "edit" ? titleOf(resource, item!) : `${resourceMeta[resource].singular} যোগ করুন`}</h2>
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

function Overview({
  data,
  loading,
  media,
  coverage,
  onNavigate,
  onCreate,
  onClub,
}: {
  data: DataMap;
  loading: boolean;
  media: MediaConfig | null;
  coverage: { club: Item; counts: Record<string, number>; draft: boolean }[];
  onNavigate: (resource: ResourceName | "overview") => void;
  onCreate: (resource: ResourceName) => void;
  onClub: (resource: ResourceName, slug: string) => void;
}) {
  const all = Object.values(data).flat();
  const live = all.filter((item) => item.is_active !== false).length;
  const drafts = all.length - live;
  const cloudinaryImages = all.filter((item) => Object.values(item).some((value) => typeof value === "string" && value.includes("res.cloudinary.com"))).length;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.club_events.filter((event) => String(event.event_date || "") >= today).length;
  const missingCover = data.clubs.filter((club) => !String(club.cover_image_url || club.image_url || "").trim()).length;
  const totalEvents = data.club_events.length;

  return (
    <div className="overview-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">
            {formatDate(new Date().toISOString())} <span className="heading-dot" /> লাইভ ওয়ার্কস্পেস
          </p>
          <h1>ক্লাব তথ্য <em>প্যানেল</em></h1>
          <p className="heading-sub">স্কুলের সব ক্লাবের আয়োজন, ছবি, সদস্য ও অর্জন এখান থেকেই চালিত হয়। প্রতিটি ঘর সম্পাদনাযোগ্য।</p>
        </div>
        <div className="heading-buttons">
          <button className="admin-primary-button" onClick={() => onCreate("clubs")}><Trophy size={15} /> নতুন ক্লাব</button>
          <button className="secondary-button" onClick={() => onCreate("club_events")}><Plus size={15} /> আয়োজন</button>
        </div>
      </div>

      <div className="metric-grid">
        <Metric icon={Trophy} label="ক্লাব" value={loading ? "—" : bn(data.clubs.length)} note={`${bn(coverage.length)} টি সক্রিয় তালিকাভুক্ত`} tone="green" />
        <Metric icon={CalendarDays} label="আসন্ন আয়োজন" value={loading ? "—" : bn(upcoming)} note={`মোট ${bn(totalEvents)} টি আয়োজন`} tone="gold" />
        <Metric icon={ImageIcon} label="Cloudinary ছবি" value={loading ? "—" : bn(cloudinaryImages)} note={media?.enabled ? `${media.cloudName} · ${media.folder}/` : "সেটআপ বাকি"} tone="lilac" />
        <Metric icon={Layers} label="খসড়া এন্ট্রি" value={loading ? "—" : bn(drafts)} note={`মোট ${bn(live)} টি প্রকাশিত`} tone="peach" />
      </div>

      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">ক্লাব ভরতি</span>
              <h2>প্রতিটি ক্লাবে কতটুকু তথ্য আছে</h2>
            </div>
            <button className="panel-link" onClick={() => onNavigate("clubs")}>ক্লাব তালিকা <ChevronRight size={14} /></button>
          </div>
          {coverage.length ? (
            <div className="coverage-table" role="table">
              <div className="coverage-head" role="row">
                <span role="columnheader">ক্লাব</span>
                {clubChildren.map((resource) => <span key={resource} role="columnheader" title={resourceMeta[resource].label}>{resourceMeta[resource].singular}</span>)}
              </div>
              {coverage.map(({ club, counts }) => (
                <div className="coverage-row" key={club.id}>
                  <span className="coverage-name" role="rowheader">
                    <span className="coverage-dot" style={{ background: club.accent || "#e7c27e" }} />
                    <button onClick={() => onNavigate("clubs")}>{club.name}</button>
                  </span>
                  {clubChildren.map((resource) => (
                    <button
                      key={resource}
                      className={`coverage-cell ${counts[resource] ? "" : "is-zero"}`}
                      onClick={() => onClub(resource, String(club.slug))}
                      title={`${club.name} — ${resourceMeta[resource].label}`}
                    >
                      {bn(counts[resource] || 0)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-dashboard">
              <Trophy size={20} />
              <p>এখনো কোনো ক্লাব তৈরি হয়নি।</p>
              <button onClick={() => onCreate("clubs")}>ক্লাব যোগ করুন <ChevronRight size={14} /></button>
            </div>
          )}
        </section>

        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">দ্রুত কাজ</span>
              <h2>এখনি শুরু করুন</h2>
            </div>
            <CirclePlus size={19} className="panel-muted-icon" />
          </div>
          <QuickAction icon={Trophy} label="নতুন ক্লাব যোগ করুন" detail="নাম, রং, ছবি ও পরিচিতি" onClick={() => onCreate("clubs")} />
          <QuickAction icon={CalendarDays} label="আয়োজন প্রকাশ করুন" detail="তারিখ, স্থান ও নিবন্ধন লিংক" onClick={() => onCreate("club_events")} />
          <QuickAction icon={ImageIcon} label="ছবি আপলোড করুন" detail="যেকোনো ছবি ঘরে ড্র্যাগ করে ছাড়ুন" onClick={() => onNavigate("club_gallery")} />
          <QuickAction icon={Users} label="কমিটির তালিকা" detail="শিক্ষার্থী ও উপদেষ্টা" onClick={() => onNavigate("club_members")} />
          <QuickAction icon={Settings2} label="স্কুলের তথ্য" detail="ফোন, ঠিকানা, লোগো" onClick={() => onNavigate("settings")} />
        </section>
      </div>

      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">সাম্প্রতিক</span>
              <h2>সবচেয়ে শেষে যা বদলেছে</h2>
            </div>
          </div>
          <ul className="recent-list">
            {all
              .map((item) => ({ item, resource: resourceList.find((resource) => data[resource].some((row) => row.id === item.id))! }))
              .filter((entry) => entry.resource)
              .sort((a, b) => String(b.item.updated_at || "").localeCompare(String(a.item.updated_at || "")))
              .slice(0, 6)
              .map(({ item, resource }) => (
                <li key={`${resource}-${item.id}`}>
                  <button onClick={() => onNavigate(resource)}>
                    <span className="recent-thumb">{thumbOf(item) ? <img src={thumbOf(item)} alt="" /> : <RowGlyph icon={resourceMeta[resource].icon} />}</span>
                    <span><b>{titleOf(resource, item)}</b><small>{resourceMeta[resource].label} · {formatDate(item.updated_at, "short")}</small></span>
                    <ChevronRight size={15} />
                  </button>
                </li>
              ))}
            {!all.length ? <li><p className="empty-note">কনটেন্ট এখানে দেখা যাবে।</p></li> : null}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">ছবি আপলোড</span>
              <h2>Cloudinary অবস্থা</h2>
            </div>
            <CloudUpload size={19} className={media?.enabled ? "is-ok" : "is-warn"} />
          </div>
          {media?.enabled ? (
            <>
              <p className="panel-copy">সংযুক্ত — <code>{media.cloudName}</code>, ফোল্ডার <code>{media.folder}/</code>, প্রিসেট <code>{media.uploadPreset}</code></p>
              <p className="panel-copy">যেকোনো ছবি ঘরে গিয়ে ফাইল টেনে ছেড়ে দিন বা <kbd>Ctrl</kbd>+<kbd>V</kbd> দিয়ে পেস্ট করুন। লিংক স্বয়ংক্রিয়ভাবে সাইটে বসে যাবে।</p>
            </>
          ) : (
            <>
              <p className="panel-copy">এখনো সেটআপ হয়নি। তবুও ছবির লিংক দিয়ে কাজ করা যায়।</p>
              <ol className="panel-steps">
                <li><code>.env.local</code>-এ যোগ করুন: <code>CLOUDINARY_CLOUD_NAME</code>, <code>CLOUDINARY_UPLOAD_PRESET</code></li>
                <li>Cloudinary Dashboard → Settings → Upload presets → একটি <b>Unsigned</b> preset বানান</li>
                <li>সার্ভার রিস্টার্ট করলেই আপলোড চালু হয়ে যাবে</li>
              </ol>
            </>
          )}
          {missingCover ? (
            <button className="panel-alert" onClick={() => onNavigate("clubs")}>
              {bn(missingCover)} টি ক্লাবের ছবি নেই — ছবি যোগ করুন <ChevronRight size={14} />
            </button>
          ) : (
            <p className="panel-ok"><Check size={13} /> সব ক্লাবের ছবি যুক্ত আছে।</p>
          )}
        </section>
      </div>
    </div>
  );
}

function RowGlyph({ icon }: { icon: string }) {
  const Icon = iconFor(icon);
  return <Icon size={14} />;
}

function Metric({ icon: Icon, label, value, note, tone }: { icon: any; label: string; value: string; note: string; tone: string }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <span className="metric-icon"><Icon size={17} /></span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function QuickAction({ icon: Icon, label, detail, onClick }: { icon: any; label: string; detail: string; onClick: () => void }) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span className="quick-icon"><Icon size={16} /></span>
      <span><b>{label}</b><small>{detail}</small></span>
      <ArrowUpRight size={15} />
    </button>
  );
}
