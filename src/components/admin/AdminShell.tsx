'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ChevronRight,
  ChevronsUpDown,
  CornerDownLeft,
  ExternalLink,
  Languages,
  LayoutGrid,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Zap,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/admin/admin-ui';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { cn } from '@/lib/utils';

// ============== TYPES ==============
export type AdminNavItem = {
  icon: React.ReactNode;
  label: string;
  idx: number;
  /** Accent colour for the icon */
  color: string;
  /** Short one-line explanation shown under the page title and in search */
  description?: string;
  badge?: number;
  show: boolean;
  /** Show in the mobile bottom bar */
  primary?: boolean;
  /** Extra search terms (Thai/English synonyms) */
  keywords?: string;
};

export type AdminNavGroup = {
  category: string;
  items: AdminNavItem[];
};

type AdminShellProps = {
  title: string;
  brand: string;
  roleLabel: string;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  saving?: boolean;
  savingLabel: string;
  readyLabel: string;
  statusTime?: string | null;
  navGroups: AdminNavGroup[];
  activeTab: number;
  onNavigate: (idx: number) => void;
  onLogout: () => void;
  /** @deprecated mobile drawer state is handled internally */
  sidebarOpen?: boolean;
  /** @deprecated mobile drawer state is handled internally */
  onSidebarOpenChange?: (open: boolean) => void;
  /** @deprecated breakpoints are CSS-driven */
  isDesktop?: boolean;
  shopSwitcher?: React.ReactNode;
  headerExtra?: React.ReactNode;
  /** Content rendered at the right side of the page header (e.g. section actions) */
  pageActions?: React.ReactNode;
  lang?: string;
  children: React.ReactNode;
};

// ============== PERSISTENCE ==============
const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

const collapsedListeners = new Set<() => void>();

function writeCollapsed(v: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(v));
  } catch {
    /* ignore */
  }
  collapsedListeners.forEach((l) => l());
}

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener);
  return () => {
    collapsedListeners.delete(listener);
  };
}

const noopSubscribe = () => () => {};
const getModKey = () => (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl');

// ============== NAV ITEM ==============
function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: AdminNavItem;
  active: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  const hasBadge = typeof item.badge === 'number' && item.badge > 0;
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex w-full items-center rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        collapsed ? 'size-10 justify-center' : 'h-9 gap-2.5 px-2.5',
        active
          ? 'bg-primary/10 font-semibold text-foreground'
          : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {active && !collapsed ? (
        <span className="absolute inset-y-1.5 -left-2 w-[3px] rounded-r-full bg-primary" aria-hidden />
      ) : null}
      <span
        className="grid size-5 shrink-0 place-items-center [&_svg]:size-[18px]"
        style={{ color: active ? 'var(--primary)' : 'currentColor' }}
      >
        {item.icon}
      </span>
      {!collapsed ? <span className="flex-1 truncate text-left">{item.label}</span> : null}
      {hasBadge && !collapsed ? (
        <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[0.65rem] font-bold leading-5 text-primary-foreground tabular-nums">
          {item.badge! > 99 ? '99+' : item.badge}
        </span>
      ) : null}
      {hasBadge && collapsed ? (
        <span className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-card" aria-hidden />
      ) : null}
    </button>
  );

  if (!collapsed) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {item.label}
        {hasBadge ? ` (${item.badge})` : ''}
      </TooltipContent>
    </Tooltip>
  );
}

