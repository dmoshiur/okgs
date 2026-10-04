"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Facebook,
  Globe,
  Image as ImageIcon,
  LogIn,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { Panel, postJson, useApi } from "@/components/sf/console/ui";
import { uploadToCloudinary } from "@/lib/upload-client";
import type { ClubGalleryItem, ClubLeader, ClubOverride } from "@/lib/club-sites";

type EventRow = { title: string; date?: string; description?: string; image_url?: string };

interface SitePayload {
  ok: boolean;
  canEdit: boolean;
  role: string;
  error?: string;
  site: {
    slug: string;
    name: string;
    name_en: string;
    short_code: string;
    tagline: string;
    motto: string;
    about: string;
    notice: string;
    logo_url: string;
    cover_image_url: string;
    accent: string;
    accent_2: string;
    website: string;
    facebook: string;
    youtube: string;
    mission: string[];
    objectives: string[];
    gallery: ClubGalleryItem[];
    leaders: ClubLeader[];
    events: EventRow[];
    contact: { phone?: string; email?: string; address?: string };
    meeting: { day?: string; time?: string; place?: string };
    customized: boolean;
  };
}

const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

function Field({
  label,
  value,
  onChange,
  textarea,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="cs-field">
      <span>{label}</span>
      {textarea ? (
        <textarea value={value} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function ImagePicker({
  slug,
  label,
  value,
  onChange,
}: {
  slug: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const result = await uploadToCloudinary({
        file,
        prefix: slug,
        label: `${slug}-${label}`,
        onProgress: setPercent,
      });
      onChange(result.url);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "আপলোড করা যায়নি।");
    } finally {
      setBusy(false);
      setPercent(0);
    }
  };

  return (
    <div className="cs-picker">
      <span className="cs-picker-label">{label}</span>
      <div className="cs-picker-row">
        <span className="cs-picker-preview">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} />
          ) : (
            <ImageIcon size={20} />
          )}
        </span>
        <div className="cs-picker-actions">
          <button type="button" className="v2-btn v2-btn-sm" disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={14} /> {busy ? `আপলোড ${percent}%` : value ? "বদলান" : "ছবি আপলোড"}
          </button>
          {value ? (
            <button type="button" className="panel-link" onClick={() => onChange("")}>
              সরান
            </button>
          ) : null}
          <input
            ref={input}
            hidden
            type="file"
            accept="image/*"
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </div>
      {error ? <p className="portal-error">{error}</p> : null}
    </div>
  );
}

const tabs = [
  { id: "identity", label: "পরিচিতি" },
  { id: "brand", label: "লোগো ও রঙ" },
  { id: "mission", label: "লক্ষ্য ও উদ্দেশ্য" },
  { id: "leaders", label: "নেতৃত্ব" },
  { id: "events", label: "আয়োজন" },
  { id: "gallery", label: "ছবিঘর" },
  { id: "contact", label: "যোগাযোগ" },
] as const;

