# Fix: dynamic content, media sync, admin button layout and public overlaps

Four reported problem areas, all reproduced first and then fixed at the source.
Every change ships with a regression check in `npm run smoke`
(`scripts/content-sync-smoke.tsx`).

---

## 1 · Dynamic content & titles

### 1.1 The symptom

An edit saved in the studio (fair title, event name, site name) did not show up
on the public page, or showed up only after a hard reload / redeploy.

### 1.2 Root causes

| # | Cause | Where |
| - | ----- | ----- |
| a | Only `fairs`, `settings` and `themes` revalidated anything. Every other resource (slides, notices, club events, news…) was written and then served from the router's cached render. | `app/api/admin/[resource]/[id]/route.ts` |
| b | Creating an entry (`POST`) and reordering (`POST /api/admin/reorder`) revalidated nothing at all. | `app/api/admin/[resource]/route.ts`, `app/api/admin/reorder/route.ts` |
| c | A page with `generateMetadata` read the database **twice** per request — once for the `<title>`/Open Graph tags, once for the body — so the heading and the markup could describe different versions of the same row. | `app/fair/[slug]/page.tsx`, `app/news/[slug]/page.tsx`, `app/layout.tsx` |
| d | The homepage fair banner resolved its fair by reading one setting and falling back to `content.fairs[0]`, while `/fair` used `activeFair()`. The two could disagree. | `components/public/FairMega.tsx` |
| e | Dynamic pages answered `Cache-Control: no-cache, must-revalidate`, which still lets a shared cache hold the HTML and revalidate in the background. | `next.config.mjs`, `middleware.ts` |
| f | `clubs/<slug>/club.json` is a **seed file**, but `loadClubSite` used it whenever no admin override existed — so a club whose events were edited in the studio kept showing the checked-in event names next to the real ones. | `lib/club-sites.ts` |

### 1.3 Fixes

**a + b — one revalidation helper, called on every write.** New `lib/revalidate.ts`:

```ts
export function revalidatePublicSite(paths: string[] = []) {
  revalidatePath("/", "layout");   // root layout + every nested public route
  for (const path of paths) revalidatePath(path);
}
```

`publicPathsFor(resource, row)` derives the concrete routes a row touches
(`/clubs/<slug>`, `/news/<slug>`, `/fair/<slug>`, `/clubs/<club>/posts/<slug>` …).
It is now called from:

* `POST   /api/admin/[resource]`      — create
* `PATCH  /api/admin/[resource]/[id]` — update (was fairs/settings/themes only)
* `DELETE /api/admin/[resource]/[id]` — delete (the row is read *before* the
  delete so its slug is still available)
* `POST   /api/admin/reorder`
* `POST   /api/clubs/[slug]/site`     — the club studio's save, including reset

**c — one read per request.** New `lib/content.ts`:

```ts
export const loadContent = cache(async () => getPublicContent());
```

`react`'s `cache()` memoises per request, so `generateMetadata`, the root layout
and the page body share a single snapshot. Wired into `app/layout.tsx`,
`app/fair/[slug]/page.tsx` and `app/news/[slug]/page.tsx`.

**d — one resolver.** `FairMega` now calls `activeFair(content, fair_mode_slug)`,
the same helper `/fair` and `/fair/<slug>` use.

**e — `no-store` on dynamic routes.** `next.config.mjs` gained a `headers()`
block and `middleware.ts` stamps the same header as it forwards, for
`/`, `/clubs/*`, `/news/*`, `/fair/*`, `/club-site/*`, `/entry/*`, `/pass/*`,
`/me`, `sitemap.xml` and `robots.txt`. Verified on a production build:

```
$ curl -sI https://host/ | grep -i cache
cache-control: no-store, must-revalidate
cdn-cache-control: no-store

$ curl -sI https://host/mark.svg | grep -i cache
Cache-Control: public, max-age=0     ← static assets stay cacheable
```

All public pages also declare `export const revalidate = 0;` next to their
existing `export const dynamic = "force-dynamic";`.

**f — database first, `club.json` as a seed only.** `loadClubSite` now resolves
every list through `pickList(override, fromDatabase, seed)`:

```
admin override  →  database rows  →  club.json seed
   (wins)          (displaces)       (first run only)
```

So a club with real rows in `club_events` / `club_gallery` no longer renders the
checked-in sample events, and a club admin can delete them from the studio they
have access to. Gallery URLs are de-duplicated instead of concatenated.

### 1.4 Slug / dynamic-route mapping

Renaming a slug used to leave dangling references:

* **Fair renamed** → `fair_categories`, `fair_schedule` and `fair_collections`
  still pointed at the old slug, and `fair_mode_slug` (which `/fair` and the
  homepage read) went stale, silently moving the site to a different fair.
  `renameFairSlug()` now re-points the child rows **and** calls
  `syncFairModeSlug()`.
