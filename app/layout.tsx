import type { Metadata, Viewport } from "next";
/* -------------------------------------------------------------------------
   Bengali-safe font system.

   Primary route is `next/font/google`: it self-hosts the files at build time,
   removes the render-blocking Google @import the old stylesheet used, and
   exposes the same --font-* CSS variables consumed by globals.css and the
   theme engine (lib/site.ts):

     import { Hind_Siliguri, Inter, Noto_Serif_Bengali, Poppins } from "next/font/google";
     const hindSiliguri = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind-siliguri", display: "swap" });
     const notoSerifBengali = Noto_Serif_Bengali({ subsets: ["bengali", "latin"], weight: ["500", "600", "700"], variable: "--font-noto-serif-bengali", display: "swap" });
     const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
     const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-poppins", display: "swap" });
     // …then: <html className={`${hindSiliguri.variable} ${notoSerifBengali.variable} ${inter.variable} ${poppins.variable}`}>

   The build here ships the equivalent Fontsource files instead (same subsets,
   same families, identical unicode-range splitting), because this environment
   cannot reach fonts.googleapis.com and the --font-* tokens resolve either way.

   Hind Siliguri carries full যুক্তবর্ণ (conjunct) coverage for UI text; Noto
   Serif Bengali is the display face with proper matra/কার clearance; Inter and
   Poppins cover Latin. Weights are limited to the 400–700 band the UI uses.
   ------------------------------------------------------------------------- */
import "@fontsource/hind-siliguri/400.css";
import "@fontsource/hind-siliguri/500.css";
import "@fontsource/hind-siliguri/600.css";
import "@fontsource/hind-siliguri/700.css";
import "@fontsource/noto-serif-bengali/500.css";
import "@fontsource/noto-serif-bengali/600.css";
import "@fontsource/noto-serif-bengali/700.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource-variable/inter/wght.css";
import "./globals.css";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { loadContent, type PublicContent } from "@/lib/content";
import { settingValue } from "@/lib/club-data";
import { organizationSchema, siteUrl } from "@/lib/schema";
import { siteIdentity } from "@/lib/site-settings";
import { isExemptPath } from "@/lib/maintenance";
import { canBypassMaintenanceLock } from "@/lib/auth";
import { JsonLd } from "@/components/public/JsonLd";
import { VisualModeProvider } from "@/components/public/VisualModeProvider";
import { ThemeModeProvider } from "@/components/public/ThemeModeProvider";
import { activeFair, activeTheme, readFlag, readSetting, themeCss } from "@/lib/site";
import { ticketSchoolName } from "@/lib/ticket-locale";
import { DesktopSidebar } from "@/components/sf/DesktopSidebar";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { readFairPreference } from "@/lib/sf-preference";
import { BottomNav } from "@/components/sf/BottomNav";
import { COLOR_SCHEME_COOKIE } from "@/components/public/ThemeModeProvider";
import { VISUAL_MODE_COOKIE, type VisualMode } from "@/lib/design-themes";