export function ClubSiteAdmin({ slug }: { slug: string }) {
  const { data, loading, error, reload } = useApi<SitePayload>(`/api/clubs/${slug}/site`);
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("identity");
  const [draft, setDraft] = useState<ClubOverride | null>(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [authNote, setAuthNote] = useState("");

  const site = data?.site;
  const canEdit = Boolean(data?.canEdit);

  useEffect(() => {
    if (!site) return;
    setDraft({
      name: site.name,
      name_en: site.name_en,
      tagline: site.tagline,
      motto: site.motto,
      about: site.about,
      notice: site.notice,
      logo_url: site.logo_url,
      cover_image_url: site.cover_image_url,
      accent: site.accent,
      accent_2: site.accent_2,
      website: site.website,
      facebook: site.facebook,
      youtube: site.youtube,
      mission: site.mission,
      objectives: site.objectives,
      gallery: site.gallery,
      leaders: site.leaders,
      events: site.events,
      contact: site.contact,
      meeting: site.meeting,
    });
  }, [site]);

  const set = useCallback(<K extends keyof ClubOverride>(key: K, value: ClubOverride[K]) => {
    setDraft((current) => ({ ...(current || {}), [key]: value }));
  }, []);

  const login = async () => {
    setAuthNote("");
    setBusy(true);
    try {
      await postJson(`/api/clubs/${slug}/login`, { identifier, password });
      setPassword("");
      await reload();
      setAuthNote("লগইন সফল হয়েছে।");
    } catch (issue) {
      setAuthNote(issue instanceof Error ? issue.message : "লগইন করা যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch(`/api/clubs/${slug}/login`, { method: "DELETE" }).catch(() => null);
    await reload();
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      await postJson(`/api/clubs/${slug}/site`, { action: "save", ...draft });
      setMessage("সংরক্ষণ হয়েছে — সাইটে সাথে সাথে দেখা যাবে।");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "সংরক্ষণ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  const uploadGallery = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setProblem("");
    try {
      const added: ClubGalleryItem[] = [];
      for (const file of Array.from(files).slice(0, 12)) {
        const result = await uploadToCloudinary({ file, prefix: slug, label: `${slug}-gallery` });
        added.push({ url: result.url, caption: "" });
      }
      set("gallery", [...(draft?.gallery || []), ...added]);
      setMessage(`${added.length}টি ছবি যোগ হয়েছে — এখন সংরক্ষণ চাপুন।`);
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "আপলোড করা যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  const leaderRows = useMemo(() => draft?.leaders || [], [draft]);

  if (loading && !data) {
    return (
      <div className="v2-wrap" style={{ padding: "64px 0" }}>
        <p className="v2-muted">লোড হচ্ছে…</p>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="v2-wrap" style={{ padding: "64px 0" }}>
        <h1>ক্লাব সাইট পাওয়া যায়নি</h1>
        <p className="v2-muted">{error || "ঠিকানাটি পরীক্ষা করুন।"}</p>
        <Link className="v2-btn" href="/clubs">
          সব ক্লাব দেখুন
        </Link>
      </div>
    );
  }

  if (!canEdit || !draft) {
    return (
      <div className="v2-wrap club-admin-gate">
        <div className="portfolio-note" style={{ maxWidth: 460, margin: "0 auto" }}>
          <span className="panel-eyebrow">ক্লাব অ্যাডমিন</span>
          <h1 style={{ margin: "4px 0 6px", fontSize: 26 }}>{site.name}</h1>
          <p className="v2-muted" style={{ marginTop: 0 }}>
            এই ক্লাবের ছবি, নেতৃত্ব ও তথ্য বদলাতে লগইন করুন।
          </p>
          <Field label="ইমেইল বা আইডি" value={identifier} onChange={setIdentifier} placeholder={`${slug}@okgs.info`} />
          <label className="cs-field">
            <span>পাসওয়ার্ড</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void login(); }} />
          </label>
          <button type="button" className="v2-btn" disabled={busy} onClick={() => void login()} style={{ marginTop: 10 }}>
            <LogIn size={16} /> {busy ? "অপেক্ষা করুন…" : "লগইন"}
          </button>
          {authNote ? <p className={authNote.includes("সফল") ? "panel-ok" : "portal-error"}>{authNote}</p> : null}
          <p className="v2-muted" style={{ fontSize: 12, marginTop: 14 }}>
            ডিফল্ট: <code>{slug}@okgs.info</code> · পাসওয়ার্ড <code>okgs1234</code> (অ্যাডমিন সেটিংস থেকে বদলানো যায়)
          </p>
          <Link className="panel-link" href={`/clubs/${slug}/site`} style={{ marginTop: 10 }}>
            <ArrowUpRight size={14} /> ক্লাব সাইট দেখুন
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="v2-wrap club-admin">
      <header className="club-admin-head">
        <div>
          <span className="panel-eyebrow">ক্লাব অ্যাডমিন</span>
          <h1>{site.name}</h1>
          <p className="v2-muted">
            {site.name_en} · <Globe size={12} /> {site.slug}.okgs.info
          </p>
        </div>
        <div className="club-admin-head-actions">
          <Link className="v2-btn v2-btn-ghost v2-btn-sm" href={`/clubs/${slug}/site`} target="_blank">
            <ArrowUpRight size={15} /> সাইট দেখুন
          </Link>
          <button type="button" className="v2-btn v2-btn-sm" disabled={busy} onClick={() => void save()}>
            <Save size={15} /> {busy ? "সংরক্ষণ…" : "সংরক্ষণ"}
          </button>
          <button type="button" className="panel-link" onClick={() => void logout()}>
            <LogOut size={14} /> লগআউট
          </button>
        </div>
      </header>

      {message ? <p className="panel-ok">{message}</p> : null}
      {problem ? <p className="portal-error">{problem}</p> : null}

      <nav className="club-admin-tabs">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`showcase-tab ${tab === item.id ? "is-on" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "identity" ? (
        <Panel title="ক্লাবের পরিচয়">
          <div className="cs-form-grid">
            <Field label="নাম (বাংলা)" value={draft.name || ""} onChange={(value) => set("name", value)} />
            <Field label="নাম (ইংরেজি)" value={draft.name_en || ""} onChange={(value) => set("name_en", value)} />
            <Field label="ট্যাগলাইন" value={draft.tagline || ""} onChange={(value) => set("tagline", value)} />
            <Field label="মটো" value={draft.motto || ""} onChange={(value) => set("motto", value)} />
          </div>
          <Field label="ক্লাব সম্পর্কে" textarea rows={4} value={draft.about || ""} onChange={(value) => set("about", value)} />
          <Field label="নোটিশ (সাইটের উপরে দেখাবে)" value={draft.notice || ""} onChange={(value) => set("notice", value)} />
          <div className="cs-form-grid">
            <Field label="ওয়েবসাইট / সাবডোমেইন" value={draft.website || ""} onChange={(value) => set("website", value)} placeholder={`https://${slug}.okgs.info`} />
            <Field label="ফেসবুক পেজ" value={draft.facebook || ""} onChange={(value) => set("facebook", value)} />
            <Field label="ইউটিউব (ঐচ্ছিক)" value={draft.youtube || ""} onChange={(value) => set("youtube", value)} />
          </div>
        </Panel>
      ) : null}

      {tab === "brand" ? (
        <Panel title="লোগো, কভার ও রঙ">
          <div className="cs-form-grid cs-grid-two">
            <ImagePicker slug={slug} label="ক্লাব লোগো" value={draft.logo_url || ""} onChange={(value) => set("logo_url", value)} />
            <ImagePicker slug={slug} label="কভার ছবি" value={draft.cover_image_url || ""} onChange={(value) => set("cover_image_url", value)} />
          </div>
          <div className="cs-form-grid">
            <label className="cs-field">
              <span>প্রধান রঙ</span>
              <span className="cs-color">
                <input type="color" value={draft.accent || "#0f766e"} onChange={(event) => set("accent", event.target.value)} />
                <input value={draft.accent || ""} onChange={(event) => set("accent", event.target.value)} />
              </span>
            </label>
            <label className="cs-field">
              <span>দ্বিতীয় রঙ</span>
              <span className="cs-color">
                <input type="color" value={draft.accent_2 || "#eab308"} onChange={(event) => set("accent_2", event.target.value)} />
                <input value={draft.accent_2 || ""} onChange={(event) => set("accent_2", event.target.value)} />
              </span>
            </label>
          </div>
          <p className="panel-copy">
            ছবি Cloudinary-তে যায়, লিংক Turso-তে ক্লাব-ভিত্তিক সেটিংস হিসেবে জমা থাকে — সাবডোমেইন সাইটেও একই ছবি দেখা যাবে।
          </p>
        </Panel>
      ) : null}

      {tab === "mission" ? (
        <Panel title="লক্ষ্য ও উদ্দেশ্য">
          <Field
            label="লক্ষ্য (প্রতি লাইনে একটি)"
            textarea
            rows={4}
            value={(draft.mission || []).join("\n")}
            onChange={(value) => set("mission", lines(value))}
          />
          <Field
            label="ক্লাবের উদ্দেশ্য (প্রতি লাইনে একটি)"
            textarea
            rows={9}
            value={(draft.objectives || []).join("\n")}
            onChange={(value) => set("objectives", lines(value))}
          />
        </Panel>
      ) : null}

      {tab === "leaders" ? (
        <Panel
          title="সভাপতি, সম্পাদক ও কমিটি"
          action={
            <button
              type="button"
              className="v2-btn v2-btn-sm"
              onClick={() =>
                set("leaders", [
                  ...leaderRows,
                  { name: "", role: "সভাপতি", class_level: "", section: "", phone: "", email: "", facebook: "", photo_url: "", bio: "" },
                ])
              }
            >
              <Plus size={15} /> নতুন জন
            </button>
          }
        >
          <div className="cs-people">
            {leaderRows.map((leader, index) => (
              <article className="cs-person" key={`${index}-${leader.name}`}>
                <ImagePicker
                  slug={slug}
                  label="ছবি"
                  value={leader.photo_url || ""}
                  onChange={(value) =>
                    set(
                      "leaders",
                      leaderRows.map((row, rowIndex) => (rowIndex === index ? { ...row, photo_url: value } : row)),
                    )
                  }
                />
                <div className="cs-form-grid">
                  <Field
                    label="নাম"
                    value={leader.name}
                    onChange={(value) => set("leaders", leaderRows.map((row, i) => (i === index ? { ...row, name: value } : row)))}
                  />
                  <Field
                    label="পদ"
                    value={leader.role}
                    onChange={(value) => set("leaders", leaderRows.map((row, i) => (i === index ? { ...row, role: value } : row)))}
                  />
                  <Field
                    label="শ্রেণি"
                    value={leader.class_level || ""}
                    onChange={(value) => set("leaders", leaderRows.map((row, i) => (i === index ? { ...row, class_level: value } : row)))}
                  />
                  <Field
                    label="শাখা"
                    value={leader.section || ""}
                    onChange={(value) => set("leaders", leaderRows.map((row, i) => (i === index ? { ...row, section: value } : row)))}
                  />
                  <Field
                    label="মোবাইল"
                    value={leader.phone || ""}
                    onChange={(value) => set("leaders", leaderRows.map((row, i) => (i === index ? { ...row, phone: value } : row)))}
                  />
                  <Field
                    label="ইমেইল"
                    value={leader.email || ""}
                    onChange={(value) => set("leaders", leaderRows.map((row, i) => (i === index ? { ...row, email: value } : row)))}
                  />
                </div>
                <Field
                  label="পরিচিতি"
                  textarea
                  rows={2}
                  value={leader.bio || ""}
                  onChange={(value) => set("leaders", leaderRows.map((row, i) => (i === index ? { ...row, bio: value } : row)))}
                />
                <button
                  type="button"
                  className="panel-link"
                  onClick={() => set("leaders", leaderRows.filter((_, i) => i !== index))}
                >
                  <Trash2 size={14} /> এই জনকে সরান
                </button>
              </article>
            ))}
            {!leaderRows.length ? (
              <p className="v2-muted">
                <UserRound size={15} /> এখনো কেউ যোগ করা হয়নি — “নতুন জন” চেপে সভাপতি/সম্পাদকের নাম ও ছবি যোগ করুন।
              </p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {tab === "events" ? (
        <Panel
          title="আয়োজন ও অনুষ্ঠান"
          action={
            <button
              type="button"
              className="v2-btn v2-btn-sm"
              onClick={() => set("events", [...(draft.events || []), { title: "", date: "", description: "", image_url: "" }])}
            >
              <Plus size={15} /> নতুন আয়োজন
            </button>
          }
        >
          <div className="cs-people">
            {(draft.events || []).map((event, index) => (
              <article className="cs-person" key={`${index}-${event.title}`}>
                <div className="cs-form-grid">
                  <Field
                    label="শিরোনাম"
                    value={event.title}
                    onChange={(value) => set("events", (draft.events || []).map((row, i) => (i === index ? { ...row, title: value } : row)))}
                  />
                  <Field
                    label="তারিখ / সময়"
                    value={event.date || ""}
                    onChange={(value) => set("events", (draft.events || []).map((row, i) => (i === index ? { ...row, date: value } : row)))}
                  />
                </div>
                <Field
                  label="বিবরণ"
                  textarea
                  rows={2}
                  value={event.description || ""}
                  onChange={(value) => set("events", (draft.events || []).map((row, i) => (i === index ? { ...row, description: value } : row)))}
                />
                <ImagePicker
                  slug={slug}
                  label="আয়োজনের ছবি"
                  value={event.image_url || ""}
                  onChange={(value) => set("events", (draft.events || []).map((row, i) => (i === index ? { ...row, image_url: value } : row)))}
                />
                <button type="button" className="panel-link" onClick={() => set("events", (draft.events || []).filter((_, i) => i !== index))}>
                  <Trash2 size={14} /> সরান
                </button>
              </article>
            ))}
          </div>
        </Panel>
      ) : null}

      {tab === "gallery" ? (
        <Panel
          title="ছবিঘর"
          action={
            <label className="v2-btn v2-btn-sm" style={{ cursor: "pointer" }}>
              <Upload size={15} /> ছবি যোগ করুন
              <input hidden type="file" accept="image/*" multiple onChange={(event) => void uploadGallery(event.target.files)} />
            </label>
          }
        >
          <div className="cs-gallery-admin">
            {(draft.gallery || []).map((item, index) => (
              <figure key={`${item.url}-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.caption || ""} />
                <input
                  placeholder="ক্যাপশন"
                  value={item.caption || ""}
                  onChange={(event) =>
                    set("gallery", (draft.gallery || []).map((row, i) => (i === index ? { ...row, caption: event.target.value } : row)))
                  }
                />
                <button type="button" className="panel-link" onClick={() => set("gallery", (draft.gallery || []).filter((_, i) => i !== index))}>
                  <Trash2 size={13} /> সরান
                </button>
              </figure>
            ))}
            {!(draft.gallery || []).length ? <p className="v2-muted">এখনো কোনো ছবি নেই — উপরের বোতাম থেকে একসাথে কয়েকটি ছবি দিন।</p> : null}
          </div>
        </Panel>
      ) : null}

      {tab === "contact" ? (
        <Panel title="যোগাযোগ ও সভা">
          <div className="cs-form-grid">
            <Field label="ফোন" value={draft.contact?.phone || ""} onChange={(value) => set("contact", { ...draft.contact, phone: value })} />
            <Field label="ইমেইল" value={draft.contact?.email || ""} onChange={(value) => set("contact", { ...draft.contact, email: value })} />
          </div>
          <Field label="ঠিকানা" value={draft.contact?.address || ""} onChange={(value) => set("contact", { ...draft.contact, address: value })} />
          <div className="cs-form-grid">
            <Field label="সভার দিন" value={draft.meeting?.day || ""} onChange={(value) => set("meeting", { ...draft.meeting, day: value })} />
            <Field label="সভার সময়" value={draft.meeting?.time || ""} onChange={(value) => set("meeting", { ...draft.meeting, time: value })} />
            <Field label="সভার স্থান" value={draft.meeting?.place || ""} onChange={(value) => set("meeting", { ...draft.meeting, place: value })} />
          </div>
          <p className="panel-ok">
            <Check size={14} /> {site.customized ? "এই ক্লাবের তথ্য আগে সংরক্ষণ করা হয়েছে।" : "প্রথমবার সংরক্ষণ করলে ফাইলের ডিফল্টের উপরে আপনার তথ্য বসবে।"}
          </p>
          <div className="cs-foot-links" style={{ marginTop: 10 }}>
            <a href={draft.facebook || "#"} target="_blank" rel="noreferrer noopener">
              <Facebook size={14} /> পেজ পরীক্ষা করুন
            </a>
            <Link href={`/clubs/${slug}/site`}>
              <ShieldCheck size={14} /> পাবলিক সাইট
            </Link>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
