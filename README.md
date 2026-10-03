# OKGS — Omar Kindergarten School

একটি বাংলা, সংক্ষিপ্ত ও কনটেন্ট-ম্যানেজড স্কুল ওয়েবসাইট — Next.js App Router এবং Turso/libSQL দিয়ে তৈরি। অফিসিয়াল `omarkgschool.com`-এর প্রকাশিত তথ্য, ছবি ও যোগাযোগের তথ্য অনুসরণ করে হোমপেজ সাজানো হয়েছে।

## Features

- Responsive public school site with rotating hero sliders, notices, campaign banners, news, latest updates and five club portals.
- Admin dashboard for creating, editing, publishing and deleting every public content type.
- Turso/libSQL schema bootstraps automatically and seeds an editorial starter set on an empty database.
- Admin credentials and Turso connection are environment-driven.
- Club cards link directly to `https://{club-slug}.okgs.info`.
- SEO metadata, Open Graph defaults, sitemap and robots rules are included.

## Run locally

```bash
npm install
cp .env.example .env.local
# Add your Turso credentials, or leave TURSO_* unset to use local.db for development.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then use `/admin/login` for the content studio. The development fallback admin is:

- Email: `admin@okgs.info`
- Password: `change-this-password`

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` before deploying. For Turso, use the database URL and auth token created by `turso db create` / `turso db tokens create`.
