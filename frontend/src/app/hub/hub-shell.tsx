'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore, logoutAction } from '@/stores/auth.store';
import { Building2, LogOut, ShieldCheck } from 'lucide-react';

/**
 * เปลือกของคอนโซลเจ้าของระบบ — แถบบนสีเข้ม ให้แยกออกจากเว็บ อบต. (สีเขียว) ตั้งแต่แรกเห็น
 * ยามประตู: ไม่ได้ล็อกอิน หรือไม่ใช่ SUPER_ADMIN → เด้งไป /hub/login
 * (สิทธิ์จริงบังคับที่ backend ทุก endpoint อยู่แล้ว — ตรงนี้แค่ทำให้ UX ถูกต้อง)
 */
export default function HubShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const isLoginPage = pathname === '/hub/login';
  const isSuper = !!user?.roles?.includes('SUPER_ADMIN');
  // รอโหลดเซสชันจาก localStorage ก่อน — ไม่งั้นกดรีเฟรชหน้า /hub แล้วเด้งไปหน้า login ทุกครั้ง
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (isLoginPage || !hasHydrated) return;
    if (!token || !isSuper) router.replace('/hub/login');
  }, [isLoginPage, hasHydrated, token, isSuper, router]);

  if (isLoginPage) return <>{children}</>;
  if (!hasHydrated || !token || !isSuper) return null; // กำลังโหลดเซสชัน / กำลังเด้งไปหน้า login

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900 text-slate-100">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
          <Link href="/hub" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700">
              <ShieldCheck className="h-4.5 w-4.5 text-slate-200" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">คอนโซลผู้ดูแลระบบ</span>
              <span className="block text-[11px] text-slate-400">Smart SAO · เจ้าของระบบ</span>
            </span>
          </Link>

          <nav className="ml-6 flex items-center gap-1">
            <Link
              href="/hub"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                pathname === '/hub' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Building2 className="h-4 w-4" /> หน่วยงาน
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block text-sm">{user?.fullNameTh || user?.username}</span>
              <span className="block text-[11px] text-slate-400">ผู้ดูแลระบบสูงสุด</span>
            </span>
            <button
              onClick={async () => { await logoutAction(); router.replace('/hub/login'); }}
              title="ออกจากระบบ"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
