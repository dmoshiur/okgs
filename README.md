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
- **টিকিট ও বাল্ক প্রিন্ট** — প্রতিটি টিকিট **এক ভাষায়**: টুলবারে `English · বাংলা · বাংলা + English` (`?lang=`), সব লেবেল ও ফুটার সেই ভাষায় (বাংলা টিকিটে সংখ্যাও বাংলায়)। হেডারে ওমর কিন্ডারগার্টেন স্কুল + “Scholars Residential School” ও দুই লোগো, তারপর মেলার নাম (বড়, বোল্ড), ছবির সারিতে **বাবা · শিক্ষার্থী (বড়) · মা** (নিচে নাম), আইডি/রোল/শ্রেণি/শাখা/শিফট/গ্রুপ গ্রিড, নিচে বাঁয়ে স্বাক্ষরিত QR ও ডানে মেলা সভাপতির স্বাক্ষর; ফুটারে “মেয়াদ ৩১ ডিসেম্বর ২০২৬” ও ইস্যু তারিখ। **বহিরাগত অতিথি** টিকিটে “GUEST ENTRY” ট্যাগ, ক্যামেরায় তোলা ছবি (সরাসরি Cloudinary), অতিথি আইডি/ট্যাগ করা শিক্ষার্থী/যোগাযোগ/স্ট্যাটাস আর বাধ্যতামূলক ৫০ টাকা ফি + ঐচ্ছিক ১৫০ টাকার লাঞ্চ বক্স। শিক্ষার্থী ট্যাবে সারির checkbox বা roll range দিয়ে নির্দিষ্ট শিক্ষার্থী বেছে **Print bulk tickets** চাপলে শুধু সেই selection-ই যায়; কোনো selection না থাকলে বর্তমান filter-এর সব paid শিক্ষার্থী যায়। A4 পোর্ট্রেট শিটে **প্রতি পাতায় ৪টি টিকিট** (২×২ গ্রিডে ৪টি আসল A6 শিট — টেমপ্লেট বদলায় না), প্রতি ৪টির পর পেজ ব্রেক; ২০/৪০/১০০-র কোনো ছোট print-run cap নেই, তাই ৫০০+ টিকিটও একটানা print view-তে আসে — তবে এক রানে সর্বোচ্চ ২,০০০ টিকিট (৫০০ A4 পাতা), তার বেশি হলে প্রিন্টের আগেই স্পষ্ট নির্দেশ দেখায় (শ্রেণি/শিফট ধরে ধরে ছাপুন), যাতে বড় job-এ সার্ভার timeout বা memory crash না হয়। job লিংক মেয়াদোত্তীর্ণ, ভুল, নষ্ট বা খালি হলে ৫০০ এররের বদলে একই সতর্কবার্তা (Reference কোডসহ) ও Back to students / Try again দেখা যায়; ৫০০+ ID-এর খোঁজ এখন একবারে SQL-তেই হয় (আগে প্রতি ID-তে পুরো রোস্টার স্ক্যান), তাই ১০,০০০ ID-ও কয়েকশো মিলিসেকেন্ডের বদলে কয়েক মিলিসেকেন্ডে শেষ। **শুধু ফি-পরিশোধিত** শিক্ষার্থীদের টিকিট ছাপা হয় (বাকিরা SQL ফিল্টারেই বাদ পড়ে, UI থেকে বদলানো যায় না)। ড্যাশবোর্ডে শ্রেণি-ভিত্তিক বাজেট বনাম সংগ্রহ (ছাত্র ফি + অতিথি ফি + লাঞ্চ বক্স) দেখা যায়; শ্রেণি ট্যাবে সুপারঅ্যাডমিন প্রতি শ্রেণির বাজেট টার্গেট ঠিক করেন।
- **ছবি ব্যবস্থাপনা** — রোস্টার আমদানিতে এখন শিক্ষার্থী, বাবা ও মায়ের ছবির কলাম (১৭ কলাম); আর আলাদা ম্যাপিং শিটে `student_id` (বা `roll`) + `photo_url` + ঐচ্ছিক `father_photo_url` / `mother_photo_url` (Cloudinary লিংক) আপলোড করলে পুরো পরিবারের ছবি একসাথে বসে যায় — বাল্ক টিকিটে তিন ছবিই ছাপা হয়; “Check without saving” আগে দেখিয়ে দেয় কোন সারি কার সাথে মিলবে আর কোনগুলো মেলেনি। অতিথিদের ছবিসহ সব ফি-তথ্য “Export guest list (CSV)”-এ পাওয়া যায়। অথবা প্রতি শিক্ষার্থীর **Edit** মডালে শিক্ষার্থী, বাবা ও মায়ের আলাদা photo preview, file selector, Replace photo control ও Cloudinary URL দিয়ে তিনটি ছবিই সরাসরি Cloudinary-তে আপলোড/সম্পাদনা করা যায়; একই সাথে নাম/রোল/শ্রেণি/শাখা/শিফট/পেমেন্ট স্ট্যাটাসও সম্পাদনা হয়। বিস্তারিত: `CHANGES_GENESIS_TICKET.md`।
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