export async function generateMetadata(): Promise<Metadata> {
  let name = "ওমর কিন্ডারগার্টেন স্কুল | কালাই, জয়পুরহাট";
  let description =
    "প্লে থেকে দশম শ্রেণি, আবাসিক ও অনাবাসিক পাঠদান — এবং সব ক্লাবের আয়োজন, সদস্য, ছবি ও অর্জনের তথ্যকেন্দ্র।";
  let logo: string | undefined;
  let favicon: string | undefined;
  let shortName = "ওকেজিএস";
  // OpenGraph siteName — bound to Site Settings, never a hardcoded literal.
  let siteName = "ওকেজিএস";
  try {
    const content = await loadContent();
    // Every value below is editable from /admin/settings → Site Settings.
    const site = siteIdentity(content.settings);
    shortName = site.shortName || shortName;
    siteName = site.siteName || site.shortName || "OKGS";
    name = (site.siteTitle || site.siteName || name).slice(0, 120);
    description = settingValue(content.settings, "tagline", description) || description;
    logo = site.logo || undefined;
    favicon = site.favicon || undefined;
  } catch {
    // The database may still be bootstrapping on the very first request.
  }

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: name,
      template: `%s | ${shortName}`,
    },
    description,
    icons: favicon
      ? { icon: [{ url: favicon }], shortcut: [favicon], apple: [favicon] }
      : undefined,
    keywords: ["ওমর কিন্ডারগার্টেন স্কুল", "OKGS", "ক্লাব", "জয়পুরহাট", "কালাই", "সহশিক্ষা", "বিজ্ঞান মেলা"],
    openGraph: {
      title: name,
      description,
      url: siteUrl(),
      siteName,
      type: "website",
      locale: "bn_BD",
      images: logo ? [{ url: logo }] : undefined,
    },
    twitter: { card: "summary_large_image", title: name, description },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#0f1e36",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // loadContent() is request-scoped: the layout, generateMetadata above and the
  // page below share one database read, so the browser title, the header and the
  // body can never describe different versions of the same row.
  let content = null as PublicContent | null;
  try {
    content = await loadContent();
  } catch {
    content = null;
  }
  const settings = content?.settings ?? [];

  /* -------------------------------------------------------------------------
     Maintenance fallback.
     middleware.ts already rewrites public requests to /maintenance while the
     emergency switch is on. This is the second line of defence for anything the
     middleware could not see (a cached RSC payload, a host that bypasses it):
     the layout knows the requested path from the header middleware sets, and it
     redirects unless the path is exempt or an admin is signed in.
     ------------------------------------------------------------------------- */
  const requestPath = (await headers()).get("x-okgs-pathname") || "";
  const rewritten = (await headers()).get("x-okgs-maintenance") === "1";
  /* -------------------------------------------------------------------------
     Language. The public site is Bangla; every staff surface — the content studio
     under /admin and the whole Science Fair panel under /sf (console, gate
     scanner, tickets, print sheets) — is English-only, and the document language
     has to say so: it drives hyphenation, spell-check, screen-reader
     pronunciation and the font stack the browser reaches for.
     ------------------------------------------------------------------------- */
  const staffSession = await getPortalSession();
  const sidebarFair = content ? activeFair(content, await readFairPreference()) : null;
  const documentLang = /^\/(admin|sf)(\/|$)/.test(requestPath) ? "en" : "bn";
  if (!rewritten && requestPath && !isExemptPath(requestPath) && readFlag(settings, "maintenance_mode", false)) {
    if (!(await canBypassMaintenanceLock())) redirect("/maintenance");
  }
  const theme = content ? activeTheme(content) : null;
  const themeStyle = themeCss(theme);

  /* -------------------------------------------------------------------------
     Colour scheme and visual mode are read from cookies — never from localStorage.
     Deciding on the server means the first paint is already correct, so the old
     blocking inline script (which read localStorage before hydration) is gone.
     ------------------------------------------------------------------------- */
  const jar = await cookies();
  const savedScheme = jar.get(COLOR_SCHEME_COOKIE)?.value;
  const colorScheme = savedScheme === "light" || savedScheme === "dark" ? savedScheme : theme?.mode === "dark" ? "dark" : "light";
  const savedVisual = jar.get(VISUAL_MODE_COOKIE)?.value;
  const visualMode: VisualMode = savedVisual === "science-fair" ? "science-fair" : "academic";

  return (
    <html lang={documentLang} data-color-scheme={colorScheme} suppressHydrationWarning>
      <head>
        {themeStyle ? <style id="okgs-theme" dangerouslySetInnerHTML={{ __html: themeStyle }} /> : null}
      </head>
      <body data-color-scheme={colorScheme} data-theme={theme?.key || "default"} data-theme-mode={theme?.mode || "light"} data-visual-mode={visualMode}>
        <ThemeModeProvider>
          <VisualModeProvider>
            {children}
            <JsonLd schema={organizationSchema(settings)} />
          </VisualModeProvider>
        </ThemeModeProvider>
        {/*
          Global mobile navigation of the Science Fair panel. It is mounted here —
          not inside each page — so the bar is present on every staff screen,
          including the ones the console shell does not render (the gate scanner,
          the ticket sheets), and it never has to be re-implemented per route.
        */}
        <BottomNav />
        {staffSession && isStaffRole(staffSession.role) && content ? <DesktopSidebar
          fairs={content.fairs.filter((fair) => fair.is_active !== false)} activeSlug={sidebarFair?.slug ?? ""}
          logo={settingValue(settings, "logo_url")} schoolName={ticketSchoolName(readSetting(settings, "site_name_en") || settingValue(settings, "site_name"))}
          userName={staffSession.user.name} role={staffSession.role}
        /> : null}
      </body>
    </html>
  );
}
