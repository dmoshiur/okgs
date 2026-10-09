"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleAlert,
  ClipboardCopy,
  ExternalLink,
  Facebook,
  Globe,
  Images,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  Monitor,
  Palette,
  Phone,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Upload,
  UserRound,
  UsersRound,
  Youtube,
} from "lucide-react";

import { ClubSiteView } from "@/components/club/ClubSiteView";
import { ThumbImage } from "@/components/public/Media";
import {
  ColorField,
  ImagePicker,
  LinesEditor,
  NumberField,
  RepeaterRow,
  StatePill,
  StudioCard,
  StudioEmpty,
  StudioGrid,
  StudioNote,
  TextAreaField,
  TextField,
} from "@/components/club/studio/fields";
import { postJson, useApi } from "@/components/sf/console/ui";
import { buildClubPalette } from "@/lib/club-palette";
import { extractLogoPalette } from "@/lib/club-colors";
import { uploadToCloudinary } from "@/lib/upload-client";
import { bn } from "@/lib/format";
import type { ClubSite } from "@/lib/club-sites";

/* -------------------------------------------------------------------- types -- */

interface GalleryRow {
  url: string;
  caption?: string;
}

interface LeaderRow {
  name: string;
  role: string;
  class_level?: string;
  section?: string;
  phone?: string;
  email?: string;
  facebook?: string;
  photo_url?: string;
  bio?: string;
}

interface EventRow {
  title: string;
  date?: string;
  description?: string;
  image_url?: string;
}

interface Draft {
  name: string;
  name_en: string;
  tagline: string;
  motto: string;
  about: string;
  founded_year: number;
  member_count: number;
  notice: string;
  logo_url: string;
  cover_image_url: string;
  accent: string;
  accent_2: string;
  logo_colors: string[];
  website: string;
  facebook: string;
  youtube: string;
  mission: string[];
  objectives: string[];
  gallery: GalleryRow[];
  leaders: LeaderRow[];
  events: EventRow[];
  contact: { phone?: string; email?: string; address?: string };
  meeting: { day?: string; time?: string; place?: string };
}

interface SitePayload {
  ok: boolean;
  canEdit: boolean;
  role: string;
  error?: string;
  site: ClubSite & { logo_colors?: string[] };
}

const LEADER_ROLES = [
  "সভাপতি",
  "সহ-সভাপতি",
  "সাধারণ সম্পাদক",
  "যুগ্ম সম্পাদক",
  "সাংগঠনিক সম্পাদক",
  "কোষাধ্যক্ষ",
  "প্রচার সম্পাদক",
  "শিক্ষক-পরামর্শক",
  "সদস্য",
];

type TabId = "identity" | "brand" | "mission" | "leaders" | "events" | "gallery" | "contact";

const TABS: { id: TabId; label: string; icon: typeof Info }[] = [
  { id: "identity", label: "পরিচিতি", icon: Info },
  { id: "brand", label: "লোগো ও রঙ", icon: Palette },
  { id: "mission", label: "লক্ষ্য ও উদ্দেশ্য", icon: Target },
  { id: "leaders", label: "নেতৃত্ব", icon: UsersRound },
  { id: "events", label: "আয়োজন", icon: CalendarDays },
  { id: "gallery", label: "ছবিঘর", icon: Images },
  { id: "contact", label: "যোগাযোগ", icon: Phone },
];

function draftFrom(site: ClubSite & { logo_colors?: string[] }): Draft {
  return {
    name: site.name || "",
    name_en: site.name_en || "",
    tagline: site.tagline || "",
    motto: site.motto || "",
    about: site.about || "",
    founded_year: Number(site.founded_year) || 0,
    member_count: Number(site.member_count) || 0,
    notice: site.notice || "",
    logo_url: site.logo_url || "",
    cover_image_url: site.cover_image_url || "",
    accent: site.accent || "#0f766e",
    accent_2: site.accent_2 || "#eab308",
    logo_colors: site.logo_colors || [],
    website: site.website || "",
    facebook: site.facebook || "",
    youtube: site.youtube || "",
    mission: site.mission || [],
    objectives: site.objectives || [],
    gallery: (site.gallery || []).map((row) => ({ url: row.url, caption: row.caption || "" })),
    leaders: (site.leaders || []).map((row) => ({ ...row })),
    events: (site.events || []).map((row) => ({ ...row })),
    contact: { ...(site.contact || {}) },
    meeting: { ...(site.meeting || {}) },
  };
}

/* -------------------------------------------------------------------- gate -- */