* **Club renamed** → the club's saved micro-site edits live under
  `club_site:<slug>` in `settings`; they were orphaned, so the club reverted to
  its `club.json` defaults. `renameClubSiteOverride()` moves the key.
* **Club deleted** → the `club_site:<slug>` override is deleted with the cascade,
  so re-creating the slug later starts clean.
* **Near-miss slugs** → `/fair/<slug>` now compares case-insensitively and
  308-redirects `Science-Fair-2026` → `science-fair-2026` instead of 404ing.

---

## 2 · Media / image asset sync

### 2.1 Root causes

| # | Cause | Result |
| - | ----- | ------ |
| a | `SmartImage` kept `failed = true` **forever**, keyed to nothing. Replace a broken image with a working one and it stayed blank until the server restarted. | `components/public/Media.tsx` |
| b | `SmartBackdrop` paints a CSS `background-image`, which cannot fire `onError`. A deleted Cloudinary asset left a silent empty box. | `components/public/Media.tsx` |
| c | “Remove” in the admin image field cleared the URL but left the running upload, the object-URL preview and the file input's value in place. | `components/admin/ImageField.tsx` |
| d | A failed upload left the picked file's blob preview on screen, so the form showed an image that was never saved. | `components/admin/ImageField.tsx`, `components/club/studio/fields.tsx` |
| e | Dozens of bare `<img>` tags (club logos, leader photos, gallery tiles, admin row thumbs, console headers) had no error handling at all. | across `components/` |

### 2.2 Fixes

**a — failure is tracked per URL.**

```tsx
const url = useMemo(() => optimizedImage(src, transform), [src, transform]);
const [failed, setFailed] = useState(false);
useEffect(() => { setFailed(false); }, [url]);   // a new asset re-arms onError
…
<img key={url} … onError={onError} />            // key forces a re-request
```

**b — backdrops are probed.** `SmartBackdrop` loads the URL through a detached
`new Image()`; `onload` keeps the background, `onerror` swaps in `MediaFallback`.
The background is applied optimistically, so a working image does not flash.

**c — Remove clears everything.**

```tsx
const clearValue = useCallback(() => {
  controllerRef.current?.abort();          // stop an upload still in flight
  controllerRef.current = null;
  if (inputRef.current) inputRef.current.value = "";   // drop the picked file
  onChange("");                            // clear the saved URL
  setLocalPreview("");                     // drop the blob preview
  setPreviewBroken(false);
  setStatus({ kind: "idle" });
}, [onChange]);
```

The club studio's `ImagePicker` does the same.

**d — a failed upload drops the blob preview**, falling back to whatever URL is
actually saved rather than showing a file that never reached Cloudinary.

**e — every bare `<img>` now has a fallback.** Club-site logos, leader photos,
event photos, gallery tiles and post covers use `SmartImage`; admin row thumbs,
the recent-activity list, the settings logo preview, the console brand mark and
the studio list use the new `ThumbImage`, which swaps in the resource icon:

```tsx
<ThumbImage src={thumb} alt="" fallback={<Icon size={16} />} />
```

The stylesheets that sized those images (`.clx-brand-mark img`, `.club-badge img`,
`.hub-pill img`, `.showcase-tab img`, `.gallery-tile img`, …) now target
`.smart-image` and `.media-fallback` too, so the placeholder takes exactly the
frame the image would have filled instead of blowing it up to its 180px minimum.

---

## 3 · Admin controls & button layout

### 3.1 Root causes

**Buttons on top of each other.** The action group lived in a **76px** grid
track:

```css
.content-table-head, .content-row {
  grid-template-columns: minmax(260px, 1.6fr) minmax(120px, .8fr) 96px 128px 76px;
}
.row-actions button { width: 32px; height: 32px; }   /* flex-shrink: 1 */
```

Six 32px buttons need `6 × 32 + 5 × 4 = 212px`. With `flex-shrink: 1` (the
default) the browser squeezed every button to ~12px and the glyphs collided.
The same pattern repeated in `.cst-row-tools`, `.cst-shot-tools` and
`.cst-lines-tools`.

**Controls that should not have been there.** `settings` rows are SuperAdmin-only
on the server (the API answers 403), but the studio offered Edit / Duplicate /
Delete / New to every admin — the click always failed afterwards.

### 3.2 Fixes

