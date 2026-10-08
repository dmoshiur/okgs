import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sfSectionBySlug } from "@/components/sf/sections";
import { sfConsoleProps } from "@/lib/sf-console";
import { FairConsole } from "@/components/sf/FairConsole";

export const dynamic = "force-dynamic";

/**
 * `/sf/students`, `/sf/funds`, `/sf/settings`, … — one route per console section.
 *
 * Real routes (instead of a client-side tab switch) are what let the fixed mobile
 * bottom bar highlight the current screen, the back button work, and a link to
 * "the payment list" be pasted into a gate volunteer's chat.
 */
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const found = sfSectionBySlug(section);
  return {
    title: found ? `${found.label} — Science Fair console` : "Science Fair console",
    robots: { index: false, follow: false },
  };
}

export default async function ConsoleSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const found = sfSectionBySlug(section);
  // An unknown segment under /sf is a 404, never a silent redirect to the dashboard.
  if (!found) notFound();
  const props = await sfConsoleProps(found.id);
  return <FairConsole {...props} />;
}
