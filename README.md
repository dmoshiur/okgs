# OKGS — ক্লাব তথ্যকেন্দ্র

একটি বাংলা **ক্লাব তথ্যপোর্টাল** (স্কুলের হোমপেজসহ) — Next.js App Router + Turso/libSQL।
প্রতিটি ক্লাবের নিজস্ব পাতা, আয়োজন, গ্যালারি, সদস্য, অর্জন ও লেখা — সবকিছু অ্যাডমিন স্টুডিও থেকে সম্পাদনা হয়, এবং ছবি সরাসরি ব্রাউজার থেকে Cloudinary-তে আপলোড হয়।

## কী কী আছে

- **পাঁচটি ক্লাব, প্রতিটির নিজস্ব সাইট** — `clubs/alssm`, `clubs/aypg`, `clubs/alpcg`, `clubs/aygsm`, `clubs/artds`।
  প্রতিটি ফোল্ডারে `club.json` (পরিচয়, মিশন, উদ্দেশ্য, ইভেন্ট, যোগাযোগ) ও `theme.css` (নিজস্ব টোকেন)।
  ক্লাব সাইটের রঙ স্বয়ংক্রিয়ভাবে ক্লাবের **লোগো থেকে তোলা প্যালেট** দিয়ে সাজানো হয় —
  আপলোডের সাথে সাথে হিরো, নেভিগেশন, কার্ড, টাইমলাইন ও ফুটার নতুন গ্রেডিয়েন্টে সাজে।
  সাইট: `/clubs/<slug>/site`, অ্যাডমিন: `/clubs/<slug>/admin` (লগইন `<slug>@okgs.info`)।
  `middleware.ts` সাবডোমেইন রিরাইট করে — `alssm.okgs.info` → `/clubs/alssm/site`। বিস্তারিত: `clubs/README.md`।
- **ক্লাব ডিরেক্টরি** `/clubs` — অনুসন্ধান, ফিল্টার, সাজানো ও পরিসংখ্যান।
- **প্রতি ক্লাবের পাতা** `/clubs/[slug]` — পরিচিতি, আয়োজন, গ্যালারি, কমিটি ও সদস্য, অর্জন, লেখা-রিপোর্ট (`/clubs/[slug]/[section]`)।
- **ক্লাবের পোস্ট** `/clubs/[slug]/posts/[postSlug]`, স্কুল সংবাদ `/news` ও `/news/[slug]`।
- **হোমপেজ** — হিরো স্লাইড, নোটিশ, ক্লাব পালস, সুবিধা, শিক্ষক, গ্যালারি, পরিসংখ্যান — সবই ডেটাবেস থেকে আসে, তাই অ্যাডমিন থেকে বদলানো যায়।
- **কনটেন্ট স্টুডিও** `/admin` — সম্পূর্ণ **ইংরেজি** (লেবেল, বাটন, টেবিল, ব্যাজ, মডাল); ২১টি রিসোর্স, গ্রুপ করা ফর্ম, Published/Draft টগল, ক্রম পরিবর্তন (↑↓), ডুপ্লিকেট, ক্লাব-ভিত্তিক ফিল্টার, ডিলিটের আগে ক্যাসকেড সতর্কতা। সাইডবার ও কনটেন্ট আলাদা আলাদা স্ক্রল করে (টেবিল লম্বা হলেও সাইডবার নড়ে না)।
- **Cloudinary ডাইরেক্ট আপলোড** — ফাইল বেছে নিলেই সরাসরি আপলোড হয়; না-কনফিগার থাকলে পেস্ট-করা URL-এর ফর্ম দেখায়।
- SEO: metadata, Open Graph, JSON-LD (School / Event / Article), sitemap, robots।
  ক্লাব সাইট নিজের সাবডোমেইনে নিজের `<title>`, canonical ও Open Graph নিয়ে চলে।

## মেলা কনসোল ও শিক্ষার্থী পোর্টাল

