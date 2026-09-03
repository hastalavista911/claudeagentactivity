// dashboard/src/components/icons.jsx
//
// SVG icons (lucide-react) replacing emoji -- emoji is one of the clearest
// signs of an "AI-generated" look (user feedback, 2026-08-27). Every icon
// here uses a consistent line style, currentColor, and a uniform size.

import {
  Bot,
  FileText,
  Terminal,
  HelpCircle,
  MessageCircle,
  Wrench,
  FlaskConical,
  Coins,
  Cpu,
  Folder,
  File,
  Pencil,
  Eye,
  FileDiff,
  Bell,
  CheckCircle2,
  XCircle,
  Download,
  ShieldAlert,
  Check,
  X,
  MessageSquare,
  Send,
  GitBranch,
  History,
  ChevronDown,
  ChevronUp,
  Info,
  Bug,
  Languages,
  Hand,
  Zap,
  Sparkles,
  Server,
  Target,
  Plug,
  LayoutGrid,
  Wifi,
  Trash2,
} from "lucide-react";

const CATEGORY_ICON = {
  agent: Bot,
  file: FileText,
  terminal: Terminal,
  chat: MessageSquare,
  other: HelpCircle,
};

export function CategoryIcon({ category, size = 14, ...rest }) {
  const Icon = CATEGORY_ICON[category] ?? HelpCircle;
  return <Icon size={size} strokeWidth={2} {...rest} />;
}

// Specific icons used in stat tiles / activity cards -- exported directly
// so the caller doesn't need to know the icon package's name.
export const StatIcons = {
  thinking: MessageCircle,
  files: FileText,
  toolCalls: Wrench,
  tests: FlaskConical,
  tokens: Coins,
  model: Cpu,
};

export const ActivityKindIcon = {
  editing: Pencil,
  terminal: Terminal,
  thinking: MessageCircle,
};

export {
  Bot,
  FileText,
  Terminal,
  Folder,
  File,
  Eye,
  FileDiff,
  Bell,
  CheckCircle2,
  XCircle,
  Download,
  ShieldAlert,
  Check,
  X,
  MessageSquare,
  Send,
  GitBranch,
  History,
  ChevronDown,
  ChevronUp,
  Info,
  Bug,
  Languages,
  Hand,
  Zap,
  Sparkles,
  FlaskConical,
  Coins,
  Server,
  HelpCircle,
  Target,
  Plug,
  LayoutGrid,
  Wifi,
  Trash2,
};
