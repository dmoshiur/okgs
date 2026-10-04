import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getPublicContent } from "@/lib/db";
import { settingValue } from "@/lib/club-data";
import { organizationSchema, siteUrl } from "@/lib/schema";
import { JsonLd } from "@/components/public/JsonLd";
import { activeTheme, themeCss } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  let name = "ওমর কিন্ডারগার্টেন স্কুল | কালাই, জয়পুরহাট";
  let description =
    "প্লে থেকে দশম শ্রেণি, আবাসিক ও অনাবাসিক পাঠদান — এবং সব ক্লাবের আয়োজন, সদস্য, ছবি ও অর্জনের তথ্যকেন্দ্র।";
  let logo: string | undefined;
  try {
    const content = await getPublicContent();
    name = `${settingValue(content.settings, "site_name")} — ${settingValue(content.settings, "club_mission", "ক্লাব তথ্যকেন্দ্র")}`.slice(0, 110);
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
      title: "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি",
      description,
      url: siteUrl(),
      siteName: "OKGS",
      type: "website",
      locale: "bn_BD",
      images: logo ? [{ url: logo }] : undefined,
    },
    twitter: { card: "summary_large_image", title: "ওমর কিন্ডারগার্টেন স্কুল", description },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#14532d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
    <html lang="bn">
      <head>
        {themeStyle ? <style id="okgs-theme" dangerouslySetInnerHTML={{ __html: themeStyle }} /> : null}
      </head>
      <body data-theme={theme?.key || "default"} data-theme-mode={theme?.mode || "light"}>
        {children}
        <JsonLd schema={organizationSchema(settings)} />
      </body>
    </html>
  );
}