```css
/* the track is sized for the whole group */
.content-table-head, .content-row {
  grid-template-columns: minmax(240px, 1.6fr) minmax(110px, .8fr) 112px 118px 208px;
  gap: 14px; min-width: 900px;
}

/* and nothing inside it may shrink — this is the actual fix */
.row-actions {
  display: flex; flex-wrap: nowrap; align-items: center;
  justify-content: flex-end; gap: 4px; flex: 0 0 auto; min-width: 0;
}
.row-actions > button, .row-actions > a {
  flex: 0 0 auto;                 /* was: default shrink → 12px, overlapping */
  width: 32px; height: 32px;
}
```

* The preview link (an `<a>`, previously unstyled and unlike its sibling
  buttons) is now styled as a member of the group.
* `.admin-topbar`, `.admin-top-actions`, `.cst-row-head`, `.cst-shot-tools` and
  `.cst-row-tools` wrap or pin their tools instead of crushing the title; the
  breadcrumb gets `flex: 1 1 220px` so it truncates rather than vanishing.
* Every `.cst-*-tools button` carries `flex: 0 0 auto`.

**Role gating.** `ContentListTable` takes `canWrite` / `canDelete`;
`AdminStudio` derives them from the session:

```tsx
const restricted = active === "settings";
const canWrite = !restricted || session.isSuperAdmin;
```

With `canWrite: false` the row renders only the harmless “View on the site”
link and the heading shows *“Read-only — only a SuperAdmin can change the
site's settings.”* instead of a New button that would 403.

---

## 4 · Layout overlaps & responsiveness

### 4.1 The hero badge sat on the carousel controls

`.hero-visual` is `position: relative` and contained **three** children: the
stage, the badge and the controls. The badge is `position: absolute; bottom: 18px`
— but its containing block was the whole column, so "18px from the bottom" meant
18px from the bottom of the *controls row*, i.e. on top of the prev/next/pause
buttons and the progress pills.

**Fix — give the stage its own positioning context.** `HeroCarousel` wraps the
stage and the badge in a new `.hero-frame`; the controls stay outside it:

```jsx
<div className="hero-visual">
  <div className="hero-frame">        ← position: relative
    <div className="hero-stage">…</div>
    <div className="hero-badge">…</div>
  </div>
  <div className="hero-controls">…</div>   ← own flow row, z-index: 1
</div>
```

```css
.hero-frame { position: relative; z-index: 0; min-width: 0; }
.hero-controls { position: relative; z-index: 1; … min-width: 0; }
```

The badge itself stops stretching across the photograph:

```css
.hero-badge {
  left: 18px; bottom: 18px; right: auto;
  max-width: min(260px, calc(100% - 36px));   /* was: left+right: 18px */
  pointer-events: none;                        /* never eats a control's tap */
}
.hero-badge strong, .hero-badge small { overflow-wrap: anywhere; }
```

The 768px and 560px overrides were updated to match (`right: auto`,
`max-width: min(…, calc(100% - Npx))`).

### 4.2 Cards, badges and pills that overflowed their frame

```css
.stats-grid > div                { min-width: 0; }
.stats-grid strong               { line-height: 1.12; overflow-wrap: anywhere; }
.stats-grid span                 { min-width: 0; overflow-wrap: anywhere; }
.fair-mega-inner > *             { position: relative; z-index: 1; min-width: 0; }
.fair-mega-title                 { overflow-wrap: anywhere; }
.fair-mega-kicker,
.fair-mega-facts span            { max-width: 100%; min-width: 0; }
.fair-mega-actions               { flex-wrap: wrap; align-items: center; min-width: 0; }
.mobile-bottom-label             { white-space: nowrap; text-overflow: ellipsis; }
.topline-inner                   { flex-wrap: wrap; gap: 6px var(--sp-4); }
```

`.fair-mega-inner > *` with `z-index: 1` keeps the heading, facts and buttons
above the section's decorative `::before` radial; the dock labels now clip to a
single line instead of wrapping into their icon.

---

## Verification

```
npm run typecheck     # tsc --noEmit, clean
npm run smoke         # 5 suites, including the new content-sync suite
npm run build         # production build succeeds
```

`scripts/content-sync-smoke.tsx` asserts, without a browser:

* the fair banner and hero render the database value, not a literal;
* every write route calls `revalidatePublicSite`, and every public page declares
  `force-dynamic` + `revalidate = 0`;
* `next.config.mjs` and `middleware.ts` set `no-store`;
* `loadClubSite` prefers the database over `club.json`;
* `SmartImage` / `SmartBackdrop` / `ThumbImage` fall back, and the failure flag
  re-arms when the URL changes;
* `Remove` aborts the upload, clears the input and clears the URL;
* `canWrite: false` hides Edit / Duplicate / Delete but keeps the preview link;
* the action buttons are `flex: 0 0 auto` inside a track wide enough for them;
* the hero badge lives inside `.hero-frame` while `.hero-controls` sits outside
  it, and the badge is width-capped.
