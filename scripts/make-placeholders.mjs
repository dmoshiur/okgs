/**
 * Generates the lightweight SVG artwork used by the seeded starter content.
 *
 * These files exist so a fresh install looks complete without hotlinking any
 * third-party image host. Real photography is meant to be uploaded through the
 * admin studio (Cloudinary) — the seed rows are just placeholders.
 *
 *   node scripts/make-placeholders.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "media");
mkdirSync(outDir, { recursive: true });

/** name -> [label, width, height, accent] */
const assets = {
  "hero-campus": ["প্লে থেকে দশম শ্রেণি", 1600, 900, "#166534"],
  "hero-clubs": ["ক্লাব তথ্যকেন্দ্র", 1600, 900, "#0f766e"],
  "hero-science": ["ART ODYSSEY", 1600, 900, "#b45309"],
  "banner-admission": ["ভর্তি চলছে", 1400, 700, "#14532d"],
  "banner-clubs": ["সব ক্লাবের খবর", 1400, 700, "#15803d"],
  "news-science-fair": ["বিজ্ঞান মেলা", 1200, 750, "#d97706"],
  "news-clubs": ["ক্লাব নিবন্ধন", 1200, 750, "#0d9488"],
  "news-assembly": ["নতুন শিক্ষাবর্ষ", 1200, 750, "#166534"],
  "club-science": ["ম্যাথ এন্ড সাইন্স", 900, 650, "#f59e0b"],
  "club-science-cover": ["ম্যাথ এন্ড সাইন্স ক্লাব", 1600, 800, "#f59e0b"],
  "club-language": ["ভাষা ও সাহিত্য", 900, 650, "#0d9488"],
  "club-language-cover": ["ভাষা ও সাহিত্য ক্লাব", 1600, 800, "#0d9488"],
  "club-computer": ["কম্পিউটার ক্লাব", 900, 650, "#0ea5e9"],
  "club-computer-cover": ["কম্পিউটার ক্লাব", 1600, 800, "#0ea5e9"],
  "club-sports": ["স্পোর্টিং ক্লাব", 900, 650, "#22c55e"],
  "club-sports-cover": ["স্পোর্টিং ক্লাব", 1600, 800, "#22c55e"],
  "club-culture": ["বিতর্ক ও সংস্কৃতি", 900, 650, "#a855f7"],
  "club-culture-cover": ["বিতর্ক ও সংস্কৃতি ক্লাব", 1600, 800, "#a855f7"],
  "club-junior": ["নার্সারি ক্লাব", 900, 650, "#ec4899"],
  "club-junior-cover": ["নার্সারি ও প্রি-কিউট ক্লাব", 1600, 800, "#ec4899"],
  "event-science-fair": ["বিজ্ঞান মেলা ২০২৬", 1200, 800, "#f59e0b"],
  "post-science-fair": ["মেলা প্রতিবেদন", 1200, 750, "#d97706"],
  "post-magazine": ["স্কুল ম্যাগাজিন", 1200, 750, "#0d9488"],
  "post-webcamp": ["ওয়েব কর্মশালা", 1200, 750, "#0ea5e9"],
  "post-junior": ["রংতুলি উৎসব", 1200, 750, "#ec4899"],
  "campus-building": ["মূল ভবন", 1200, 800, "#166534"],
  "campus-assembly": ["এসেম্বলি", 1200, 800, "#0f766e"],
  "campus-punjabiday": ["পাঞ্জাবি দিবস", 1200, 800, "#b45309"],
  "campus-sciencefair": ["বিজ্ঞান মেলা", 1200, 800, "#f59e0b"],
  "campus-library": ["স্কুল লাইব্রেরি", 1200, 800, "#0d9488"],
  "campus-ground": ["ক্রীড়া মাঠ", 1200, 800, "#22c55e"],
  "campus-lab": ["কম্পিউটার ল্যাব", 1200, 800, "#0ea5e9"],
  "campus-stage": ["সাংস্কৃতিক সন্ধ্যা", 1200, 800, "#a855f7"],
  "about-school": ["আমাদের প্রতিষ্ঠান", 1200, 900, "#14532d"],
  "school-logo": ["OKGS", 320, 320, "#166534"],
  "admission-desk": ["ভর্তি কার্যালয়", 1200, 900, "#15803d"],
};

