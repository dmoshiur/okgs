import {
  Activity,
  Atom,
  Award,
  BellRing,
  BookOpen,
  CalendarDays,
  FileText,
  HeartHandshake,
  Image as ImageIcon,
  Images,
  Leaf,
  Megaphone,
  MessagesSquare,
  Monitor,
  Music,
  Newspaper,
  Palette,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons are chosen by name in the admin studio, so every option has to be
 * statically imported (no dynamic require) for the bundler to keep them.
 */
export const iconMap: Record<string, LucideIcon> = {
  Activity,
  Atom,
  Award,
  BellRing,
  BookOpen,
  CalendarDays,
  FileText,
  HeartHandshake,
  Image: ImageIcon,
  Images,
  Leaf,
  Megaphone,
  MessagesSquare,
  Monitor,
  Music,
  Newspaper,
  Palette,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trophy,
  Users,
};

export function iconFor(name?: string | null): LucideIcon {
  if (name && iconMap[name]) return iconMap[name];
  return Sparkles;
}

export function IconByName({ name, size = 20, strokeWidth = 1.8 }: { name?: string | null; size?: number; strokeWidth?: number }) {
  const Icon = iconFor(name);
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
