'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Menu, LogOut, Zap, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from '@/components/ui/menubar';
import LanguageToggle from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

// ============== TYPES ==============
export type AdminNavItem = {
  icon: React.ReactNode;
  label: string;
  idx: number;
  color: string;
  badge?: number;
  show: boolean;
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
  userImage?: string | null;
  saving?: boolean;
  savingLabel: string;
  readyLabel: string;
  statusTime?: string | null;
  navGroups: AdminNavGroup[];
  activeTab: number;
  onNavigate: (idx: number) => void;
  onLogout: () => void;
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
  isDesktop: boolean;
  shopSwitcher?: React.ReactNode;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
};

// ============== STORAGE KEYS ==============
const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';
const GROUPS_COLLAPSED_KEY = 'admin-groups-collapsed';

function loadCollapsedState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveCollapsedState(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {}
}

function loadCollapsedGroups(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(GROUPS_COLLAPSED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveCollapsedGroups(groups: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GROUPS_COLLAPSED_KEY, JSON.stringify([...groups]));
  } catch {}
}

// ============== NAV LIST (EXPANDED) ==============
function NavList({
  groups,
  activeTab,
  onNavigate,
  onItemClick,
  collapsedGroups,
  onToggleGroup,
}: {
  groups: AdminNavGroup[];
  activeTab: number;
  onNavigate: (idx: number) => void;
  onItemClick?: () => void;
  collapsedGroups: Set<string>;
  onToggleGroup: (category: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 pb-4">
      {groups.map((group) => {
        const visible = group.items.filter((i) => i.show);
        if (!visible.length) return null;
        const isGroupCollapsed = collapsedGroups.has(group.category);
        return (
          <div key={group.category} className="mb-1">
            <button
              type="button"
              onClick={() => onToggleGroup(group.category)}
              className="flex w-full items-center gap-1 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground/80 transition-colors hover:text-muted-foreground"
            >
              <ChevronDown
                className={cn(
                  'size-3 shrink-0 transition-transform duration-200',
                  isGroupCollapsed && '-rotate-90',
                )}
              />
              <span className="flex-1 text-left">{group.category}</span>
              {isGroupCollapsed && (
                <span className="text-[0.55rem] font-normal normal-case tracking-normal text-muted-foreground/50">
                  {visible.length}
                </span>
              )}
            </button>
            <div
              className={cn(
                'admin-nav-group-items flex flex-col gap-0.5 overflow-hidden transition-all duration-250 ease-in-out',
                isGroupCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100',
              )}
            >
              {visible.map((item) => {
                const active = activeTab === item.idx;
                return (
                  <button
                    key={item.idx}
                    type="button"
                    onClick={() => {
                      onNavigate(item.idx);
                      onItemClick?.();
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/15 text-foreground shadow-sm ring-1 ring-primary/30'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: active ? `${item.color}22` : 'var(--surface-2)',
                        color: item.color,
                      }}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[0.65rem]">
                        {item.badge > 99 ? '99+' : item.badge}
                      </Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============== NAV LIST (COLLAPSED - Icons Only) ==============
function NavListCollapsed({
  groups,
  activeTab,
  onNavigate,
}: {
  groups: AdminNavGroup[];
  activeTab: number;
  onNavigate: (idx: number) => void;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col items-center gap-1 py-2">
        {groups.map((group) => {
          const visible = group.items.filter((i) => i.show);
          if (!visible.length) return null;
          return (
            <React.Fragment key={group.category}>
              <div className="my-1 h-px w-6 bg-border/50" />
              {visible.map((item) => {
                const active = activeTab === item.idx;
                return (
                  <Tooltip key={item.idx}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onNavigate(item.idx)}
                        className={cn(
                          'relative flex size-10 items-center justify-center rounded-xl transition-all duration-150',
                          active
                            ? 'bg-primary/15 text-foreground shadow-sm ring-1 ring-primary/30'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <span
                          className="flex size-8 items-center justify-center rounded-lg"
                          style={{
                            background: active ? `${item.color}22` : 'transparent',
                            color: item.color,
                          }}
                        >
                          {item.icon}
                        </span>
                        {item.badge && item.badge > 0 ? (
                          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.55rem] font-bold text-destructive-foreground">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        ) : null}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// ============== MAIN COMPONENT ==============
export function AdminShell({
  title,
  brand,
  roleLabel,
  userName,
  userImage,
  saving,
  savingLabel,
  readyLabel,
  statusTime,
  navGroups,
  activeTab,
  onNavigate,
  onLogout,
  sidebarOpen,
  onSidebarOpenChange,
  isDesktop,
  shopSwitcher,
  headerExtra,
  children,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Load persisted state on mount
  useEffect(() => {
    setCollapsed(loadCollapsedState());
    setCollapsedGroups(loadCollapsedGroups());
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsedState(next);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((category: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      saveCollapsedGroups(next);
      return next;
    });
  }, []);

  // ─── Desktop Expanded Sidebar ───
  const sidebarExpanded = (
    <div className="flex h-full flex-col bg-card/80 backdrop-blur-xl">
      {/* Sidebar Header with Collapse Toggle at Top */}
      <div className="hidden items-center justify-between border-b border-border px-3.5 py-3 md:flex">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">เมนูแอดมิน</span>
        </div>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PanelLeftClose className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">ย่อเมนู</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-3 border-b border-border px-4 py-4 md:hidden">
        <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Zap className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground">{brand}</p>
        </div>
      </div>

      {shopSwitcher ? <div className="border-b border-border px-3 py-3">{shopSwitcher}</div> : null}

      <ScrollArea className="flex-1 px-2 py-2">
        <NavList
          groups={navGroups}
          activeTab={activeTab}
          onNavigate={onNavigate}
          onItemClick={() => {
            if (!isDesktop) onSidebarOpenChange(false);
          }}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
        />
      </ScrollArea>
    </div>
  );

  // ─── Desktop Collapsed Sidebar ───
  const sidebarCollapsed = (
    <div className="flex h-full flex-col items-center bg-card/80 backdrop-blur-xl">
      {/* Top Toggle Button */}
      <TooltipProvider delayDuration={100}>
        <div className="hidden border-b border-border p-2.5 md:flex md:justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25 transition-transform hover:scale-105"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              ขยายเมนู
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <ScrollArea className="flex-1 py-1">
        <NavListCollapsed
          groups={navGroups}
          activeTab={activeTab}
          onNavigate={onNavigate}
        />
      </ScrollArea>
    </div>
  );

  // ─── Mobile Sidebar (always expanded, inside Sheet) ───
  const mobileSidebar = (
    <div className="flex h-full flex-col bg-card/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Zap className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground">{brand}</p>
        </div>
      </div>

      {shopSwitcher ? <div className="border-b border-border px-3 py-3">{shopSwitcher}</div> : null}

      <ScrollArea className="flex-1 px-2 py-2">
        <NavList
          groups={navGroups}
          activeTab={activeTab}
          onNavigate={onNavigate}
          onItemClick={() => onSidebarOpenChange(false)}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
        />
      </ScrollArea>
    </div>
  );

  return (
    <div className="admin-root flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 px-3 py-3 backdrop-blur-xl md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile Menu Button */}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="md:hidden"
              onClick={() => onSidebarOpenChange(true)}
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </Button>

            {/* Desktop Sidebar Toggle (Top Bar) */}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="hidden md:inline-flex"
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
                  >
                    {collapsed ? <PanelLeftOpen className="size-4 text-primary" /> : <PanelLeftClose className="size-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex items-center gap-2.5">
              <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                <Zap className="size-5" />
              </div>
              <div className="hidden sm:block">
                <p className="text-base font-extrabold leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground">{brand}</p>
              </div>
            </div>

            {/* Desktop menubar — quick jump across nav groups */}
            <Menubar className="ml-1 hidden border-border/80 bg-transparent shadow-none lg:flex">
              {navGroups.map((group) => {
                const visible = group.items.filter((i) => i.show);
                if (!visible.length) return null;
                return (
                  <MenubarMenu key={group.category}>
                    <MenubarTrigger className="text-xs font-semibold text-muted-foreground data-[state=open]:text-foreground">
                      {group.category}
                    </MenubarTrigger>
                    <MenubarContent>
                      {visible.map((item) => (
                          <MenubarItem
                            key={item.idx}
                            onClick={() => onNavigate(item.idx)}
                            className={cn(
                              activeTab === item.idx && 'bg-accent text-accent-foreground',
                            )}
                          >
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5"
                              style={{
                                background: activeTab === item.idx ? `${item.color}22` : 'var(--surface-2)',
                                color: item.color,
                              }}
                            >
                              {item.icon}
                            </span>
                            <span className="flex-1">{item.label}</span>
                            {typeof item.badge === 'number' && item.badge > 0 ? (
                              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-[0.65rem]">
                                {item.badge > 99 ? '99+' : item.badge}
                              </Badge>
                            ) : null}
                          </MenubarItem>
                      ))}
                    </MenubarContent>
                  </MenubarMenu>
                );
              })}
            </Menubar>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {headerExtra}
            <div
              className={cn(
                'hidden items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold sm:flex',
                saving
                  ? 'border-[color-mix(in_oklab,var(--warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] text-[var(--warning)]'
                  : 'border-[color-mix(in_oklab,var(--success)_40%,transparent)] bg-[color-mix(in_oklab,var(--success)_12%,transparent)] text-[var(--success)]',
              )}
            >
              {saving ? (
                <Skeleton className="size-3 rounded-full" />
              ) : (
                <span className="size-1.5 rounded-full bg-[var(--success)]" />
              )}
              <span>{saving ? savingLabel : statusTime || readyLabel}</span>
            </div>

            <div className="relative z-10 flex items-center gap-1.5">
              <ThemeToggle size="small" />
              <LanguageToggle size="small" />
            </div>

            <Separator orientation="vertical" className="hidden h-8 sm:block" />

            <div className="flex items-center gap-2 pl-1">
              <Avatar className="size-9 ring-2 ring-primary/30">
                <AvatarImage src={userImage || undefined} alt={userName || 'Admin'} />
                <AvatarFallback>{(userName || 'A').slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-sm font-semibold leading-tight">{userName?.split(' ')[0] || 'Admin'}</p>
                <p className="text-[0.65rem] text-muted-foreground">{roleLabel}</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={onLogout} aria-label="Logout">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar with collapse transition */}
        <aside
          className={cn(
            'admin-sidebar hidden shrink-0 border-r border-border md:block',
            collapsed ? 'admin-sidebar--collapsed' : 'admin-sidebar--expanded',
          )}
        >
          {collapsed ? sidebarCollapsed : sidebarExpanded}
        </aside>

        {/* Mobile sidebar (Sheet overlay) */}
        <Sheet open={!isDesktop && sidebarOpen} onOpenChange={onSidebarOpenChange}>
          <SheetContent side="left" className="w-[280px] p-0 sm:max-w-[280px]">
            <SheetHeader className="sr-only">
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            {mobileSidebar}
          </SheetContent>
        </Sheet>

        <main className="min-w-0 flex-1 overflow-auto p-3 md:p-5">{children}</main>
      </div>
    </div>
  );
}