- **`/sf/login`** — শিক্ষক/অ্যাডমিন/ক্লাব অ্যাডমিন লগইন (ইমেইল **বা** আইডি নম্বর + পাসওয়ার্ড)।
- **`/sf`** — ফেয়ার কনসোল (মোবাইল-ফার্স্ট, নিচে ট্যাব বার): ড্যাশবোর্ড (মোট ফান্ড, শ্রেণি+শাখা অনুযায়ী ছাত্রসংখ্যা, খরচ, বকেয়া), ফান্ড, পাওনা, খরচ, সংগ্রহ (প্রকল্প), QR পাস, **টিকার**, ইউজার, শ্রেণি, সেটিং।
  খরচ ট্যাবে **মাসিক সমন্বয় খাতা** — মাস বেছে সংগ্রহ বনাম খরচ বনাম বেতনের হিসাব, শিক্ষক/স্টাফ/অ্যাডমিন অ্যাকাউন্টে মাসিক বেতনের লেজার এন্ট্রি এবং এক ক্লিকে মাসের অবশিষ্ট ব্যালেন্স সমন্বয়; প্রতিটি এন্ট্রির স্বয়ংক্রিয় খরচ-মেমো (`/sf/print/memo/<id>`) তৈরি হয়।
- **`/sf/scan`** — ক্যামেরা দিয়ে QR স্ক্যান (jsQR) + ম্যানুয়াল টোকেন; লগইন করা শিক্ষক/অ্যাডমিনের ক্যামেরা দিয়েই যাচাই। প্রতিটি **পাস** ও প্রতিটি **প্রকল্প-লেবেল** স্ক্যান করে যাচাই করা যায় (প্রকল্পের QR: কনসোল → সংগ্রহ → QR আইকন → `/api/qr?entry=<id>`)।
- **`/me`** — শিক্ষার্থী/প্রাক্তন শিক্ষার্থীর ড্যাশবোর্ড: পাওনা পরিশোধ, ফান্ড জমা, QR পাস তৈরি, ইতিহাস।
- **`/pass/<token>`** — প্রিন্টযোগ্য QR কার্ড; **`/entry/<token>`** — প্রকল্প যাচাই পাতা।
- **এক ক্লিকে পুরো সাইট মেলা-সাইট** — সেটিং ট্যাব → “মেলা মোড চালু”; যেকোনো সময় ফিরিয়ে আনা যায়।

## অ্যাডমিন স্টুডিও, ভূমিকা ও অ্যাকাউন্ট

- **এক দরজা, ইমেইল + পাসওয়ার্ড** — `/admin/login` (ইংরেজি) ও `/sf/login` (বাংলা)। কোনো ভূমিকা বাছার ড্রপডাউন নেই; সার্ভার ডেটাবেজ থেকে ভূমিকা পড়ে নিজেই ঠিক ড্যাশবোর্ডে পাঠায়।

  | ডেটাবেজের ভূমিকা | পাঠানো হয় | Scope |
  | --- | --- | --- |
  | `superadmin` | `/admin` | সব কিছু + Site Settings, Maintenance Switch, Accounts |
  | `admin` | `/admin` | কনটেন্ট স্টুডিও (তবে সিস্টেম ট্যাব দেখে না, API-ও 403 দেয়) |
  | `teacher`, `club`, `staff` | `/sf` | ফেয়ার কনসোল / ক্লাব অ্যাডমিন |
  | `student`, `alumni`, `guest` | `/me` | শিক্ষার্থী ড্যাশবোর্ড |