// ============== NAV LIST ==============
function NavList({
  groups,
  activeTab,
  collapsed,
  onSelect,
}: {
  groups: AdminNavGroup[];
  activeTab: number;
  collapsed?: boolean;
  onSelect: (idx: number) => void;
}) {
  return (
    <nav className={cn('flex flex-col pb-4', collapsed ? 'items-center gap-1' : 'gap-4')}>
      {groups.map((group, gi) => {
        const visible = group.items.filter((i) => i.show);
        if (!visible.length) return null;
        return (
          <div key={group.category} className={cn('flex flex-col', collapsed ? 'items-center gap-1' : 'gap-0.5')}>
            {collapsed ? (
              gi > 0 ? <div className="my-1.5 h-px w-6 bg-border" aria-hidden /> : null
            ) : (
              <p className="px-2.5 pb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.category}
              </p>
            )}
            {visible.map((item) => (
              <NavButton
                key={item.idx}
                item={item}
                active={activeTab === item.idx}
                collapsed={collapsed}
                onClick={() => onSelect(item.idx)}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}

// ============== COMMAND PALETTE ==============
type PaletteEntry = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  color?: string;
  keywords: string;
  run: () => void;
};

function CommandPalette({
  open,
  onOpenChange,
  entries,
  lang,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: PaletteEntry[];
  lang: string;
}) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    const terms = q.split(/\s+/);
    return entries.filter((e) => {
      const hay = `${e.label} ${e.hint || ''} ${e.group} ${e.keywords}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [entries, query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const runEntry = (entry?: PaletteEntry) => {
    if (!entry) return;
    onOpenChange(false);
    // Let the dialog close before navigating (avoids focus fights)
    setTimeout(entry.run, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runEntry(filtered[cursor]);
    }
  };

  // Group for display while keeping a flat index for keyboard nav
  let flatIndex = -1;
  const groups: { name: string; items: { entry: PaletteEntry; index: number }[] }[] = [];
  for (const entry of filtered) {
    flatIndex += 1;
    let g = groups.find((x) => x.name === entry.group);
    if (!g) {
      g = { name: entry.group, items: [] };
      groups.push(g);
    }
    g.items.push({ entry, index: flatIndex });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">{lang === 'en' ? 'Search' : 'ค้นหา'}</DialogTitle>
        <DialogDescription className="sr-only">
          {lang === 'en' ? 'Jump to a page or run an action' : 'ไปยังหน้าหรือสั่งงานด่วน'}
        </DialogDescription>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder={lang === 'en' ? 'Search pages and actions…' : 'ค้นหาเมนูหรือคำสั่ง… เช่น "ออเดอร์", "ส่วนลด"'}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label={lang === 'en' ? 'Search' : 'ค้นหา'}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {lang === 'en' ? 'No results' : 'ไม่พบเมนูที่ค้นหา'}
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="mb-1">
                <p className="px-2 pt-2 pb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {g.name}
                </p>
                {g.items.map(({ entry, index }) => (
                  <button
                    key={entry.id}
                    type="button"
                    data-index={index}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => runEntry(entry)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm',
                      index === cursor ? 'bg-accent text-accent-foreground' : 'text-foreground',
                    )}
                  >
                    <span
                      className="inline-flex shrink-0 items-center justify-center text-primary [&_svg]:size-4"
                    >
                      {entry.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{entry.label}</span>
                      {entry.hint ? (
                        <span className="block truncate text-xs text-muted-foreground">{entry.hint}</span>
                      ) : null}
                    </span>
                    {index === cursor ? <CornerDownLeft className="size-3.5 text-muted-foreground" /> : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-border bg-muted/40 px-4 py-2 text-[0.7rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {lang === 'en' ? 'move' : 'เลื่อน'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>↵</Kbd> {lang === 'en' ? 'open' : 'เปิด'}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============== USER MENU ==============
function UserMenu({
  userName,
  userEmail,
  userImage,
  roleLabel,
  onLogout,
  lang,
  variant,
  onOpenStorefront,
}: {
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  roleLabel: string;
  onLogout: () => void;
  lang: string;
  variant: 'sidebar' | 'sidebar-collapsed' | 'avatar';
  onOpenStorefront: () => void;
}) {
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const displayName = userName || 'Admin';
  const initial = displayName.slice(0, 1).toUpperCase();

  const avatar = (
    <Avatar className="size-8 shrink-0">
      <AvatarImage src={userImage || undefined} alt={displayName} />
      <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initial}</AvatarFallback>
    </Avatar>
  );

  let trigger: React.ReactNode;
  if (variant === 'sidebar') {
    trigger = (
      <button
        type="button"
        className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">{roleLabel}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
    );
  } else {
    trigger = (
      <button
        type="button"
        aria-label={lang === 'en' ? 'Account menu' : 'เมนูบัญชี'}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {avatar}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={variant === 'avatar' ? 'bottom' : 'right'}
        align={variant === 'avatar' ? 'end' : 'end'}
        sideOffset={8}
        className="w-60"
      >
        <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
          {avatar}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">{userEmail || roleLabel}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {themeMode === 'dark' ? <Moon /> : themeMode === 'light' ? <Sun /> : <Monitor />}
            {lang === 'en' ? 'Theme' : 'ธีม'}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={themeMode} onValueChange={(v) => setThemeMode(v as ThemeMode)}>
              <DropdownMenuRadioItem value="light">{lang === 'en' ? 'Light' : 'สว่าง'}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">{lang === 'en' ? 'Dark' : 'มืด'}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">{lang === 'en' ? 'System' : 'ตามระบบ'}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages />
            {lang === 'en' ? 'Language' : 'ภาษา'}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={language} onValueChange={(v) => setLanguage(v as typeof language)}>
              <DropdownMenuRadioItem value="th">ไทย</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={onOpenStorefront}>
          <ExternalLink />
          {lang === 'en' ? 'Open storefront' : 'เปิดหน้าร้าน'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onLogout}>
          <LogOut />
          {lang === 'en' ? 'Sign out' : 'ออกจากระบบ'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============== MAIN COMPONENT ==============
export function AdminShell({
  title,
  brand,
  roleLabel,
  userName,
  userEmail,
  userImage,
  saving,
  savingLabel,
  readyLabel,
  statusTime,
  navGroups,
  activeTab,
  onNavigate,
  onLogout,
  shopSwitcher,
  headerExtra,
  pageActions,
  lang = 'th',
  children,
}: AdminShellProps) {
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const modKey = useSyncExternalStore(noopSubscribe, getModKey, () => 'Ctrl');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSession, setPaletteSession] = useState(0);
  const paletteOpenRef = useRef(false);
  useEffect(() => {
    paletteOpenRef.current = paletteOpen;
  }, [paletteOpen]);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const resolvedTheme = useThemeStore((s) => s.resolvedMode);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const toggleCollapsed = useCallback(() => {
    writeCollapsed(!readCollapsed());
  }, []);

  /** Open/close the search palette; every open starts with a fresh query */
  const setPalette = useCallback((open: boolean) => {
    if (open) setPaletteSession((n) => n + 1);
    setPaletteOpen(open);
  }, []);

  // Global shortcuts: Ctrl/⌘+K → search, Ctrl/⌘+B → toggle sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        setPalette(!paletteOpenRef.current);
      } else if (key === 'b') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return;
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed, setPalette]);

  const visibleGroups = useMemo(
    () => navGroups.map((g) => ({ ...g, items: g.items.filter((i) => i.show) })).filter((g) => g.items.length),
    [navGroups],
  );

  let activeEntry: { group: string; item: AdminNavItem } | null = null;
  for (const g of visibleGroups) {
    const item = g.items.find((i) => i.idx === activeTab);
    if (item) {
      activeEntry = { group: g.category, item };
      break;
    }
  }

  const handleSelect = useCallback(
    (idx: number) => {
      setMobileOpen(false);
      if (idx !== activeTab) onNavigate(idx);
      // Scroll content back to the top on section change
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    },
    [activeTab, onNavigate],
  );

  const openStorefront = useCallback(() => {
    window.open('/', '_blank', 'noopener');
  }, []);

  const paletteEntries = useMemo<PaletteEntry[]>(() => {
    const pages: PaletteEntry[] = visibleGroups.flatMap((g) =>
      g.items.map((item) => ({
        id: `nav-${item.idx}`,
        label: item.label,
        hint: item.description,
        group: g.category,
        icon: item.icon,
        color: item.color,
        keywords: item.keywords || '',
        run: () => handleSelect(item.idx),
      })),
    );
    const actionsGroup = lang === 'en' ? 'Actions' : 'คำสั่ง';
    const actions: PaletteEntry[] = [
      {
        id: 'act-theme',
        label: resolvedTheme === 'dark'
          ? (lang === 'en' ? 'Switch to light theme' : 'เปลี่ยนเป็นธีมสว่าง')
          : (lang === 'en' ? 'Switch to dark theme' : 'เปลี่ยนเป็นธีมมืด'),
        group: actionsGroup,
        icon: resolvedTheme === 'dark' ? <Sun /> : <Moon />,
        keywords: 'theme dark light ธีม มืด สว่าง',
        run: () => setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'act-lang',
        label: language === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย',
        group: actionsGroup,
        icon: <Languages />,
        keywords: 'language ภาษา english thai',
        run: () => setLanguage(language === 'th' ? 'en' : 'th'),
      },
      {
        id: 'act-sidebar',
        label: collapsed
          ? (lang === 'en' ? 'Expand sidebar' : 'ขยายแถบเมนู')
          : (lang === 'en' ? 'Collapse sidebar' : 'ย่อแถบเมนู'),
        group: actionsGroup,
        icon: collapsed ? <PanelLeftOpen /> : <PanelLeftClose />,
        keywords: 'sidebar menu เมนู',
        run: toggleCollapsed,
      },
      {
        id: 'act-store',
        label: lang === 'en' ? 'Open storefront' : 'เปิดหน้าร้าน',
        group: actionsGroup,
        icon: <ExternalLink />,
        keywords: 'shop store หน้าร้าน',
        run: openStorefront,
      },
      {
        id: 'act-logout',
        label: lang === 'en' ? 'Sign out' : 'ออกจากระบบ',
        group: actionsGroup,
        icon: <LogOut />,
        color: 'var(--destructive)',
        keywords: 'logout sign out ออก',
        run: onLogout,
      },
    ];
    return [...pages, ...actions];
  }, [visibleGroups, lang, resolvedTheme, language, collapsed, handleSelect, setThemeMode, setLanguage, toggleCollapsed, openStorefront, onLogout]);

  // Mobile bottom bar: up to 4 primary items + "menu"
  const bottomItems = useMemo(() => {
    const all = visibleGroups.flatMap((g) => g.items);
    const primary = all.filter((i) => i.primary);
    return (primary.length ? primary : all).slice(0, 4);
  }, [visibleGroups]);

  const statusText = saving ? savingLabel : statusTime ? `${lang === 'en' ? 'Saved' : 'บันทึก'} ${statusTime}` : readyLabel;

  const brandBlock = (compact: boolean) => (
    <div className={cn('flex items-center gap-2.5', compact && 'justify-center')}>
      <div className="inline-flex shrink-0 items-center justify-center text-primary">
        <Zap className="size-5" />
      </div>
      {!compact ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">{title}</p>
          <p className="truncate text-[0.7rem] text-muted-foreground">{brand}</p>
        </div>
      ) : null}
    </div>
  );

  const searchButton = (compact: boolean) =>
    compact ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setPalette(true)}
            aria-label={lang === 'en' ? 'Search' : 'ค้นหา'}
            className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {lang === 'en' ? 'Search' : 'ค้นหา'} ({modKey}+K)
        </TooltipContent>
      </Tooltip>
    ) : (
      <button
        type="button"
        onClick={() => setPalette(true)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">{lang === 'en' ? 'Search menu…' : 'ค้นหาเมนู…'}</span>
        <span className="flex items-center gap-0.5">
          <Kbd>{modKey}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
    );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="admin-root flex min-h-dvh">
        {/* ─── Desktop sidebar ─── */}
        <aside
          className={cn(
            'admin-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card md:flex',
            collapsed ? 'admin-sidebar--collapsed' : 'admin-sidebar--expanded',
          )}
        >
          <div className={cn('flex h-14 shrink-0 items-center border-b border-border', collapsed ? 'justify-center px-2' : 'px-4')}>
            {brandBlock(collapsed)}
          </div>

          <div className={cn('flex flex-col gap-2 pt-3', collapsed ? 'items-center px-2' : 'px-3')}>
            {!collapsed && shopSwitcher ? <div>{shopSwitcher}</div> : null}
            {searchButton(collapsed)}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className={cn('pt-4', collapsed ? 'px-2' : 'px-3')}>
              <NavList groups={visibleGroups} activeTab={activeTab} collapsed={collapsed} onSelect={handleSelect} />
            </div>
          </ScrollArea>

          <div className={cn('flex shrink-0 flex-col gap-1 border-t border-border p-2', collapsed && 'items-center')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    collapsed ? 'size-10 justify-center' : 'h-9 px-2.5',
                  )}
                >
                  {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
                  {!collapsed ? <span className="flex-1 text-left">{lang === 'en' ? 'Collapse' : 'ย่อเมนู'}</span> : null}
                  {!collapsed ? (
                    <span className="flex items-center gap-0.5">
                      <Kbd>{modKey}</Kbd>
                      <Kbd>B</Kbd>
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
              {collapsed ? (
                <TooltipContent side="right" sideOffset={10}>
                  {lang === 'en' ? 'Expand' : 'ขยายเมนู'} ({modKey}+B)
                </TooltipContent>
              ) : null}
            </Tooltip>
            <UserMenu
              userName={userName}
              userEmail={userEmail}
              userImage={userImage}
              roleLabel={roleLabel}
              onLogout={onLogout}
              lang={lang}
              variant={collapsed ? 'sidebar-collapsed' : 'sidebar'}
              onOpenStorefront={openStorefront}
            />
          </div>
        </aside>

        {/* ─── Mobile drawer ─── */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex w-[290px] flex-col gap-0 p-0 sm:max-w-[290px]">
            <SheetHeader className="h-14 shrink-0 flex-row items-center border-b border-border px-4 py-0">
              <SheetTitle className="sr-only">{title}</SheetTitle>
              {brandBlock(false)}
            </SheetHeader>
            <div className="flex flex-col gap-2 px-3 pt-3">
              {shopSwitcher ? <div>{shopSwitcher}</div> : null}
              {searchButton(false)}
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-3 pt-4">
                <NavList groups={visibleGroups} activeTab={activeTab} onSelect={handleSelect} />
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* ─── Main column ─── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-xl md:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={lang === 'en' ? 'Open menu' : 'เปิดเมนู'}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            >
              <Menu className="size-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
              <span className="hidden truncate text-muted-foreground sm:inline">{activeEntry?.group || title}</span>
              <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground/60 sm:inline" />
              <span className="truncate font-semibold">{activeEntry?.item.label || title}</span>
            </nav>

            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              {headerExtra}
              <span
                className={cn(
                  'hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex',
                  saving
                    ? 'border-warning/30 bg-warning/10 text-warning dark:text-warning'
                    : 'border-border text-muted-foreground',
                )}
                aria-live="polite"
              >
                <span
                  className={cn('size-1.5 rounded-full', saving ? 'animate-pulse bg-warning' : 'bg-success')}
                />
                {statusText}
              </span>
              <button
                type="button"
                onClick={() => setPalette(true)}
                aria-label={lang === 'en' ? 'Search' : 'ค้นหา'}
                className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
              >
                <Search className="size-[18px]" />
              </button>
              <div className="md:hidden">
                <UserMenu
                  userName={userName}
                  userEmail={userEmail}
                  userImage={userImage}
                  roleLabel={roleLabel}
                  onLogout={onLogout}
                  lang={lang}
                  variant="avatar"
                  onOpenStorefront={openStorefront}
                />
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-3 pt-4 pb-24 md:px-6 md:pt-6 md:pb-10">
            <div className="mx-auto w-full max-w-[1400px]">
              {activeEntry ? (
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold tracking-tight md:text-2xl">{activeEntry.item.label}</h1>
                    {activeEntry.item.description ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{activeEntry.item.description}</p>
                    ) : null}
                  </div>
                  {pageActions ? <div className="flex items-center gap-2">{pageActions}</div> : null}
                </div>
              ) : null}
              {children}
            </div>
          </main>
        </div>

        {/* ─── Mobile bottom bar ─── */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
          aria-label={lang === 'en' ? 'Quick navigation' : 'เมนูด่วน'}
        >
          <div className="grid h-16 grid-cols-5">
            {bottomItems.map((item) => {
              const active = item.idx === activeTab;
              return (
                <button
                  key={item.idx}
                  type="button"
                  onClick={() => handleSelect(item.idx)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-1 text-[0.65rem] font-medium',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <span className="relative [&_svg]:size-5">
                    {item.icon}
                    {typeof item.badge === 'number' && item.badge > 0 ? (
                      <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-primary px-1 text-center text-[0.55rem] font-bold leading-4 text-primary-foreground">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="max-w-full truncate px-1">{item.label}</span>
                </button>
              );
            })}
            {Array.from({ length: Math.max(0, 4 - bottomItems.length) }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center justify-center gap-1 text-[0.65rem] font-medium text-muted-foreground"
            >
              <LayoutGrid className="size-5" />
              <span>{lang === 'en' ? 'More' : 'เมนูทั้งหมด'}</span>
            </button>
          </div>
        </nav>

        <CommandPalette key={paletteSession} open={paletteOpen} onOpenChange={setPalette} entries={paletteEntries} lang={lang} />
      </div>
    </TooltipProvider>
  );
}
