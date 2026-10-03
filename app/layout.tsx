import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ওমর কিন্ডারগার্টেন স্কুল | কালাই, জয়পুরহাট",
    template: "%s | ওমর কিন্ডারগার্টেন স্কুল",
  },
  description:
    "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি — ২০০৩ সাল থেকে কালাই, জয়পুরহাটে মানসম্মত শিক্ষায় নিবেদিত।",
  metadataBase: new URL("https://okgs.info"),
  openGraph: {
    title: "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি",
    description: "কালাই, জয়পুরহাটে ২০০৩ সাল থেকে মানসম্মত শিক্ষা।",
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