- **ইমেইল অ্যাকাউন্ট সিঙ্ক** — `/admin/users` (SuperAdmin) থেকে ইমেইল দিয়ে অ্যাকাউন্ট তৈরি করলে অ্যাকাউন্টটি সরাসরি প্রাইমারি `users` টেবিলে বসে (ইউনিক ইমেইল, ডুপ্লিকেট 409)। অ্যাডমিনের দেওয়া ইমেইল পরে ইউজার নিজের প্রোফাইল থেকেও বদলাতে পারে, ইমেইল সবসময় ওই টেবিলেই থাকে।
- **পাসওয়ার্ড রিসেট** — `/admin/forgot-password` ও `/sf/forgot-password` → ইমেইলে ৬০ মিনিটের একবার-ব্যবহারযোগ্য লিংক (`password_resets` টেবিলে sha256 হ্যাশ, TTL, ৫টি রিকোয়েস্ট/১৫ মিনিট রেট লিমিট)। নতুন অ্যাকাউন্টের আমন্ত্রণও (`invite`, ৭ দিন) একই টেবিল ব্যবহার করে। `RESEND_API_KEY` + `MAIL_FROM` দিলে রিসেন্ড/ইমেইল যায়; না দিলে (ডেভ) লিংকটি রেসপন্সে/স্ক্রিনে দেখানো হয়।
- **Site Settings (SuperAdmin)** — `/admin/settings` → সাইটের নাম, ব্রাউজার টাইটেল (Browser Title), ট্যাগলাইন, লোগো, ফেভিকন, ঠিকানা, ফোন/ইমেইল, অফিস সময়, সোশ্যাল লিংক। সবই `settings` টেবিলে থাকে এবং সারাদেশে ছড়িয়ে পড়ে — `app/layout.tsx`-এর metadata (`<title>`, favicon, Open Graph) থেকে পাবলিক হেডার-ফুটার পর্যন্ত; কোনো কোড বদলাতে হয় না।
- **Emergency Maintenance Switch (SuperAdmin)** — `/admin/maintenance` → সুইচ ON করলেই দর্শকরা যেকোনো পাবলিক URL-এ (URL অপরিবর্তিত রেখে) `/maintenance` পাতা দেখে: “Site is currently under maintenance. Please check back later.”; `/admin`, `/api` ও অ্যাসেট খোলা থাকে, সাধারণ Admin পাবলিক সাইটেও নোটিশ দেখে, কেবল **SuperAdmin** দর্শকের মতো লক এড়িয়ে আসল সাইট দেখে। সুইচ OFF করলে তৎক্ষণাৎ আগের সাইট (ক্যাশ TTL ৫ সেকেন্ড)।
- **অফিস পাসওয়ার্ড সেট করতে** (মেইল সার্ভার না থাকলে):
  `npx tsx scripts/set-password.ts admin@okgs.info 'change-this-password'`

## ডেটা মডেল

`lib/content-config.ts` একমাত্র উৎস: প্রতিটি রিসোর্সের ফিল্ড, লেবেল, টাইপ, গ্রুপ, ভ্যালিডেশন ও ডিফল্ট। টেবিলের SQL এই সংজ্ঞা থেকেই তৈরি হয় (`lib/db.ts` → `createTableSql`), তাই নতুন ফিল্ড যোগ করলে ম্যানুয়াল মাইগ্রেশন লাগে না — পরের বুটে কলামটি যোগ হয়ে যায়।

| গ্রুপ | রিসোর্স |
| --- | --- |
| ক্লাব | `clubs`, `club_events`, `club_gallery`, `club_members`, `club_achievements`, `club_posts` |
| হোমপেজ ও প্রকাশনা | `slides`, `notices`, `banners`, `news`, `updates` |
| প্রতিষ্ঠান | `teachers`, `facilities`, `gallery`, `stats`, `settings` |
| মেলা ও থিম | `fairs`, `fair_categories`, `fair_schedule`, `fair_collections`, `themes` |

পোর্টালের টেবিলগুলো আলাদা (`lib/portal-db.ts`): `users`, `classes`, `funds`, `expenses`, `dues`, `settlements`, `passes`, `scans`, `tickers`, `smtp_settings`, `activity`, `password_resets` — ভূমিকাভিত্তিক অ্যাকাউন্ট, আমন্ত্রণ, ইমেইল সিঙ্ক, মাসিক বেতন/সমন্বয় লেজার ও রিসেট টোকেন এখানেই।

