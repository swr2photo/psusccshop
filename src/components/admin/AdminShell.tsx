'use client';

import React from 'react';
import { Menu, LogOut, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import LanguageToggle from '@/components/LanguageToggle';
import { cn } from '@/lib/utils';

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

function NavList({
  groups,
  activeTab,
  onNavigate,
  onItemClick,
}: {
  groups: AdminNavGroup[];
  activeTab: number;
  onNavigate: (idx: number) => void;
  onItemClick?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 pb-4">
      {groups.map((group) => {
        const visible = group.items.filter((i) => i.show);
        if (!visible.length) return null;
        return (
          <div key={group.category} className="mb-1">
            <p className="px-3 py-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground/80">
              {group.category}
            </p>
            <div className="flex flex-col gap-0.5">
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
  const sidebar = (
    <div className="flex h-full flex-col bg-card/80 backdrop-blur-xl">
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
        />
      </ScrollArea>
    </div>
  );

  return (
    <div className="admin-root flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 px-3 py-3 backdrop-blur-xl md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3">
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
            <div className="flex items-center gap-2.5">
              <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                <Zap className="size-5" />
              </div>
              <div className="hidden sm:block">
                <p className="text-base font-extrabold leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground">{brand}</p>
              </div>
            </div>
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

            <div className="relative z-10">
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
        <aside className="hidden w-[260px] shrink-0 border-r border-border md:block">{sidebar}</aside>

        <Sheet open={!isDesktop && sidebarOpen} onOpenChange={onSidebarOpenChange}>
          <SheetContent side="left" className="w-[280px] p-0 sm:max-w-[280px]">
            <SheetHeader className="sr-only">
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            {sidebar}
          </SheetContent>
        </Sheet>

        <main className="min-w-0 flex-1 overflow-auto p-3 md:p-5">{children}</main>
      </div>
    </div>
  );
}