/** Portrait artwork for the teacher/staff grid. */
for (const [key, label, accent] of [
  ["teacher-principal", "অধ্যক্ষ", "#14532d"],
  ["teacher-physics", "পদার্থবিজ্ঞান", "#0ea5e9"],
  ["teacher-ict", "আইসিটি", "#6366f1"],
  ["teacher-bangla", "বাংলা", "#0d9488"],
  ["teacher-nursery", "নার্সারি", "#ec4899"],
  ["staff-office", "অফিস", "#b45309"],
]) {
  assets[key] = [label, 700, 880, accent];
}

for (let club of ["science", "language", "computer", "sports", "culture", "junior"]) {
  const accent = assets[`club-${club}`][3];
  const label = assets[`club-${club}`][0];
  const count = club === "science" ? 4 : club === "sports" ? 3 : club === "language" || club === "computer" || club === "culture" ? 2 : 1;
  for (let index = 1; index <= count; index += 1) {
    assets[`gallery-${club}-${index}`] = [`${label} — ${index}`, 900, 680, accent];
  }
}

const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function build({ name, label, width, height, accent, seed }) {
  const [r, g, b] = hexToRgb(accent);
  const rnd = (min, max, offset = 0) => {
    const value = Math.abs(Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453) % 1;
    return Math.round(min + value * (max - min));
  };

  const circles = Array.from({ length: 5 }, (_, index) => {
    const cx = rnd(width * 0.1, width * 0.92, index + 1);
    const cy = rnd(height * 0.12, height * 0.88, index + 7);
    const radius = rnd(Math.min(width, height) * 0.07, Math.min(width, height) * 0.3, index + 21);
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(255,255,255,${(0.05 + index * 0.02).toFixed(2)})" />`;
  }).join("");

  const bands = Array.from({ length: 4 }, (_, index) => {
    const y = rnd(height * 0.1, height * 0.9, index + 33);
    const bandHeight = rnd(6, 34, index + 41);
    return `<rect x="0" y="${y}" width="${width}" height="${bandHeight}" fill="rgba(${r},${g},${b},0.18)" transform="skewY(${index % 2 ? -1.4 : 1.4})" />`;
  }).join("");

  const bars = Array.from({ length: 9 }, (_, index) => {
    const x = width * 0.08 + index * (width * 0.09);
    const barHeight = rnd(height * 0.08, height * 0.3, index + 55);
    return `<rect x="${Math.round(x)}" y="${height - barHeight - Math.round(height * 0.16)}" width="${Math.round(width * 0.045)}" height="${barHeight}" rx="3" fill="rgba(255,255,255,0.28)" />`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgb(${Math.round(r * 0.42)},${Math.round(g * 0.44)},${Math.round(b * 0.48)})" />
      <stop offset="0.55" stop-color="${accent}" />
      <stop offset="1" stop-color="rgb(${Math.min(255, r + 40)},${Math.min(255, g + 34)},${Math.min(255, b + 18)})" />
    </linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.45" stop-color="rgba(6,30,20,0)" />
      <stop offset="1" stop-color="rgba(6,30,20,0.62)" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  ${bands}
  ${circles}
  <g opacity="0.5">${bars}</g>
  <rect width="${width}" height="${height}" fill="url(#shade)" />
  <g font-family="'Hind Siliguri','Noto Sans Bengali',system-ui,sans-serif">
    <text x="${Math.round(width * 0.06)}" y="${height - Math.round(height * 0.075)}" fill="rgba(255,255,255,0.96)" font-size="${Math.round(Math.min(width, height) * 0.075)}" font-weight="600">${escape(label)}</text>
    <text x="${Math.round(width * 0.06)}" y="${height - Math.round(height * 0.075) - Math.round(height * 0.085)}" fill="rgba(255,255,255,0.62)" font-size="${Math.round(Math.min(width, height) * 0.038)}" letter-spacing="2">OKGS · ওমর কিন্ডারগার্টেন স্কুল</text>
  </g>
</svg>
`;
}

let index = 0;
const names = Object.keys(assets);
for (const name of names) {
  const [label, width, height, accent] = assets[name];
  const svg = build({ name, label, width, height, accent, seed: index + 1 });
  writeFileSync(join(outDir, `${name}.svg`), svg);
  index += 1;
}

console.log(`wrote ${names.length} placeholder artworks to public/media`);
