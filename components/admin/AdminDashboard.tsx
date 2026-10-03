"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  Activity,
  ArrowUpRight,
  Atom,
  BellRing,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  ClipboardList,
  ExternalLink,
  FileText,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Newspaper,
  Palette,
  Pencil,
  Plus,
  Save,
  Search,
  Settings2,
  Sparkles,
  Sprout,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import type { ResourceName } from "@/lib/types";
import { resourceFields, resourceLabels, resourceSingular } from "@/lib/content-config";

type Item = Record<string, any> & { id: string };
type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

type NavItem = { id: ResourceName | "overview"; label: string; icon: IconType };

const nav: NavItem[] = [
  { id: "overview", label: "ওভারভিউ", icon: LayoutDashboard },
  { id: "slides", label: "হিরো স্লাইড", icon: Image },
  { id: "notices", label: "নোটিশ", icon: BellRing },
  { id: "banners", label: "ব্যানার", icon: Sparkles },
  { id: "news", label: "সংবাদ", icon: Newspaper },
  { id: "updates", label: "সর্বশেষ আপডেট", icon: Activity },
  { id: "clubs", label: "ক্লাবসমূহ", icon: Trophy },
  { id: "settings", label: "স্কুল পরিচিতি", icon: Settings2 },
];

const emptyData: Record<ResourceName, Item[]> = {
  slides: [], notices: [], banners: [], news: [], updates: [], clubs: [], settings: [],
};

const fieldLabels: Record<string, string> = {
  eyebrow: "উপরের লেবেল", title: "শিরোনাম", description: "বিবরণ", cta_label: "বোতামের লেখা", cta_href: "বোতামের লিংক", image_url: "ছবির লিংক", accent: "অ্যাকসেন্ট রং", sort_order: "ক্রম", is_active: "প্রকাশিত", body: "বিস্তারিত লেখা", type: "নোটিশের ধরন", published_at: "প্রকাশের তারিখ", label: "ছোট লেবেল", slug: "ইউআরএল স্লাগ", excerpt: "সংক্ষিপ্ত লেখা", category: "বিভাগ", author: "লেখক", is_featured: "বিশেষ সংবাদ", date: "আপডেটের তারিখ", kind: "আপডেটের ধরন", name: "ক্লাবের নাম", tagline: "ক্লাবের ট্যাগলাইন", icon: "আইকন", domain: "ক্লাব পোর্টাল লিংক", key: "সেটিং কী", value: "মান", key_description: "বিবরণ",
};

const textareaFields = new Set(["description", "body", "excerpt", "value"]);
const dateFields = new Set(["published_at", "date"]);
const selectFields: Record<string, { label: string; value: string }[]> = {
  type: [{ label: "Admissions", value: "Admissions" }, { label: "Family note", value: "Family note" }, { label: "Campus life", value: "Campus life" }, { label: "Announcement", value: "Announcement" }],
  category: [{ label: "Learning", value: "Learning" }, { label: "Community", value: "Community" }, { label: "Outdoors", value: "Outdoors" }, { label: "Campus life", value: "Campus life" }],
  kind: [{ label: "Admissions", value: "Admissions" }, { label: "Student life", value: "Student life" }, { label: "Family note", value: "Family note" }, { label: "Campus life", value: "Campus life" }],
  icon: [{ label: "Palette", value: "Palette" }, { label: "Atom", value: "Atom" }, { label: "Trophy", value: "Trophy" }, { label: "MessagesSquare", value: "MessagesSquare" }, { label: "Sprout", value: "Sprout" }, { label: "Sparkles", value: "Sparkles" }],
};

function iconFor(name: string): IconType {
  if (name === "Palette") return Palette;
  if (name === "Atom") return Atom;
  if (name === "Trophy") return Trophy;
  if (name === "MessagesSquare") return MessagesSquare;
  if (name === "Sprout") return Sprout;
  return Sparkles;
}

function labelFor(field: string) {
  return fieldLabels[field] || field.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function displayValue(value: unknown, field: string) {
  if (field === "is_active" || field === "is_featured") return value ? "Published" : "Draft";
  if (field === "published_at" || field === "date") return value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(String(value))) : "—";
  if (field === "sort_order") return String(value ?? "0").padStart(2, "0");
  return String(value ?? "");
}

function toInputDate(value: unknown, field: string) {
  if (!value) return field === "date" ? new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 16);
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return field === "date" ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 16);
}