function StudioGate({
  slug,
  name,
  host,
  onSignedIn,
}: {
  slug: string;
  name: string;
  host: string;
  onSignedIn: () => Promise<void> | void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      await postJson(`/api/clubs/${slug}/login`, { identifier, password });
      setPassword("");
      await onSignedIn();
    } catch (issue) {
      setNote(issue instanceof Error ? issue.message : "লগইন করা যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cst-gate">
      <form className="cst-gate-card" onSubmit={submit}>
        <span className="cst-gate-mark"><ShieldCheck size={22} aria-hidden /></span>
        <p className="cst-gate-eyebrow">ক্লাব স্টুডিও</p>
        <h1>{name}</h1>
        <p className="cst-gate-host"><Globe size={13} aria-hidden /> {host}</p>
        <p className="cst-gate-copy">
          এই ক্লাবের সাইট সম্পাদনা করতে ক্লাব অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন। শিক্ষক ও প্রধান অ্যাডমিনও ঢুকতে পারেন।
        </p>

        <div className="cst-field">
          <label htmlFor="club-studio-id">ইমেইল বা আইডি</label>
          <input
            id="club-studio-id"
            value={identifier}
            autoComplete="username"
            placeholder={`${slug}@okgs.info`}
            onChange={(event) => setIdentifier(event.target.value)}
          />
        </div>

        <div className="cst-field">
          <label htmlFor="club-studio-pass">পাসওয়ার্ড</label>
          <input
            id="club-studio-pass"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {note ? <p className="cst-gate-error"><CircleAlert size={14} aria-hidden /> {note}</p> : null}

        <button type="submit" className="cst-btn cst-btn-solid cst-btn-block" disabled={busy}>
          <LogIn size={16} aria-hidden /> {busy ? "অপেক্ষা করুন…" : "লগইন"}
        </button>

        <div className="cst-gate-foot">
          <Link href={`/clubs/${slug}`}>ক্লাব পাতা</Link>
          <a href={`https://${host}`}>সাইট <ExternalLink size={12} aria-hidden /></a>
          <Link href="/sf/forgot-password">পাসওয়ার্ড ভুলে গেছেন?</Link>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------- studio -- */

export function ClubStudio({
  slug,
  initialSite,
  initialCanEdit = false,
  initialRole = "",
}: {
  slug: string;
  /** Resolved on the server so the studio renders on the first byte. */
  initialSite?: SitePayload["site"];
  initialCanEdit?: boolean;
  initialRole?: string;
}) {
  const { data, loading, error, reload, setData } = useApi<SitePayload>(`/api/clubs/${slug}/site`);
  const firstPaint: SitePayload | null = initialSite
    ? { ok: true, canEdit: initialCanEdit, role: initialRole, site: initialSite }
    : null;
  // The API response wins once it arrives; until then the server's copy is used.
  const payload = data ?? firstPaint;
  const site = payload?.site;
  const canEdit = Boolean(payload?.canEdit);
  // Seeded straight from the rendered payload, so the first paint already shows
  // the real editor (no spinner, no login flash) on both server and client.
  const [draft, setDraft] = useState<Draft | null>(() => (site ? draftFrom(site) : null));
  const [baseline, setBaseline] = useState(() => (site ? JSON.stringify(draftFrom(site)) : ""));
  const [tab, setTab] = useState<TabId>("identity");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [paletteNote, setPaletteNote] = useState("");
  const [busyPalette, setBusyPalette] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  // Phone first (that is how most parents will read the site), but a club admin
  // can widen the same live preview to desktop width before publishing.
  const [frame, setFrame] = useState<"phone" | "desktop">("phone");
  const [uploading, setUploading] = useState(false);
  const galleryInput = useRef<HTMLInputElement>(null);

  // A later refresh (or a save folded back in) re-seeds the form. The ref keeps
  // React from resetting what the admin is typing when the payload is the same.
  const syncedSite = useRef<typeof site>(site ?? null);
  useEffect(() => {
    if (!site || syncedSite.current === site) return;
    syncedSite.current = site;
    const next = draftFrom(site);
    setDraft(next);
    setBaseline(JSON.stringify(next));
  }, [site]);

  const dirty = Boolean(draft) && JSON.stringify(draft) !== baseline;

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }, []);

  const patch = useCallback((values: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...values } : current));
  }, []);

  const notify = useCallback((kind: "ok" | "bad", text: string) => {
    setToast({ kind, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const save = useCallback(async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const response = await postJson<{ site: ClubSite }>(`/api/clubs/${slug}/site`, { action: "save", ...draft });
      // Fold the server's answer back in so the header, checklist and preview
      // show exactly what a visitor will get.
      if (response?.site && site) {
        setData({ ok: true, canEdit: true, role: payload?.role || "club", site: { ...site, ...response.site } });
      } else {
        await reload();
      }
      setBaseline(JSON.stringify(draft));
      notify("ok", "সংরক্ষিত হয়েছে — সাবডোমেইনে সাথে সাথে দেখা যাবে।");
    } catch (issue) {
      notify("bad", issue instanceof Error ? issue.message : "সংরক্ষণ করা যায়নি।");
    } finally {
      setSaving(false);
    }
  }, [draft, saving, slug, site, payload?.role, setData, reload, notify]);

  // ⌘/Ctrl + S saves, and a plain reload never silently drops edits.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const palette = useMemo(
    () =>
      buildClubPalette({
        accent: draft?.accent,
        accent2: draft?.accent_2,
        swatches: draft?.logo_colors?.length ? draft.logo_colors : null,
      }),
    [draft?.accent, draft?.accent_2, draft?.logo_colors],
  );

  const previewSite = useMemo<ClubSite | null>(() => {
    if (!site || !draft) return null;
    // The draft wins over the saved row, and freshly uploaded gallery photos are
    // folded in straight away so the preview matches what saving will publish.
    const galleryUrls = new Set(draft.gallery.map((row) => row.url));
    return {
      ...site,
      ...draft,
      customized: true,
      galleryItems: [...draft.gallery, ...site.galleryItems.filter((row) => !galleryUrls.has(row.url))],
    } as ClubSite;
  }, [site, draft]);

  const checks = useMemo(() => {
    if (!draft) return [] as { id: TabId; label: string; done: boolean; detail: string }[];
    return [
      { id: "identity" as TabId, label: "নাম, ট্যাগলাইন ও পরিচিতি", done: Boolean(draft.name && (draft.tagline || draft.about)), detail: draft.name ? "ঠিক আছে" : "নাম দিন" },
      { id: "brand" as TabId, label: "লোগো ও ব্র্যান্ড রঙ", done: Boolean(draft.logo_url), detail: draft.logo_url ? "লোগো আছে" : "লোগো আপলোড করুন" },
      { id: "brand" as TabId, label: "কভার ছবি", done: Boolean(draft.cover_image_url), detail: draft.cover_image_url ? "ঠিক আছে" : "কভার দিন" },
      { id: "mission" as TabId, label: "লক্ষ্য ও উদ্দেশ্য", done: draft.mission.length + draft.objectives.length > 0, detail: `${bn(draft.mission.length + draft.objectives.length)} টি লাইন` },
      { id: "leaders" as TabId, label: "সভাপতি ও কমিটি", done: draft.leaders.length > 0, detail: `${bn(draft.leaders.length)} জন` },
      { id: "events" as TabId, label: "আয়োজন", done: draft.events.length > 0, detail: `${bn(draft.events.length)} টি` },
      { id: "gallery" as TabId, label: "ছবিঘর", done: draft.gallery.length > 0, detail: `${bn(draft.gallery.length)} টি ছবি` },
      { id: "contact" as TabId, label: "যোগাযোগ ও সভা", done: Boolean(draft.contact?.phone || draft.contact?.email), detail: draft.contact?.phone ? "ঠিক আছে" : "ফোন/ইমেইল দিন" },
    ];
  }, [draft]);

  const doneCount = checks.filter((item) => item.done).length;

  const sampleLogo = useCallback(
    async (url: string) => {
      if (!url) {
        setPaletteNote("আগে লোগো আপলোড করুন বা লোগোর লিংক দিন।");
        return;
      }
      setBusyPalette(true);
      const sampled = await extractLogoPalette(url, {
        accent: draft?.accent,
        accent2: draft?.accent_2,
      }).catch(() => null);
      setBusyPalette(false);
      if (!sampled) {
        setPaletteNote("এই ছবি থেকে রঙ তোলা যায়নি (বাইরের ডোমেইনের ছবি হলে ব্রাউজার আটকে দেয়)। নিচে হাতে রঙ বেছে নিতে পারেন।");
        return;
      }
      patch({ accent: sampled.accent, accent_2: sampled.accent2, logo_colors: sampled.swatches });
      setPaletteNote(`লোগো থেকে ${bn(sampled.swatches.length)} টি রঙ পাওয়া গেছে — সেভ করলেই পুরো সাইট বদলে যাবে।`);
    },
    [draft?.accent, draft?.accent_2, patch],
  );

  const uploadGallery = async (files: FileList | null) => {
    if (!files?.length || !draft) return;
    setUploading(true);
    try {
      const added: GalleryRow[] = [];
      for (const file of Array.from(files).slice(0, 12)) {
        const result = await uploadToCloudinary({ file, prefix: slug, label: `${slug}-gallery` });
        added.push({ url: result.url, caption: "" });
      }
      set("gallery", [...draft.gallery, ...added]);
      notify("ok", `${bn(added.length)} টি ছবি যোগ হয়েছে — সংরক্ষণ চাপুন।`);
    } catch (issue) {
      notify("bad", issue instanceof Error ? issue.message : "আপলোড করা যায়নি।");
    } finally {
      setUploading(false);
    }
  };

  const logout = async () => {
    await fetch(`/api/clubs/${slug}/login`, { method: "DELETE" }).catch(() => null);
    await reload();
  };

  const copyHost = async () => {
    if (!site) return;
    try {
      await navigator.clipboard.writeText(site.url || `https://${site.host}`);
      notify("ok", "সাইটের ঠিকানা কপি হয়েছে।");
    } catch {
      notify("bad", "কপি করা যায়নি — হাতেই লিখে নিন।");
    }
  };

  if (loading && !payload) {
    return (
      <div className="cst-loading">
        <RefreshCw size={18} className="spin" aria-hidden />
        <p>স্টুডিও লোড হচ্ছে…</p>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="cst-gate">
        <div className="cst-gate-card">
          <span className="cst-gate-mark"><CircleAlert size={22} aria-hidden /></span>
          <h1>ক্লাবটি পাওয়া যায়নি</h1>
          <p className="cst-gate-copy">{error || "ঠিকানাটি পরীক্ষা করুন।"}</p>
          <Link className="cst-btn cst-btn-soft" href="/clubs">সব ক্লাব দেখুন</Link>
        </div>
      </div>
    );
  }

  if (!canEdit || !draft) {
    return <StudioGate slug={slug} name={site.name} host={site.host} onSignedIn={() => reload()} />;
  }

  const siteUrl = site.url || `https://${site.host}`;

  const frameToggle = (
    <div className="cst-seg" role="group" aria-label="প্রিভিউর প্রস্থ">
      <button type="button" className={frame === "phone" ? "is-on" : ""} aria-pressed={frame === "phone"} onClick={() => setFrame("phone")}>
        <Smartphone size={13} aria-hidden /> ফোন
      </button>
      <button type="button" className={frame === "desktop" ? "is-on" : ""} aria-pressed={frame === "desktop"} onClick={() => setFrame("desktop")}>
        <Monitor size={13} aria-hidden /> ডেস্কটপ
      </button>
    </div>
  );

  const previewFrame = (width: "phone" | "desktop") => (
    <div className={`cst-frame is-${width}`}>
      <div className="cst-frame-bar">
        <span className="cst-frame-dots" aria-hidden><i /><i /><i /></span>
        <span className="cst-frame-url"><Globe size={11} aria-hidden /> {site.host}</span>
        {width === "desktop" ? <span className="cst-frame-tag">ডেস্কটপ</span> : null}
      </div>
      <div className="cst-frame-stage">
        {previewSite ? <ClubSiteView site={previewSite} palette={palette} preview /> : null}
      </div>
    </div>
  );

  const moveRow = <T,>(rows: T[], index: number, delta: number) => {
    const next = [...rows];
    const target = index + delta;
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };

  return (
    <div className="cst">
      {toast ? (
        <div className={`cst-toast is-${toast.kind}`} role="status">
          {toast.kind === "ok" ? <Check size={16} aria-hidden /> : <CircleAlert size={16} aria-hidden />}
          <span>{toast.text}</span>
        </div>
      ) : null}

      <header className="cst-top">
        <div className="cst-top-brand">
          <span className="cst-top-logo">
            <ThumbImage
              src={draft.logo_url}
              alt=""
              fallback={<b>{(site.short_code || slug).slice(0, 3)}</b>}
            />
          </span>
          <div>
            <p className="cst-top-eyebrow">ক্লাব স্টুডিও</p>
            <strong>{draft.name || site.name}</strong>
            <small><Globe size={11} aria-hidden /> {site.host}</small>
          </div>
        </div>

        <div className="cst-top-actions">
          <StatePill state={dirty ? "wait" : "ok"}>{dirty ? "সংরক্ষণ বাকি" : "সব সংরক্ষিত"}</StatePill>
          <button type="button" className="cst-btn cst-btn-quiet" onClick={() => setShowPreview((value) => !value)}>
            <LayoutDashboard size={15} aria-hidden /> প্রিভিউ
          </button>
          <a className="cst-btn cst-btn-soft" href={siteUrl} target="_blank" rel="noreferrer noopener">
            <ExternalLink size={15} aria-hidden /> সাইট দেখুন
          </a>
          <button type="button" className="cst-btn cst-btn-solid" onClick={() => void save()} disabled={saving || !dirty}>
            <Save size={15} aria-hidden /> {saving ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"}
          </button>
        </div>
      </header>

      <div className={`cst-shell${showPreview ? "" : " no-preview"}`}>
        <nav className="cst-nav" aria-label="স্টুডিও অংশ">
          <ul>
            {TABS.map((item) => {
              const Icon = item.icon;
              const rows =
                item.id === "leaders" ? draft.leaders.length
                : item.id === "events" ? draft.events.length
                : item.id === "gallery" ? draft.gallery.length
                : 0;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={tab === item.id ? "is-active" : ""}
                    onClick={() => setTab(item.id)}
                    aria-current={tab === item.id ? "true" : undefined}
                  >
                    <Icon size={16} aria-hidden />
                    <span>{item.label}</span>
                    {rows ? <em>{bn(rows)}</em> : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="cst-nav-foot">
            <span className="cst-progress" aria-hidden>
              <i style={{ width: `${Math.round((doneCount / checks.length) * 100)}%` }} />
            </span>
            <p>{bn(doneCount)} / {bn(checks.length)} ধাপ তৈরি</p>
            <button type="button" className="cst-btn cst-btn-quiet" onClick={() => void logout()}>
              <LogOut size={13} aria-hidden /> লগআউট
            </button>
          </div>
        </nav>

        <main className="cst-main">
          {tab === "identity" ? (
            <>
              <StudioCard title="পরিচয়" hint="নাম, ট্যাগলাইন আর এক নজরে পরিচিতি — সাইটের হিরোতে এগুলোই দেখা যায়।">
                <StudioGrid>
                  <TextField label="ক্লাবের নাম (বাংলা)" value={draft.name} onChange={(value) => set("name", value)} />
                  <TextField label="নাম (ইংরেজি)" value={draft.name_en} onChange={(value) => set("name_en", value)} />
                </StudioGrid>
                <StudioGrid>
                  <TextField label="ট্যাগলাইন" value={draft.tagline} onChange={(value) => set("tagline", value)} hint="হিরোর নিচে এক লাইনে দেখা যায়।" />
                  <TextField label="মটো / স্লোগান" value={draft.motto} onChange={(value) => set("motto", value)} hint="উদ্ধৃতি চিহ্নসহ দেখানো হয়।" />
                </StudioGrid>
                <TextAreaField
                  label="ক্লাব সম্পর্কে"
                  rows={5}
                  value={draft.about}
                  onChange={(value) => set("about", value)}
                  hint="দুই-তিন বাক্যে ক্লাবের কাজ। সাইটের ‘পরিচিতি’ অংশে বড় করে বসে।"
                />
                <StudioGrid>
                  <NumberField label="প্রতিষ্ঠার বছর" value={draft.founded_year} onChange={(value) => set("founded_year", value)} max={new Date().getFullYear()} />
                  <NumberField label="মোট সদস্য" value={draft.member_count} onChange={(value) => set("member_count", value)} />
                </StudioGrid>
              </StudioCard>

              <StudioCard
                title="ঘোষণা"
                hint="সাইটের একেবারে উপরে একটি ব্যান্ড হিসেবে দেখা যাবে — ছোট রাখলে ভালো লাগে।"
              >
                <TextAreaField label="নোটিশ (ফাঁকা রাখলে দেখাবে না)" rows={2} value={draft.notice} onChange={(value) => set("notice", value)} />
              </StudioCard>

              <StudioCard title="ক্লাবের ঠিকানা" hint="এই সাইট কোথায় থাকবে — ডোমেইন আর মেইন সাইটের সংযোগ।" tone="accent">
                <div className="cst-host">
                  <span className="cst-host-chip"><Globe size={14} aria-hidden /> {site.host}</span>
                  <div className="cst-host-actions">
                    <button type="button" className="cst-btn cst-btn-quiet" onClick={() => void copyHost()}>
                      <ClipboardCopy size={14} aria-hidden /> ঠিকানা কপি
                    </button>
                    <a className="cst-btn cst-btn-quiet" href={siteUrl} target="_blank" rel="noreferrer noopener">
                      <ArrowUpRight size={14} aria-hidden /> খুলুন
                    </a>
                  </div>
                </div>
                <StudioNote>
                  হোস্টিং-এ <strong>*.{site.host.split(".").slice(1).join(".") || "okgs.info"}</strong> ওয়াইল্ডকার্ড ডোমেইন যোগ করলেই প্রতিটি ক্লাব নিজের
                  সাবডোমেইনে আলাদা সাইট হিসেবে খুলবে। <code>/clubs/{slug}/site</code> ঠিকানাটি পুরোনো লিংকের জন্য স্বয়ংক্রিয়ভাবে এখানে ফরওয়ার্ড হয়।
                </StudioNote>
                <StudioGrid>
                  <TextField label="নিজস্ব ওয়েব ঠিকানা (ঐচ্ছিক)" value={draft.website} onChange={(value) => set("website", value)} placeholder={`https://${site.host}`} type="url" />
                  <TextField label="ফেসবুক পেজ" value={draft.facebook} onChange={(value) => set("facebook", value)} type="url" placeholder="https://facebook.com/…" />
                </StudioGrid>
                <TextField label="ইউটিউব চ্যানেল" value={draft.youtube} onChange={(value) => set("youtube", value)} type="url" placeholder="https://youtube.com/@…" />
              </StudioCard>
            </>
          ) : null}

          {tab === "brand" ? (
            <>
              <StudioCard title="লোগো" hint="লোগো থেকে রঙ নিয়ে পুরো সাইট সাজানো হয় — হিরো, নেভিগেশন, কার্ড, ফুটার।">
                <StudioGrid columns={2}>
                  <ImagePicker
                    slug={slug}
                    label="ক্লাবের লোগো"
                    value={draft.logo_url}
                    hint="স্বচ্ছ PNG বা SVG সবচেয়ে ভালো দেখায়।"
                    onChange={(value) => set("logo_url", value)}
                    onUploaded={(_, url) => void sampleLogo(url)}
                  />
                  <ImagePicker
                    slug={slug}
                    label="কভার ছবি"
                    value={draft.cover_image_url}
                    aspect="wide"
                    hint="হিরোর পেছনে হালকা ব্লারে বসে। চওড়া ছবি দিন।"
                    onChange={(value) => set("cover_image_url", value)}
                  />
                </StudioGrid>
              </StudioCard>

              <StudioCard
                title="ব্র্যান্ড রঙ"
                hint="লোগো থেকে তোলা প্যালেট, অথবা নিজে বেছে নেওয়া দুটি রঙ — একটিই সিস্টেম পুরো সাইটে চলে।"
                action={
                  <button type="button" className="cst-btn cst-btn-soft" disabled={busyPalette} onClick={() => void sampleLogo(draft.logo_url)}>
                    <RefreshCw size={14} className={busyPalette ? "spin" : undefined} aria-hidden /> {busyPalette ? "তোলা হচ্ছে…" : "লোগো থেকে রঙ নিন"}
                  </button>
                }
              >
                <div className="cst-palette club-brand" style={palette.vars as React.CSSProperties}>
                  <div className="cst-palette-swatches">
                    {(draft.logo_colors.length ? draft.logo_colors : [draft.accent, draft.accent_2]).map((hex, index) => (
                      <button
                        key={`${hex}-${index}`}
                        type="button"
                        className="cst-swatch"
                        title={`${hex} — প্রধান রঙ করুন`}
                        style={{ background: hex }}
                        onClick={() => set("accent", hex)}
                      >
                        <span>{index === 0 ? "প্রধান" : `${bn(index + 1)}`}</span>
                      </button>
                    ))}
                    {!draft.logo_colors.length ? <span className="cst-palette-empty">লোগো দিলে এখানে লোগোর রঙগুলো আসবে</span> : null}
                  </div>

                  <div className="cst-palette-preview">
                    <span className="cst-palette-chip">নমুনা</span>
                    <span className="cst-palette-btn">বাটন</span>
                    <span className="cst-palette-ghost">ঘোস্ট</span>
                    <p>{palette.source === "logo" ? "রঙ এসেছে লোগো থেকে" : palette.source === "studio" ? "রঙ হাতে বেছে নেওয়া" : "ডিফল্ট রঙ"}</p>
                  </div>

                  <div className="cst-palette-actions">
                    <button
                      type="button"
                      className="cst-btn cst-btn-quiet"
                      onClick={() => {
                        set("logo_colors", []);
                        setPaletteNote("অটো প্যালেট মুছে ফেলা হয়েছে — এখন হাতে দেওয়া রঙ চলবে।");
                      }}
                    >
                      অটো প্যালেট মুছুন
                    </button>
                  </div>
                </div>

                <StudioGrid>
                  <ColorField label="প্রধান রঙ" value={draft.accent} onChange={(value) => set("accent", value)} />
                  <ColorField label="দ্বিতীয় রঙ" value={draft.accent_2} onChange={(value) => set("accent_2", value)} />
                </StudioGrid>

                {paletteNote ? <StudioNote kind="ok">{paletteNote}</StudioNote> : null}
              </StudioCard>
            </>
          ) : null}

          {tab === "mission" ? (
            <StudioCard title="লক্ষ্য ও উদ্দেশ্য" hint="প্রতিটি লাইন সাইটের কার্ডে আলাদা পয়েন্ট হিসেবে দেখানো হয়।">
              <LinesEditor
                label="আমাদের লক্ষ্য"
                values={draft.mission}
                onChange={(values) => set("mission", values)}
                placeholder="যেমন: বিজ্ঞানকে হাতে-কলমে অনুভব করার জায়গা বানানো।"
              />
              <LinesEditor
                label="ক্লাবের উদ্দেশ্য"
                ordered
                values={draft.objectives}
                onChange={(values) => set("objectives", values)}
                placeholder="যেমন: নিয়মিত কুইজ ও অলিম্পিয়াডে অংশ নেওয়া।"
              />
            </StudioCard>
          ) : null}

          {tab === "leaders" ? (
            <StudioCard
              title="সভাপতি, সম্পাদক ও কমিটি"
              hint="ছবি দিলে কার্ডে ছবি, না দিলে নামের প্রথম অক্ষর দেখানো হয়।"
              action={
                <button
                  type="button"
                  className="cst-btn cst-btn-solid"
                  onClick={() =>
                    set("leaders", [
                      ...draft.leaders,
                      { name: "", role: "সভাপতি", class_level: "", section: "", phone: "", email: "", facebook: "", photo_url: "", bio: "" },
                    ])
                  }
                >
                  <Plus size={15} aria-hidden /> নতুন জন
                </button>
              }
            >
              {draft.leaders.length ? (
                <div className="cst-rows">
                  {draft.leaders.map((leader, index) => (
                    <RepeaterRow
                      key={index}
                      index={index}
                      total={draft.leaders.length}
                      title={leader.name || "নাম দিন"}
                      subtitle={leader.role}
                      onMove={(delta) => set("leaders", moveRow(draft.leaders, index, delta))}
                      onRemove={() => set("leaders", draft.leaders.filter((_, i) => i !== index))}
                    >
                      <StudioGrid columns={3}>
                        <ImagePicker
                          slug={slug}
                          label="ছবি"
                          value={leader.photo_url || ""}
                          onChange={(value) => set("leaders", draft.leaders.map((row, i) => (i === index ? { ...row, photo_url: value } : row)))}
                        />
                        <TextField label="নাম" value={leader.name} onChange={(value) => set("leaders", draft.leaders.map((row, i) => (i === index ? { ...row, name: value } : row)))} />
                        <div className="cst-field">
                          <label htmlFor={`leader-role-${index}`}>পদ</label>
                          <input
                            id={`leader-role-${index}`}
                            list="cst-leader-roles"
                            value={leader.role}
                            onChange={(event) => set("leaders", draft.leaders.map((row, i) => (i === index ? { ...row, role: event.target.value } : row)))}
                          />
                        </div>
                      </StudioGrid>

                      <StudioGrid columns={4}>
                        <TextField label="শ্রেণি" value={leader.class_level || ""} onChange={(value) => set("leaders", draft.leaders.map((row, i) => (i === index ? { ...row, class_level: value } : row)))} />
                        <TextField label="শাখা" value={leader.section || ""} onChange={(value) => set("leaders", draft.leaders.map((row, i) => (i === index ? { ...row, section: value } : row)))} />
                        <TextField label="মোবাইল" value={leader.phone || ""} onChange={(value) => set("leaders", draft.leaders.map((row, i) => (i === index ? { ...row, phone: value } : row)))} />
                        <TextField label="ইমেইল" value={leader.email || ""} onChange={(value) => set("leaders", draft.leaders.map((row, i) => (i === index ? { ...row, email: value } : row)))} />
                      </StudioGrid>

                      <TextAreaField
                        label="সংক্ষিপ্ত পরিচিতি (ঐচ্ছিক)"
                        rows={2}
                        value={leader.bio || ""}
                        onChange={(value) => set("leaders", draft.leaders.map((row, i) => (i === index ? { ...row, bio: value } : row)))}
                      />
                    </RepeaterRow>
                  ))}
                </div>
              ) : (
                <StudioEmpty
                  action={
                    <button type="button" className="cst-btn cst-btn-solid" onClick={() => set("leaders", [{ name: "", role: "সভাপতি" }])}>
                      <UserRound size={15} aria-hidden /> প্রথম জন যোগ করুন
                    </button>
                  }
                >
                  এখনো কেউ যোগ করা হয়নি — সভাপতি, সম্পাদক ও শিক্ষক-পরামর্শকের তথ্য দিন।
                </StudioEmpty>
              )}
              <datalist id="cst-leader-roles">
                {LEADER_ROLES.map((role) => <option key={role} value={role} />)}
              </datalist>
            </StudioCard>
          ) : null}

          {tab === "events" ? (
            <StudioCard
              title="আয়োজন ও অনুষ্ঠান"
              hint="তারিখ দিলে সাইট উপcoming/পুরোনো আলাদা করে সাজায়; বছর বা ‘প্রতি বছর’ লেখাও চলে।"
              action={
                <button
                  type="button"
                  className="cst-btn cst-btn-solid"
                  onClick={() => set("events", [...draft.events, { title: "", date: "", description: "", image_url: "" }])}
                >
                  <Plus size={15} aria-hidden /> নতুন আয়োজন
                </button>
              }
            >
              {draft.events.length ? (
                <div className="cst-rows">
                  {draft.events.map((event, index) => (
                    <RepeaterRow
                      key={index}
                      index={index}
                      total={draft.events.length}
                      title={event.title || "শিরোনাম দিন"}
                      subtitle={event.date}
                      onMove={(delta) => set("events", moveRow(draft.events, index, delta))}
                      onRemove={() => set("events", draft.events.filter((_, i) => i !== index))}
                    >
                      <StudioGrid>
                        <TextField label="শিরোনাম" value={event.title} onChange={(value) => set("events", draft.events.map((row, i) => (i === index ? { ...row, title: value } : row)))} />
                        <TextField
                          label="তারিখ / সময়"
                          value={event.date || ""}
                          placeholder="2026-03-14 অথবা ‘প্রতি বছর’"
                          onChange={(value) => set("events", draft.events.map((row, i) => (i === index ? { ...row, date: value } : row)))}
                        />
                      </StudioGrid>
                      <TextAreaField
                        label="বিবরণ"
                        rows={2}
                        value={event.description || ""}
                        onChange={(value) => set("events", draft.events.map((row, i) => (i === index ? { ...row, description: value } : row)))}
                      />
                      <ImagePicker
                        slug={slug}
                        label="আয়োজনের ছবি (ঐচ্ছিক)"
                        aspect="wide"
                        value={event.image_url || ""}
                        onChange={(value) => set("events", draft.events.map((row, i) => (i === index ? { ...row, image_url: value } : row)))}
                      />
                    </RepeaterRow>
                  ))}
                </div>
              ) : (
                <StudioEmpty
                  action={
                    <button type="button" className="cst-btn cst-btn-solid" onClick={() => set("events", [{ title: "", date: "", description: "", image_url: "" }])}>
                      <CalendarDays size={15} aria-hidden /> প্রথম আয়োজন যোগ করুন
                    </button>
                  }
                >
                  এখনো কোনো আয়োজন নেই — বার্ষিক অনুষ্ঠান, প্রতিযোগিতা বা মিটিং যোগ করুন।
                </StudioEmpty>
              )}
            </StudioCard>
          ) : null}

          {tab === "gallery" ? (
            <StudioCard
              title="ছবিঘর"
              hint="একসাথে কয়েকটি ছবি বেছে নিতে পারেন — আপলোড শেষে সংরক্ষণ চাপুন। ক্যাপশন দিলে ছবির নিচে দেখা যায়।"
              action={
                <>
                  <button type="button" className="cst-btn cst-btn-solid" disabled={uploading} onClick={() => galleryInput.current?.click()}>
                    <Upload size={15} aria-hidden /> {uploading ? "আপলোড হচ্ছে…" : "ছবি যোগ করুন"}
                  </button>
                  <input ref={galleryInput} hidden type="file" accept="image/*" multiple onChange={(event) => { void uploadGallery(event.target.files); event.target.value = ""; }} />
                </>
              }
            >
              {draft.gallery.length ? (
                <div className="cst-shots">
                  {draft.gallery.map((photo, index) => (
                    <figure key={`${photo.url}-${index}`} className="cst-shot">
                      <span className="cst-shot-frame">
                        <ThumbImage
                          src={photo.url}
                          alt=""
                          fallback={<span className="cst-shot-missing"><ImageIcon size={18} aria-hidden /> ছবি পাওয়া যায়নি</span>}
                        />
                      </span>
                      <input
                        placeholder="ক্যাপশন (ঐচ্ছিক)"
                        value={photo.caption || ""}
                        onChange={(event) => set("gallery", draft.gallery.map((row, i) => (i === index ? { ...row, caption: event.target.value } : row)))}
                      />
                      <div className="cst-shot-tools">
                        <button type="button" onClick={() => set("gallery", moveRow(draft.gallery, index, -1))} disabled={index === 0} aria-label="আগে নিন">↑</button>
                        <button type="button" onClick={() => set("gallery", moveRow(draft.gallery, index, 1))} disabled={index === draft.gallery.length - 1} aria-label="পরে নিন">↓</button>
                        <button type="button" onClick={() => set("gallery", draft.gallery.filter((_, i) => i !== index))} aria-label="সরান">✕</button>
                      </div>
                    </figure>
                  ))}
                </div>
              ) : (
                <StudioEmpty
                  action={
                    <button type="button" className="cst-btn cst-btn-solid" disabled={uploading} onClick={() => galleryInput.current?.click()}>
                      <ImageIcon size={15} aria-hidden /> ছবি আপলোড করুন
                    </button>
                  }
                >
                  এখনো কোনো ছবি নেই — অনুষ্ঠানের ছবি দিলে সাইট প্রাণ পায়।
                </StudioEmpty>
              )}
            </StudioCard>
          ) : null}

          {tab === "contact" ? (
            <StudioCard title="যোগাযোগ ও সভা" hint="সাইটের ‘যোগাযোগ’ কার্ডগুলো এখান থেকে তৈরি হয়।">
              <StudioGrid columns={3}>
                <TextField label="ফোন" value={draft.contact?.phone || ""} onChange={(value) => set("contact", { ...draft.contact, phone: value })} type="tel" />
                <TextField label="ইমেইল" value={draft.contact?.email || ""} onChange={(value) => set("contact", { ...draft.contact, email: value })} type="email" />
                <TextField label="ঠিকানা" value={draft.contact?.address || ""} onChange={(value) => set("contact", { ...draft.contact, address: value })} />
              </StudioGrid>
              <StudioGrid columns={3}>
                <TextField label="সভার দিন" value={draft.meeting?.day || ""} onChange={(value) => set("meeting", { ...draft.meeting, day: value })} placeholder="প্রতি বৃহস্পতিবার" />
                <TextField label="সভার সময়" value={draft.meeting?.time || ""} onChange={(value) => set("meeting", { ...draft.meeting, time: value })} placeholder="বিকেল ৩:০০ — ৪:৩০" />
                <TextField label="সভার স্থান" value={draft.meeting?.place || ""} onChange={(value) => set("meeting", { ...draft.meeting, place: value })} placeholder="স্কুল মিলনায়তন" />
              </StudioGrid>
              <StudioNote>
                <ShieldCheck size={13} aria-hidden />{" "}
                {site.customized ? "এই ক্লাবের তথ্য আগে সংরক্ষণ করা হয়েছিল — এখন যা সেভ করবেন সেটিই সাইটে যাবে।" : "প্রথম সংরক্ষণে ফাইলের ডিফল্ট তথ্যের উপরে আপনার দেওয়া তথ্য বসবে।"}
              </StudioNote>
            </StudioCard>
          ) : null}
        </main>

        {showPreview ? (
          <>
          {frame === "desktop" ? (
            <section className="cst-card cst-preview-card cst-preview-wide">
              <header className="cst-card-head">
                <div>
                  <h2><Sparkles size={15} aria-hidden /> লাইভ প্রিভিউ</h2>
                  <p>ডেস্কটপ প্রস্থে ঠিক যে সাইটটি প্রকাশ হবে।</p>
                </div>
                <div className="cst-card-tools">
                  {frameToggle}
                  <a className="cst-btn cst-btn-quiet" href={siteUrl} target="_blank" rel="noreferrer noopener">
                    <ArrowUpRight size={13} aria-hidden /> খুলুন
                  </a>
                </div>
              </header>
              {previewFrame("desktop")}
            </section>
          ) : null}
          <aside className="cst-aside">
            {frame === "phone" ? (
            <section className="cst-card cst-preview-card">
              <header className="cst-card-head">
                <div>
                  <h2><Sparkles size={15} aria-hidden /> লাইভ প্রিভিউ</h2>
                  <p>আপনি যা লিখছেন, ঠিক সেটাই।</p>
                </div>
                <div className="cst-card-tools">
                  {frameToggle}
                  <a className="cst-btn cst-btn-quiet" href={siteUrl} target="_blank" rel="noreferrer noopener">
                    <ArrowUpRight size={13} aria-hidden /> খুলুন
                  </a>
                </div>
              </header>
              {previewFrame("phone")}
            </section>
            ) : null}

            <section className="cst-card">
              <header className="cst-card-head">
                <div>
                  <h2>চেকলিস্ট</h2>
                  <p>{bn(doneCount)} / {bn(checks.length)} ধাপ তৈরি</p>
                </div>
              </header>
              <ul className="cst-checklist">
                {checks.map((item) => (
                  <li key={item.label}>
                    <button type="button" onClick={() => setTab(item.id)}>
                      <span className={`cst-check${item.done ? " is-done" : ""}`} aria-hidden>{item.done ? <Check size={12} /> : "○"}</span>
                      <span className="cst-check-copy">
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="cst-card">
              <header className="cst-card-head">
                <div>
                  <h2>সোশ্যাল ও যোগাযোগ</h2>
                  <p>সাইটের হিরো ও ফুটারে দেখানো হয়।</p>
                </div>
              </header>
              <div className="cst-social">
                {draft.facebook ? <a className="cst-btn cst-btn-soft" href={draft.facebook} target="_blank" rel="noreferrer noopener"><Facebook size={14} aria-hidden /> ফেসবুক</a> : null}
                {draft.youtube ? <a className="cst-btn cst-btn-soft" href={draft.youtube} target="_blank" rel="noreferrer noopener"><Youtube size={14} aria-hidden /> ইউটিউব</a> : null}
                {draft.contact?.phone ? <a className="cst-btn cst-btn-soft" href={`tel:${draft.contact.phone}`}><Phone size={14} aria-hidden /> {draft.contact.phone}</a> : null}
                <Link className="cst-btn cst-btn-soft" href={`/clubs/${slug}`}><Globe size={14} aria-hidden /> ক্লাব পাতা</Link>
              </div>
            </section>
          </aside>
          </>
        ) : null}
      </div>
    </div>
  );
}