## Ticket printing, fair settings and student access

- **Print contract:** ticket pages explicitly restore print visibility/opacity and
  print **one true A6 portrait sheet (105 × 148 mm)** per student — the browser
  paper size is pinned to A6 with zero margins, so the sheet fills the page with
  no clipping or overflow. Application navigation and toolbars are hidden in
  print. Auto-print waits for fonts and ticket images, with an eight-second
  fallback.
- **Redesigned A6 ticket (`components/sf/print/TicketSheet.tsx`):** the header
  carries the school logo, the fixed institution name **Omar Kindergarten
  School**, the sub-header **Scholars Residential School** and the Scholars logo.
  The fair name (e.g. **OKGS GENESIS 2026**) is printed large and bold above a
  three-photo row — father (named) · student (large) · mother (named) — with the
  student's full name underneath. The tagline **Exploring The Universe Of Science**
  sits directly under the fair title. Details list Student ID (no thousands
  separators), Roll, Class, Section, Shift and Group. Below them: the five club
  logos (live from the club records), the website **okgs.info**, and the three
  official numbers (Telephone, President, Help Line). The signed QR (22 mm) sits
  bottom-left with no caption; the Fair President's signature sits bottom-right.
  Nothing is printed below the QR. There are no "STUDENT ENTRY TICKET", "Student copy", "Copy N of 1", HMAC or
  "Printed by" marks anywhere on the paper.
- **Guest tickets:** `/sf/students` → **Register outside guest** opens a modal
  that captures the guest's face with the live camera (`getUserMedia`, mirrored
  preview, one-tap retake, graceful fallback to a file picker), uploads the
  photo to Cloudinary and stores the returned URL. Every guest pays a mandatory
  **BDT 50 entry fee** plus an optional **BDT 150 lunch box** (totals 50 or
  200), all computed server-side in `lib/guest-fees.ts`. The guest ticket prints
  the same A6 layout with a bold **GUEST ENTRY** tag, Guest ID, tagged student
  reference, contact and status. Guests appear in the live table with photo,
  fees and status, can be marked PAID/REVOKED, and export as a BOM-prefixed CSV
  including their photo URLs. The gate scanner validates guest QR tokens
  (prefix `g:`), records each scan and refuses revoked guests.
- **Class budgets & fair accounting:** SuperAdmin sets a **budget target** per
  class in `/sf/classes` (stored on `classes.budget_amount` — no extra table,
  no backfill). The console dashboard's **Class-wise budget & collections**
  panel computes everything live from the database: per-class student fees
  collected vs budget, guest entry fees (50 BDT each), guest lunch boxes
  (150 BDT each), and total collected vs total target. Revoked guests drop out
  of the fee totals; there is no mock data anywhere.
- **Fair settings:** Admins and SuperAdmins can rename a fair in `/sf/settings`.
  `POST /api/staff/settings` accepts `{ action: "fair-name", slug, name }` and
  returns `{ ok: true, success: true, message: "Settings updated", applied }`.
  The fair's stable slug is unchanged, preserving payment and ticket references.
  Saving invalidates the Next layout and refreshes the current client view. Fair
  names are read from live database rows, not duplicated in session cookies.
  Selecting an active fair also updates the requesting administrator's preference
  cookie. Other open tabs show the latest values on refresh/navigation.
- **Navigation:** at widths ≥768px the fair panel and scanner use a fixed,
  collapsible sidebar; smaller screens retain the bottom navigation and More
  drawer. Print and login pages have no desktop sidebar.
- **Student portal:** `/student/login` accepts student ID, email or primary phone
  plus password and redirects students to `/me`. Bangladesh numbers such as
  `01912345678` and `+8801912345678` are equivalent. Shared/ambiguous phone numbers
  require a student ID or email. Roles always come from the database.
- **Roster accounts:** roster import does **not** automatically make public
  credentials. In `/sf/students`, an Admin/SuperAdmin can use **Portal login** to
  provision a student with an optional registered email and a random temporary
  password (shown once). Existing accounts are managed in Users. Matching the
  account's student ID to the roster ID enables the real per-fair payment status
  and its signed ticket in `/me`; students can access only their own roster
  ticket. Students can change their temporary password directly in `/me`.

