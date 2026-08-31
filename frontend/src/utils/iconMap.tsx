import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Award,
  Baby,
  BookOpen,
  Briefcase,
  Brush,
  Building2,
  Calendar,
  CheckCircle2,
  Clipboard,
  DollarSign,
  Droplet,
  ExternalLink,
  Flag,
  Globe,
  GraduationCap,
  HelpCircle,
  Home,
  Laptop,
  MapPin,
  MessageCircle,
  Monitor,
  Newspaper,
  Package,
  Phone,
  Plane,
  Scissors,
  Search,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Stethoscope,
  Store,
  User,
  Users,
} from "lucide-react";
import { createElement } from "react";

export const ICON_MAP: Record<string, LucideIcon> = {
  AlertCircle,
  Award,
  Baby,
  BookOpen,
  Briefcase,
  Brush,
  Building2,
  Calendar,
  CheckCircle2,
  Clipboard,
  DollarSign,
  Droplet,
  ExternalLink,
  Flag,
  Globe,
  GraduationCap,
  Home,
  Laptop,
  MapPin,
  MessageCircle,
  Monitor,
  Newspaper,
  Package,
  Phone,
  Plane,
  Scissors,
  Search,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Stethoscope,
  Store,
  User,
  Users,
};

export function getIcon(name?: string): LucideIcon {
  if (!name) return HelpCircle;
  return ICON_MAP[name] || HelpCircle;
}

export function renderIcon(name?: string, props: Record<string, unknown> = {}) {
  const Icon = getIcon(name);
  return createElement(Icon, props);
}

export function DynamicIcon({ name, ...props }: { name?: string } & Record<string, unknown>) {
  const IconComponent = getIcon(name);
  return <IconComponent {...props} />;
}