function initialForm(resource: ResourceName, item?: Item) {
  const result: Record<string, any> = { is_active: true, is_featured: false, sort_order: 0 };
  for (const field of resourceFields[resource]) {
    if (item && item[field] !== undefined) result[field] = item[field];
    else if (dateFields.has(field)) result[field] = field === "date" ? new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 16);
    else if (field === "is_active") result[field] = true;
    else if (field === "is_featured") result[field] = false;
    else if (field === "sort_order") result[field] = 0;
    else result[field] = "";
    if (dateFields.has(field)) result[field] = toInputDate(result[field], field);
  }
  return result;
}

export function AdminDashboard() {
  const [active, setActive] = useState<ResourceName | "overview">("overview");
  const [data, setData] = useState<Record<ResourceName, Item[]>>(emptyData);
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<{ resource: ResourceName; item?: Item } | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const responses = await Promise.all(Object.keys(resourceFields).map(async (resource) => {
        const response = await fetch(`/api/admin/${resource}`, { cache: "no-store" });
        if (response.status === 401) {
          window.location.href = "/admin/login";
          return [resource, []] as const;
        }
        const result = await response.json();
        return [resource, result.items || []] as const;
      }));
      const next = { ...emptyData };
      for (const [resource, items] of responses) next[resource as ResourceName] = items;
      setData(next);
    } catch {
      setToast({ kind: "error", message: "Could not load the content studio." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const currentItems = active === "overview" ? [] : data[active];
  const filteredItems = useMemo(() => {
    if (!search.trim()) return currentItems;
    const query = search.toLowerCase();
    return currentItems.filter((item) => Object.values(item).some((value) => String(value).toLowerCase().includes(query)));
  }, [currentItems, search]);

  function navigate(id: ResourceName | "overview") {
    setActive(id);
    setSearch("");
    setMobileNav(false);
  }

  function openCreate(resource: ResourceName) {
    setModal({ resource });
    setForm(initialForm(resource));
  }

  function openEdit(resource: ResourceName, item: Item) {
    setModal({ resource, item });
    setForm(initialForm(resource, item));
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!modal) return;
    setSaving(true);
    const url = modal.item ? `/api/admin/${modal.resource}/${modal.item.id}` : `/api/admin/${modal.resource}`;
    try {
      const response = await fetch(url, { method: modal.item ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      if (!response.ok) throw new Error(result.error || "Unable to save this item.");
      setModal(null);
      setToast({ kind: "success", message: `${resourceSingular[modal.resource][0].toUpperCase()}${resourceSingular[modal.resource].slice(1)} ${modal.item ? "updated" : "created"}.` });
      await loadData();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to save this item." });
    } finally { setSaving(false); }
  }

  async function deleteItem(resource: ResourceName, item: Item) {
    if (!window.confirm(`Delete “${item.title || item.name || item.label || item.key}”? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/admin/${resource}/${item.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete this item.");
      setToast({ kind: "success", message: "Item deleted." });
      await loadData();
    } catch (error) { setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to delete this item." }); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="admin-sidebar-top"><a href="/" className="admin-logo"><span className="brand-mark"><span>O</span></span><span><b>OKGS</b><small>Content studio</small></span></a><button className="sidebar-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19} /></button></div>
        <div className="workspace-chip"><span className="workspace-avatar">A</span><span><b>Admin workspace</b><small>Omar Kindergarten School</small></span><ChevronDown size={14} /></div>
        <p className="admin-nav-label">Workspace</p>
        <nav className="admin-nav">{nav.map((item) => { const Icon = item.icon; const count = item.id !== "overview" ? data[item.id]?.length : undefined; return <button key={item.id} className={active === item.id ? "is-active" : ""} onClick={() => navigate(item.id)}><Icon size={17} strokeWidth={active === item.id ? 2.2 : 1.8} /><span>{item.label}</span>{count !== undefined && <small>{String(count).padStart(2, "0")}</small>}</button>; })}</nav>
        <div className="sidebar-bottom"><a href="/" target="_blank" rel="noreferrer"><ExternalLink size={15} /> View public site</a><button onClick={logout}><LogOut size={15} /> Sign out</button><div className="sidebar-version"><span className="status-pulse" /> All changes sync live <small>v1.0</small></div></div>
      </aside>
      {mobileNav ? <button className="admin-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" /> : null}
      <main className="admin-main">
        <header className="admin-topbar"><button className="admin-menu-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button><div className="admin-breadcrumb"><span>OKGS studio</span><ChevronRight size={14} /><strong>{active === "overview" ? "Overview" : resourceLabels[active]}</strong></div><div className="admin-top-actions"><a href="/" target="_blank" rel="noreferrer" className="topbar-preview"><span /> Live site <ArrowUpRight size={13} /></a><div className="topbar-avatar">A</div></div></header>
        <div className="admin-content">
          {active === "overview" ? <Overview data={data} loading={loading} onCreate={openCreate} onNavigate={navigate} /> : <ContentManager resource={active} items={filteredItems} total={currentItems.length} loading={loading} search={search} onSearch={setSearch} onCreate={() => openCreate(active)} onEdit={(item) => openEdit(active, item)} onDelete={(item) => void deleteItem(active, item)} />}
        </div>
      </main>
      {modal ? <EditorModal resource={modal.resource} item={modal.item} form={form} setForm={setForm} saving={saving} onClose={() => setModal(null)} onSubmit={saveItem} /> : null}
      {toast ? <div className={`admin-toast ${toast.kind}`}><span>{toast.kind === "success" ? <Check size={16} /> : <X size={16} />}</span>{toast.message}</div> : null}
    </div>
  );
}

function Overview({ data, loading, onCreate, onNavigate }: { data: Record<ResourceName, Item[]>; loading: boolean; onCreate: (resource: ResourceName) => void; onNavigate: (id: ResourceName | "overview") => void }) {
  const published = Object.values(data).flat().filter((item) => item.is_active !== false).length;
  const featured = data.news.filter((item) => item.is_featured).length;
  const latest = [...data.news].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))).slice(0, 3);
  return <div className="overview-page"><div className="admin-page-heading"><div><p className="admin-kicker">Saturday, 03 October 2026 <span className="heading-dot" /> Live workspace</p><h1>Good morning, <em>admin.</em></h1><p className="heading-sub">Here is the pulse of your public site. Keep the good work moving.</p></div><button className="admin-primary-button" onClick={() => onCreate("news")}><Plus size={16} /> New story</button></div><div className="metric-grid"><Metric icon={Activity} label="Published items" value={loading ? "—" : published} note="Across your workspace" tone="green" /><Metric icon={Sparkles} label="Live experiences" value={loading ? "—" : data.slides.length + data.banners.length} note="Slides & banners" tone="gold" /><Metric icon={Trophy} label="Club portals" value={loading ? "—" : data.clubs.length} note="Connected spaces" tone="lilac" /><Metric icon={Newspaper} label="Featured stories" value={loading ? "—" : featured} note="In the journal" tone="peach" /></div><div className="overview-grid"><section className="panel pulse-panel"><div className="panel-heading"><div><span className="panel-eyebrow">Public site pulse</span><h2>Content at a glance</h2></div><button className="panel-link" onClick={() => onNavigate("settings")}>Manage profile <ArrowUpRight size={14} /></button></div><div className="pulse-bars"><PulseBar label="Hero slides" value={data.slides.length} max={8} color="gold" onClick={() => onNavigate("slides")} /><PulseBar label="Campus notices" value={data.notices.length} max={8} color="green" onClick={() => onNavigate("notices")} /><PulseBar label="Journal stories" value={data.news.length} max={8} color="lilac" onClick={() => onNavigate("news")} /><PulseBar label="Latest updates" value={data.updates.length} max={8} color="peach" onClick={() => onNavigate("updates")} /></div><div className="pulse-footer"><span><span className="status-pulse" /> Your public site is live</span><a href="/" target="_blank" rel="noreferrer">Preview site <ArrowUpRight size={13} /></a></div></section><section className="panel quick-panel"><div className="panel-heading"><div><span className="panel-eyebrow">Quick actions</span><h2>Make an update</h2></div><CirclePlus size={19} className="panel-muted-icon" /></div><QuickAction icon={Image} label="Add a hero slide" detail="Set the first impression" onClick={() => onCreate("slides")} /><QuickAction icon={BellRing} label="Post a notice" detail="Keep families informed" onClick={() => onCreate("notices")} /><QuickAction icon={Trophy} label="Update a club" detail="Shape a student portal" onClick={() => onCreate("clubs")} /><QuickAction icon={Settings2} label="Edit school profile" detail="Your words, everywhere" onClick={() => onNavigate("settings")} /></section></div><section className="panel recent-panel"><div className="panel-heading"><div><span className="panel-eyebrow">Editorial desk</span><h2>Recent stories</h2></div><button className="panel-link" onClick={() => onNavigate("news")}>Open all stories <ArrowUpRight size={14} /></button></div>{latest.length ? <div className="recent-table"><div className="recent-table-head"><span>Story</span><span>Category</span><span>Published</span><span /></div>{latest.map((item) => <button className="recent-row" key={item.id} onClick={() => onNavigate("news")}><span className="recent-story"><span className="recent-thumb" style={{ backgroundImage: `url("${item.image_url}")` }} /><b>{item.title}</b></span><span className="recent-category">{item.category}</span><span className="recent-date">{displayValue(item.published_at, "published_at")}</span><ChevronRight size={15} /></button>)}</div> : <div className="empty-dashboard"><Newspaper size={20} /><p>No stories yet. Your next story starts here.</p><button onClick={() => onCreate("news")}>Create story <ArrowRightIcon /></button></div>}</section></div>;
}

function Metric({ icon: Icon, label, value, note, tone }: { icon: IconType; label: string; value: string | number; note: string; tone: string }) { return <div className={`metric-card metric-${tone}`}><span className="metric-icon"><Icon size={17} /></span><span className="metric-label">{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function PulseBar({ label, value, max, color, onClick }: { label: string; value: number; max: number; color: string; onClick: () => void }) { return <button className="pulse-bar" onClick={onClick}><span><b>{label}</b><small>{value} live</small></span><i><em className={`bar-${color}`} style={{ width: `${Math.min(100, Math.max(11, value / max * 100))}%` }} /></i><ChevronRight size={15} /></button>; }
function QuickAction({ icon: Icon, label, detail, onClick }: { icon: IconType; label: string; detail: string; onClick: () => void }) { return <button className="quick-action" onClick={onClick}><span className="quick-icon"><Icon size={16} /></span><span><b>{label}</b><small>{detail}</small></span><ArrowUpRight size={15} /></button>; }
function ArrowRightIcon() { return <ChevronRight size={14} />; }

function ContentManager({ resource, items, total, loading, search, onSearch, onCreate, onEdit, onDelete }: { resource: ResourceName; items: Item[]; total: number; loading: boolean; search: string; onSearch: (value: string) => void; onCreate: () => void; onEdit: (item: Item) => void; onDelete: (item: Item) => void }) {
  const Icon = nav.find((item) => item.id === resource)?.icon || FileText;
  return <div className="manager-page"><div className="admin-page-heading manager-heading"><div><p className="admin-kicker"><Icon size={14} /> Content management <span className="heading-dot" /> {total} total</p><h1>{resourceLabels[resource]}</h1><p className="heading-sub">Create, refine and publish the pieces that make your public site feel alive.</p></div><button className="admin-primary-button" onClick={onCreate}><Plus size={16} /> Add {resourceSingular[resource]}</button></div><div className="manager-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={`Search ${resourceLabels[resource].toLowerCase()}…`} /><kbd>⌘ K</kbd></div><span className="toolbar-note"><span className="status-pulse" /> Changes publish instantly</span></div><div className="content-panel"><div className="content-table-head"><span>Content</span><span>Details</span><span>Status</span><span>Updated</span><span /></div>{loading ? <div className="table-loading"><span /><span /><span /></div> : items.length ? items.map((item) => <ContentRow key={item.id} resource={resource} item={item} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />) : <div className="empty-dashboard content-empty"><span className="empty-orb"><Icon size={23} /></span><h3>{search ? "Nothing matches that search" : `No ${resourceLabels[resource].toLowerCase()} yet`}</h3><p>{search ? "Try another word or clear the search." : "Add your first item and it will appear on the public site."}</p>{!search ? <button onClick={onCreate}><Plus size={14} /> Add {resourceSingular[resource]}</button> : null}</div>}</div></div>;
}

function ContentRow({ resource, item, onEdit, onDelete }: { resource: ResourceName; item: Item; onEdit: () => void; onDelete: () => void }) {
  const title = item.title || item.name || item.label || item.key || "Untitled";
  const Icon = resource === "clubs" ? iconFor(item.icon) : nav.find((entry) => entry.id === resource)?.icon || FileText;
  const details = resource === "news" ? item.category : resource === "clubs" ? item.domain?.replace(/^https?:\/\//, "") : resource === "settings" ? item.key : item.type || item.kind || item.eyebrow || item.slug || "—";
  const dateField = resource === "updates" ? "date" : resource === "settings" ? "updated_at" : resource === "clubs" ? "updated_at" : "published_at";
  return <div className="content-row"><span className="row-title"><span className={`row-icon row-${resource}`}><Icon size={17} /></span><span><b>{title}</b><small>{resource === "slides" ? item.description : resource === "news" ? item.excerpt : resource === "clubs" ? item.tagline : item.body || item.description || item.value || item.cta_href || "No supporting copy"}</small></span></span><span className="row-details">{details}</span><span className={`status-pill ${item.is_active === false ? "is-draft" : ""}`}><i />{item.is_active === false ? "Draft" : "Live"}</span><span className="row-date">{dateField === "updated_at" ? displayValue(item.updated_at, "published_at") : displayValue(item[dateField], dateField)}</span><span className="row-actions"><button onClick={onEdit} aria-label={`Edit ${title}`}><Pencil size={15} /></button><button onClick={onDelete} aria-label={`Delete ${title}`}><Trash2 size={15} /></button></span></div>;
}

function EditorModal({ resource, item, form, setForm, saving, onClose, onSubmit }: { resource: ResourceName; item?: Item; form: Record<string, any>; setForm: React.Dispatch<React.SetStateAction<Record<string, any>>>; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  const Icon = nav.find((entry) => entry.id === resource)?.icon || FileText;
  function update(field: string, value: any) { setForm((current) => ({ ...current, [field]: value })); }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><header className="editor-header"><div><span className="editor-kicker"><Icon size={14} /> {item ? "Edit" : "Create new"} / {resourceLabels[resource]}</span><h2 id="editor-title">{item ? `Refine ${item.title || item.name || item.label || item.key || "item"}` : `Add a ${resourceSingular[resource]}`}</h2></div><button className="modal-close" onClick={onClose} aria-label="Close editor"><X size={18} /></button></header><form onSubmit={onSubmit}><div className="editor-body"><div className="editor-fields">{resourceFields[resource].map((field) => <EditorField key={field} field={field} value={form[field]} update={update} />)}</div><aside className="editor-aside"><div className="editor-tip"><Sparkles size={17} /><b>Good content feels considered.</b><p>Keep the first line clear, the voice warm and the next step obvious.</p></div><div className="editor-aside-note"><span>Publishing</span><p>Live changes appear on the public site as soon as you save.</p></div></aside></div><footer className="editor-footer"><span><span className="status-pulse" /> {item ? "Editing existing content" : "Ready to publish"}</span><div><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : <><Save size={15} /> {item ? "Save changes" : "Publish"}</>}</button></div></footer></form></section></div>;
}

function EditorField({ field, value, update }: { field: string; value: any; update: (field: string, value: any) => void }) {
  if (field === "is_active" || field === "is_featured") return <label className="toggle-field"><span><b>{labelFor(field)}</b><small>{field === "is_active" ? "Make this visible on the public site" : "Feature this story in the journal"}</small></span><input type="checkbox" checked={Boolean(value)} onChange={(event) => update(field, event.target.checked)} /><i /></label>;
  const label = labelFor(field);
  const isWide = textareaFields.has(field);
  return <label className={`editor-field ${isWide ? "field-wide" : ""}`}><span>{label}{["title", "name", "key"].includes(field) ? <em>*</em> : null}</span>{selectFields[field] ? <select value={value ?? ""} onChange={(event) => update(field, event.target.value)}><option value="">Choose {label.toLowerCase()}</option>{selectFields[field].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : isWide ? <textarea value={value ?? ""} onChange={(event) => update(field, event.target.value)} rows={field === "value" ? 5 : 4} placeholder={`Write the ${label.toLowerCase()}…`} /> : <input type={dateFields.has(field) ? field === "date" ? "date" : "datetime-local" : field === "sort_order" ? "number" : field === "accent" ? "text" : "text"} value={value ?? ""} onChange={(event) => update(field, event.target.value)} placeholder={field === "image_url" ? "https://images.unsplash.com/…" : field === "domain" ? "https://club.okgs.info" : `Enter ${label.toLowerCase()}`} />}</label>;
}
