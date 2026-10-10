import type { Metadata } from "next";
import { ScannerPage } from "@/components/sf/ScannerPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Canteen lunch scanner", robots: { index: false, follow: false } };

export default function CanteenPage() { return <ScannerPage mode="lunch" />; }
