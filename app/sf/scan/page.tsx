import type { Metadata } from "next";
import { ScannerPage } from "@/components/sf/ScannerPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "QR gate scanner", robots: { index: false, follow: false } };

export default function ScanPage() { return <ScannerPage mode="gate" />; }