### Password reset email

Configure SMTP in **SuperAdmin → SMTP Settings**, or set the SMTP variables in
`.env.example` when no enabled database SMTP configuration exists. Gmail uses
`smtp.gmail.com`, port `465`, `SMTP_SECURE=true`, and an app password; SendGrid
uses `smtp.sendgrid.net`, port `587`, `SMTP_SECURE=false`, username `apikey`, and
its API key as the SMTP password. Production port-587 transports require
STARTTLS. Set `NEXT_PUBLIC_SITE_URL` to your canonical HTTPS origin so reset links
point to the correct deployment. Keep credentials in deployment secrets, not Git.

**Render / SMTP networking:** a log such as `connect ENETUNREACH …:465` means
that the outbound connection failed before authentication. The IPv6 address can
also be the last address tried after IPv4 connection attempts failed. SMTP now
resolves hostnames to IPv4 by default (`SMTP_ADDRESS_FAMILY=4`) while keeping the
original hostname for TLS SNI and certificate verification. DNS/transport entries
refresh after five minutes; failed DNS lookups are not cached. Use
`SMTP_ADDRESS_FAMILY=0` for Nodemailer's automatic address selection or `6` for
IPv6 resolution. IP literals are used as supplied; do not hard-code Gmail's IPs.
This setting applies to both database and environment SMTP configurations.

If your Render plan or another host blocks outbound SMTP ports, changing ports
or forcing IPv4 will not bypass that restriction. Use the existing Resend HTTPS
API instead. Verify your sending domain in Resend, then set these **deployment
environment variables** and redeploy:

```dotenv
MAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-api-key
MAIL_FROM=OKGS <no-reply@okgs.info>
```

`MAIL_FROM` must use your verified domain. `MAIL_PROVIDER=resend` skips SMTP
entirely, even if an enabled Gmail configuration is saved in SuperAdmin settings,
so there is no SMTP timeout before each message. The console's **Send test** action
reports the provider actually used. No API key needs to be entered in the browser.

The default `MAIL_PROVIDER=auto` keeps the existing priority: enabled database
SMTP, then environment SMTP, then Resend. A pre-submission DNS/connect/greeting
failure also falls back to Resend when `RESEND_API_KEY` and `MAIL_FROM` are set.
Authentication/message rejections and ambiguous socket/send timeouts do not
trigger a second send, avoiding duplicates. Set `MAIL_PROVIDER=smtp` to disable
API fallback. Resend requests time out after ten seconds and failures are reported
as undelivered, never as a successful test.

Forgot Password accepts email, student ID or phone and emails a 60-minute,
single-use secure token link **to the registered email**. Only the token hash is
stored; password replacement and token consumption are transactional. Revoked
links remain in rate-limit history. Responses do not expose account existence or
reset links in production. Accounts without an email must contact the office;
**SMTP cannot deliver SMS and no SMS provider is configured**.

### Verification

```sh
npm run typecheck
npm run smoke
npm run test:portal
npm run test:mailer
npm run build
```

`test:portal` uses an isolated temporary SQLite database and local SMTP sink. It
checks multi-identifier authentication, shared-phone rejection, roster payment
and fair-name persistence, actual Nodemailer delivery, token expiry, replay and
concurrent-consumption rejection, and production reset-link secrecy. No external
SMTP credentials or deployment database are used.

`test:mailer` uses an isolated temporary database and mocked DNS, SMTP and HTTPS.
It checks IPv4 resolution/TLS hostname preservation, encrypted database settings,
DNS caching/expiry and timeouts, safe connection fallback, duplicate-send avoidance,
explicit provider selection, recipient isolation and honest API failure reporting.
It never calls Gmail or Resend and requires no real mail credentials.

`smoke` includes `scripts/student-ticket-smoke.tsx`, which renders the ticket in
all three languages (proving a sheet is never half-translated), asserts the 3:4
photo crop and the A4 portrait 2 × 2 bulk grid, parses a photo-mapping sheet, and
re-checks the PAID-only print rule, roster paging and the batch photo write
**against a live libSQL database** in a temporary directory — including every
bulk print job state a print link can arrive with (missing, expired, damaged,
empty, oversized), chunked fetching of the PAID rows, and that no snapshot
lookup can throw at the route.

Manual Chromium checks should also verify desktop/mobile navigation, settings
save-and-reload, student-owned ticket access, the bulk A4 sheet at 4 tickets per
page in the browser's own print preview, and Ctrl+P / Save as PDF with 1–3 ticket
copies in light/dark modes.