`settings` সারিতে `field_kind` আছে (`text` / `textarea` / `image` / `url`), তাই লোগো বা পাতার ছবিও সেটিংস থেকেই বদলানো যায়।

ক্লাব স্লাগ ASCII ছোট হাতের অক্ষরে রাখা হয় (বাংলা নাম থেকে স্বয়ংক্রিয়ভাবে লিপ্যন্তর হয়, যেমন “ম্যাথ এন্ড সাইন্স ক্লাব” → `math-end-sains-club`), কারণ সেটি ক্লাবের সাবডোমেইন ও URL-এ ব্যবহৃত হয়। স্লাগ বদলালে সেই ক্লাবের সব শিশু-সারি একই সাথে নতুন স্লাগে চলে যায়।

## লোকাল ডেভেলপমেন্ট

```bash
npm install
cp .env.example .env.local      # ঐচ্ছিক — কিছু না দিলেও চলবে
npm run dev
```

- `TURSO_*` না দিলে `./local.db` (libSQL ফাইল) ব্যবহার হয়; খালি থাকলেই সিড ডেটা বসে যায়।
- সবকিছু রিসেট করতে: সার্ভার বন্ধ করে `rm local.db` তারপর আবার `npm run dev`।
- ডেভ লগইন (SuperAdmin): `admin@okgs.info` / `change-this-password` (`ADMIN_EMAIL` / `ADMIN_PASSWORD` দিয়ে বদলান) — `/admin/login` থেকে।
- ক্লাব অ্যাডমিন: `alssm@okgs.info` … `artds@okgs.info` / `okgs1234` (`CLUB_ADMIN_PASSWORD` দিয়ে বদলান)।
- শিক্ষার্থী: আইডি নম্বর (যেমন `2026-0001`) বা ইমেইল + `okgs1234` — প্রথম লগইনে পাসওয়ার্ড বদলানো যায় (`/me`)।
- সাবডোমেইন ডেভে পরীক্ষা: `curl -H 'Host: alssm.localhost:3000' http://localhost:3000/`।

## Cloudinary সেটআপ (signed আপলোড — প্রস্তাবিত)

১. Cloudinary → ড্যাশবোর্ড থেকে **Cloud name**, **API key**, **API secret** নিন। সার্ভার নিজেই প্রতিটি আপলোড স্বাক্ষর করে (`/api/media/sign`), তাই ব্রাউজারে কোনো সিক্রেট যায় না।
২. `.env.local`-এ বসান: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`।
৩. API key/secret না দিলে অ্যাপ পুরোনো **unsigned preset** পথে ফিরে যায় (`CLOUDINARY_UPLOAD_PRESET`)।

### স্বাক্ষর কীভাবে তৈরি হয় (যেন `401 Invalid Signature` না আসে)

সার্ভার timestamp, folder, public_id ও tags — এই প্রতিটি প্যারামিটার নিয়ে বর্ণানুক্রমে (`folder=…&public_id=…&tags=…&timestamp=…`) সাজিয়ে শেষে API secret জোড়া দিয়ে SHA-1 হ্যাশ করে। ব্রাউজার ঠিক সেই প্যারামিটারগুলোই (`params`) ফাইল, `api_key` ও `signature`-এর সাথে POST করে — নিজে থেকে কোনো প্যারামিটার যোগ করে না।

`401 Invalid Signature` এলে দেখে নিন:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` একই প্রোডাক্ট এনভায়রনমেন্টের কি না (env বদলালে সার্ভার রিস্টার্ট করুন)।
- অ্যাকাউন্টটি কেবল **SHA-256** স্বাক্ষর নেয় কিনা — সেটি হলে `CLOUDINARY_SIGNATURE_ALGORITHM=sha256` বসান (ডিফল্ট `sha1`)।
- স্বাক্ষর ও প্যারামিটারের মিল যাচাই: `npm run smoke` (নেটওয়ার্ক ছাড়াই) বা `npx tsx scripts/cloudinary-signature-smoke.ts`।

