import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getPublicContent } from "@/lib/db";
import { settingValue } from "@/lib/club-data";
import { organizationSchema, siteUrl } from "@/lib/schema";
import { JsonLd } from "@/components/public/JsonLd";
import { VisualModeProvider } from "@/components/public/VisualModeProvider";
import { ThemeModeProvider } from "@/components/public/ThemeModeProvider";
import { activeTheme, themeCss } from "@/lib/site";

const colorSchemeScript = `(()=>{let saved=null;try{saved=localStorage.getItem("okgs-color-scheme")}catch{}const prefersDark=typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.colorScheme=saved==="light"||saved==="dark"?saved:(prefersDark?"dark":"light")})()`;

export async function generateMetadata(): Promise<Metadata> {
  let name = "ওমর কিন্ডারগার্টেন স্কুল | কালাই, জয়পুরহাট";
  let description =
    "প্লে থেকে দশম শ্রেণি, আবাসিক ও অনাবাসিক পাঠদান — এবং সব ক্লাবের আয়োজন, সদস্য, ছবি ও অর্জনের তথ্যকেন্দ্র।";
  let logo: string | undefined;
  try {
    const content = await getPublicContent();
    name = settingValue(content.settings, "site_name", "ওমর কিন্ডারগার্টেন স্কুল | কালাই, জয়পুরহাট").slice(0, 110);
    description = settingValue(content.settings, "tagline", description);
    logo = settingValue(content.settings, "logo_url") || undefined;
  } catch {
    // The database may still be bootstrapping on the very first request.
  }

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: name,
      template: "%s | ওমর কিন্ডারগার্টেন স্কুল",
    },
    description,
    keywords: ["ওমর কিন্ডারগার্টেন স্কুল", "OKGS", "ক্লাব", "জয়পুরহাট", "কালাই", "সহশিক্ষা", "বিজ্ঞান মেলা"],
    openGraph: {
      title: name,
      description,
      url: siteUrl(),
      siteName: "Main",
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
  let content = null as Awaited<ReturnType<typeof getPublicContent>> | null;
  try {
    content = await getPublicContent();
  } catch {
    content = null;
  }
  const settings = content?.settings ?? [];
  const theme = content ? activeTheme(content) : null;
  const themeStyle = themeCss(theme);

  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorSchemeScript }} />
        {themeStyle ? <style id="okgs-theme" dangerouslySetInnerHTML={{ __html: themeStyle }} /> : null}
      </head>
      <body data-color-scheme="light" data-theme={theme?.key || "default"} data-theme-mode={theme?.mode || "light"} data-visual-mode="academic">
        <ThemeModeProvider>
          <VisualModeProvider>
            {children}
            <JsonLd schema={organizationSchema(settings)} />
          </VisualModeProvider>
        </ThemeModeProvider>
      </body>
    </html>
  );
}