### Canteen station and safe ticket printing

- Staff open **`/sf/canteen`** (also in the navigation and scanner station tabs).
  It uses the same cookie-selected fair as the console; `/sf/scan` remains gate entry.
- A student needs a live **PAID** roster payment for that fair. A guest needs their
  own active, paid registered guest ticket, `has_lunch=1`, and a stored lunch fee
  of at least BDT 150. Entry-only/family/project passes cannot inherit a student's lunch.
- A camera scan or **Claim lunch box** records the claim. **Check only** consumes
  nothing; its popup offers **Confirm lunch box handover**, which rechecks payment.
  The popup shows verified name, own ID, lunch status and expandable details.
  Guest short IDs are display references, not manual claim credentials; use their QR.
- Claims are unique on `(subject_type, subject_id, Bangladesh calendar day)` —
  not on QR text, print copy, fair, phone clock or client flags. Concurrent devices
  cannot double-claim. Eligibility starts fresh automatically at 00:00 Asia/Dhaka;
  previous claim/audit rows are retained. Gate admission is never consumed by lunch.
- Staff-only JSON APIs: `POST /api/staff/lunch/scan` with `{token | code, fair_slug,
  action: "check" | "claim"}`; `GET /api/staff/lunch/logs?fair=…&today=1` returns
  daily summary, audit rows and server day/reset metadata. Identity, actor,
  payment and claim date come from the server. Inputs are byte-bounded; cross-site
  requests are rejected. The per-user 120 scans/minute guard is process-local;
  the durable database constraint is what guarantees cross-device redemption safety.
- Existing additive database setup creates `lunch_claims` and `lunch_scan_logs`
  without wiping students, payments, parent photo URLs or earlier scan history.
- Ticket cards are **95 × 137 mm**, on real **A6 portrait paper with 5 mm margins**.
  A4 printing uses the identical cards in a **2 × 2 grid with 4 mm gutters**,
  also inside 5 mm page margins. Choose the requested paper and **100% / Actual size**,
  disable browser headers/footers, and do a physical calibration print first.
- QR space stays **26 × 26 mm** (including its border/padding and a four-module
  quiet zone). Bulk QRs are lightweight SVGs; encoding yields to the event loop so
  large print jobs do not starve scanners. Print actions wait for fonts/photos,
  fit long text without changing source names, and warn about missing images or
  fields that cannot fit safely rather than silently clipping them.
- Edit Student's existing Cloudinary **Father Photo / Mother Photo** fields stay
  intact. Student cards show father / student / mother; guest cards show the
  tagged student's father / guest / mother, using the stored dedicated URLs.
- Bulk printing snapshots **only the selected paid IDs** (or explicit roll/filter
  scope), refuses an empty explicit selection, and keeps the full continuous view.
  Canonical record IDs take precedence over school-code aliases; ambiguous
  case-folded codes never widen a selection. Display/language toggles preserve that snapshot. There is no 50/100-ticket print
  pagination cap; 501 paid selections produce 126 physical A4 pages. Jobs expire
  after 24 hours and missing/expired jobs fail closed — prepare the selection again.

Verification: `npm run typecheck`, `npm run smoke`, `npm run test:canteen`,
`npm run test:portal`, `npm run test:mailer`, and `npm run build`.
The canteen regression uses isolated temporary SQLite data for payments, QR/manual
aliases, refunds, guest purchases/revocation, concurrency, Dhaka-midnight rollover
and audit preservation; it never uses the deployment database.

Optional real-browser verification (Node 22 / Linux): install `playwright@1.64.0`
and `@sparticuz/chromium@153.0.0` under `$HOME/.cache/okgs-browser` with npm's
`--prefix`, `--no-save` and `--no-package-lock` flags, then run
`npx tsx scripts/canteen-browser-fixture.ts`. Start a separate local server with
`TURSO_DATABASE_URL` set to the **new local database URL printed by that script**,
empty `TURSO_AUTH_TOKEN`, and
`SESSION_SECRET=isolated-browser-verification-secret-not-production`. Run
`BASE_URL=http://localhost:3000 node scripts/canteen-browser-regression.mjs`
against it (localhost is a trusted loopback host for production Secure cookies). A full run requires a fresh fixture. The script refuses
non-local targets, tests the real HTTP/UI/camera/PDF flows and 501-ticket printing,
fulfills remote photos with labeled test graphics without contacting Cloudinary,
and keeps generated databases/screenshots/PDFs in ignored `.screens/` paths.
This test-only secret/fixture is **never** a production configuration.
