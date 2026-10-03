import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OKGS — A bright beginning for every possibility",
    template: "%s | OKGS",
  },
  description:
    "Omar Kindergarten School — a warm, future-facing school where curious minds grow generous futures.",
  metadataBase: new URL("https://okgs.info"),
  openGraph: {
    title: "OKGS — A bright beginning for every possibility",
    description: "A school shaped by wonder, character and confident contribution.",
    url: "https://okgs.info",
    siteName: "OKGS",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
