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
- **কনটেন্ট স্টুডিও** `/admin` — ১৬টি রিসোর্স, গ্রুপ করা ফর্ম, প্রকাশ/গোপেন টগল, ক্রম পরিবর্তন (↑↓), ডুপ্লিকেট, ক্লাব-ভিত্তিক ফিল্টার, ডিলিটের আগে ক্যাসকেড সতর্কতা।
- **Cloudinary ডাইরেক্ট আপলোড** — ফাইল বেছে নিলেই সরাসরি আপলোড হয়; না-কনফিগার থাকলে পেস্ট-করা URL-এর ফর্ম দেখায়।
- SEO: metadata, Open Graph, JSON-LD (School / Event / Article), sitemap, robots।

## মেলা কনসোল ও শিক্ষার্থী পোর্টাল

- **`/sf/login`** — শিক্ষক/অ্যাডমিন/ক্লাব অ্যাডমিন লগইন (ইমেইল **বা** আইডি নম্বর + পাসওয়ার্ড)।
- **`/sf`** — ফেয়ার কনসোল (মোবাইল-ফার্স্ট, নিচে ট্যাব বার): ড্যাশবোর্ড (মোট ফান্ড, শ্রেণি+শাখা অনুযায়ী ছাত্রসংখ্যা, খরচ, বকেয়া), ফান্ড, পাওনা, খরচ, সংগ্রহ (প্রকল্প), QR পাস, **টিকার**, ইউজার, শ্রেণি, সেটিং।
- **`/sf/scan`** — ক্যামেরা দিয়ে QR স্ক্যান (jsQR) + ম্যানুয়াল টোকেন; লগইন করা শিক্ষক/অ্যাডমিনের ক্যামেরা দিয়েই যাচাই। প্রতিটি **পাস** ও প্রতিটি **প্রকল্প-লেবেল** স্ক্যান করে যাচাই করা যায় (প্রকল্পের QR: কনসোল → সংগ্রহ → QR আইকন → `/api/qr?entry=<id>`)।
- **`/me`** — শিক্ষার্থী/প্রাক্তন শিক্ষার্থীর ড্যাশবোর্ড: পাওনা পরিশোধ, ফান্ড জমা, QR পাস তৈরি, ইতিহাস।
- **`/pass/<token>`** — প্রিন্টযোগ্য QR কার্ড; **`/entry/<token>`** — প্রকল্প যাচাই পাতা।
- **এক ক্লিকে পুরো সাইট মেলা-সাইট** — সেটিং ট্যাব → “মেলা মোড চালু”; যেকোনো সময় ফিরিয়ে আনা যায়।

## ডেটা মডেল

`lib/content-config.ts` একমাত্র উৎস: প্রতিটি রিসোর্সের ফিল্ড, লেবেল, টাইপ, গ্রুপ, ভ্যালিডেশন ও ডিফল্ট। টেবিলের SQL এই সংজ্ঞা থেকেই তৈরি হয় (`lib/db.ts` → `createTableSql`), তাই নতুন ফিল্ড যোগ করলে ম্যানুয়াল মাইগ্রেশন লাগে না — পরের বুটে কলামটি যোগ হয়ে যায়।

| গ্রুপ | রিসোর্স |
| --- | --- |
| ক্লাব | `clubs`, `club_events`, `club_gallery`, `club_members`, `club_achievements`, `club_posts` |
| হোমপেজ ও প্রকাশনা | `slides`, `notices`, `banners`, `news`, `updates` |
| প্রতিষ্ঠান | `teachers`, `facilities`, `gallery`, `stats`, `settings` |

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
- ডেভ লগইন: `admin@okgs.info` / `change-this-password` (`ADMIN_EMAIL` / `ADMIN_PASSWORD` দিয়ে বদলান)।
- ক্লাব অ্যাডমিন: `alssm@okgs.info` … `artds@okgs.info` / `okgs1234` (`CLUB_ADMIN_PASSWORD` দিয়ে বদলান)।
- শিক্ষার্থী: আইডি নম্বর (যেমন `2026-0001`) বা ইমেইল + `okgs1234` — প্রথম লগইনে পাসওয়ার্ড বদলানো যায় (`/me`)।
- সাবডোমেইন ডেভে পরীক্ষা: `curl -H 'Host: alssm.localhost:3000' http://localhost:3000/`।

## Cloudinary সেটআপ (signed আপলোড — প্রস্তাবিত)

১. Cloudinary → ড্যাশবোর্ড থেকে **Cloud name**, **API key**, **API secret** নিন। সার্ভার নিজেই প্রতিটি আপলোড স্বাক্ষর করে (`/api/media/sign`), তাই ব্রাউজারে কোনো সিক্রেট যায় না।
২. `.env.local`-এ বসান: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`।
৩. API key/secret না দিলে অ্যাপ পুরোনো **unsigned preset** পথে ফিরে যায় (`CLOUDINARY_UPLOAD_PRESET`)।

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
সাইট সম্পূর্ণ রানটাইম-ডাইনামিক (`force-dynamic`), তাই অ্যাডমিনে সংরক্ষণ করলেই পাবলিক পেজ নতুন তথ্য দেখায়।
