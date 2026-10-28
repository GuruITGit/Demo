'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCommandPaletteStore } from '@/stores/command-palette.store';
import { useAuthStore } from '@/stores/auth.store';
import { Search, ArrowRight, Plus, LogOut } from 'lucide-react';
import { logoutAction } from '@/stores/auth.store';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { useDisabledModules } from '@/hooks/use-modules';
import { MODULES, MODULE_COLOR } from '@/lib/modules';

type CommandItem = {
  id: string;
  label: string;
  shortLabel?: string;
  group: string;
  icon: React.ElementType;
  color?: string;
  action: () => void;
  keywords?: string[];
  adminOnly?: boolean;
  moduleKey?: string;
};

export function CommandPalette() {
  const { isOpen, close } = useCommandPaletteStore();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roles?.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r)) ?? false;
  const disabledModules = useDisabledModules();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback((path: string) => {
    router.push(path);
    close();
    setQuery('');
  }, [router, close]);

  // รายการค้นหาสร้างจากทะเบียนโมดูลกลาง (lib/modules.ts) — เพิ่มโมดูลใหม่ที่นั่นแล้วค้นเจอเอง
  const ALL_ITEMS: CommandItem[] = [
    // เมนูของแต่ละโมดูล
    ...MODULES.filter((m) => !m.hideInPalette).map((m) => ({
      id: m.key,
      label: m.label,
      group: m.navGroup === 'หลัก' ? 'เมนูหลัก' : (m.navGroup || 'ระบบ'),
      icon: m.icon,
      color: m.color,
      action: () => navigate(m.href),
      keywords: m.keywords,
      adminOnly: m.adminOnly,
      moduleKey: m.key,
    })),
    // ปุ่มลัดสร้างของใหม่ที่โมดูลประกาศไว้
    ...MODULES.flatMap((m) => (m.quickActions || []).map((a) => ({
      id: a.id,
      label: a.label,
      group: 'การดำเนินการ',
      icon: Plus,
      color: m.color,
      action: () => navigate(a.href),
      keywords: a.keywords,
      moduleKey: m.key,
    }))),

    { id: 'logout', label: 'ออกจากระบบ', group: 'ระบบ', icon: LogOut, color: 'text-rose-500', action: () => { logoutAction(); router.push('/login?staff=1'); close(); }, keywords: ['logout', 'sign out', 'ออก'] },
  ];

  const visibleItems = ALL_ITEMS.filter((item) =>
    (!item.adminOnly || isAdmin) && !(item.moduleKey && disabledModules.includes(item.moduleKey)));

  const filtered = query.trim().length === 0
    ? visibleItems.filter((i) => i.group !== 'การดำเนินการ').slice(0, 12)
    : visibleItems.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q) ||
          item.keywords?.some((k) => k.toLowerCase().includes(q))
        );
      }).slice(0, 15);

  // Group filtered items
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.group] = acc[item.group] ?? []).push(item);
    return acc;
  }, {});
  const flatFiltered = Object.values(grouped).flat();

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flatFiltered[selectedIndex]?.action();
      setQuery('');
    }
  }, [flatFiltered, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  let globalIndex = 0;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) { close(); setQuery(''); } }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 rounded-2xl border border-gray-200 bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">เมนูค้นหาด่วน</DialogPrimitive.Title>
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-gray-100">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเมนู, การดำเนินการ..."
              className="flex-1 py-4 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
            />
            <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono border border-gray-200">Esc</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-96 overflow-y-auto py-2">
            {flatFiltered.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">ไม่พบรายการที่ตรงกับ "{query}"</div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">{group}</div>
                  {items.map((item) => {
                    const idx = globalIndex++;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={() => { item.action(); setQuery(''); }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          idx === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                          idx === selectedIndex ? 'bg-white shadow-sm' : 'bg-gray-100'
                        )}>
                          <Icon className={cn('h-3.5 w-3.5', item.color ?? 'text-gray-500')} />
                        </div>
                        <span className="text-sm font-medium flex-1">{item.label}</span>
                        {idx === selectedIndex && <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
            <span><kbd className="font-mono bg-gray-100 px-1 py-0.5 rounded border border-gray-200">↑↓</kbd> เลื่อน</span>
            <span><kbd className="font-mono bg-gray-100 px-1 py-0.5 rounded border border-gray-200">Enter</kbd> เปิด</span>
            <span><kbd className="font-mono bg-gray-100 px-1 py-0.5 rounded border border-gray-200">Esc</kbd> ปิด</span>
            <span className="ml-auto"><kbd className="font-mono bg-gray-100 px-1 py-0.5 rounded border border-gray-200">Ctrl+K</kbd> เปิด/ปิด</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