<details><summary>পুরোনো unsigned প্রিসেট পদ্ধতি</summary>

১. Cloudinary → **Settings → Upload → Upload presets → Add** → **Signing Mode: `unsigned`** রাখুন। ব্রাউজার থেকে আপলোড হয়, তাই API secret যাওয়া সম্ভব না — signed preset দিলে আপলোড ব্যর্থ হবে।
২. প্রিসেটে চাইলে Folder, Resource type, Max size ঠিক করে রাখুন (প্রিসেটে ফোল্ডার দিলে ক্লায়েন্টের `folder` প্যারামিটার উপেক্ষিত থাকে)।
৩. `.env.local`-এ বসান:

```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset-name
CLOUDINARY_FOLDER=okgs/clubs          # ঐচ্ছিক, ডিফল্ট okgs
CLOUDINARY_MAX_BYTES=12582912         # ঐচ্ছিক, ক্লায়েন্ট-সাইড সাইজ গার্ড
```

৪. `/admin` → মিডিয়া প্যানেলে “সংযুক্ত” দেখালে চলবে। আপলোডের প্রতিটি ছবির `secure_url` সংশ্লিষ্ট `image_url` কলামে জমা হয়, তাই পুরোনো “URL পেস্ট” পদ্ধতিও আগের মতোই কাজ করে।

</details>

## নতুন কিছু যোগ করা

- **নতুন ক্লাব**: `/admin` → ক্লাব তালিকা → “নতুন ক্লাব”。শুধু নাম দিলেই স্লাগ তৈরি হয়ে যাবে।
- **নতুন ফিল্ড**: `lib/content-config.ts`-এর `resourceSchema[resource].fields`-এ `FieldDef` যোগ করুন (`type`: text / textarea / image / url / number / boolean / select / reference)। অ্যাডমিন ফর্ম ও সাইটের মার্কআপ দুই জায়গাতেই এটি ব্যবহার করুন।
- **নতুন রিসোর্স**: `resourceSchema` + `resourceMeta` + `studioGroups`, `lib/types.ts`-এর `ResourceName` / interface / `PublicContent` / `ContentRow`, এবং `lib/db.ts`-এর `resourceTables`, `orderBy`, `seeds` — সব জায়গায় যোগ করতে হবে (কলাম SQL স্বয়ংক্রিয়ভাবে তৈরি হবে)।

## ডিপ্লয়মেন্ট

প্রয়োজনীয় এনভায়রনমেন্ট ভ্যারিয়েবল: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`।

**ক্লাব সাবডোমেইন (আলাদা হোস্টিং):** হোস্ট (Vercel/Netlify/nginx) — যেখানেই হোক — সেখানে ওয়াইল্ডকার্ড ডোমেইন যোগ করুন:
`okgs.info` + `*.okgs.info`, দুটোই একই ডিপ্লয়মেন্টে পয়েন্ট করে। ব্যস — `alssm.okgs.info` থেকে `artds.okgs.info` পর্যন্ত
প্রতিটি ক্লাব নিজের সাইট হিসেবে খুলবে, প্রতিটির নিজের থিম, নিজের অ্যাডমিন (`<slug>.okgs.info/admin`)। কোনো ক্লাবকে
সম্পূর্ণ আলাদা ডোমেইনে নিতে চাইলে স্টুডিওর “নিজস্ব ওয়েব ঠিকানা” ঘরে সেটি বসালে সব বাটন সেদিকেই যাবে
(`NEXT_PUBLIC_CLUB_SITE_DOMAIN` শুধু ফলব্যাক ডোমেইন ঠিক করে)। ডেভে পরীক্ষা: `curl -H 'Host: alssm.localhost:3000' http://localhost:3000/`।
সাইট সম্পূর্ণ রানটাইম-ডাইনামিক (`force-dynamic`), তাই অ্যাডমিনে সংরক্ষণ করলেই পাবলিক পেজ নতুন তথ্য দেখায়।
