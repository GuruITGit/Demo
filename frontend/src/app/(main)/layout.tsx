'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TopNav } from '@/components/layout/top-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/stores/auth.store';
import { useSocket } from '@/hooks/use-socket';
import { CommandPalette } from '@/components/shared/command-palette';
import { useCommandPaletteStore } from '@/stores/command-palette.store';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const openPalette = useCommandPaletteStore((s) => s.open);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useSocket();

  // ปิดเมนูมือถืออัตโนมัติเมื่อเปลี่ยนหน้า
  useEffect(() => { setMobileNavOpen(false); }, [pathname]);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.push('/login?staff=1');
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openPalette]);

  if (!hasHydrated) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--background)]">
      <TopNav onMenuClick={() => setMobileNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
