'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, ChevronUp, RotateCcw, UserRound, X } from 'lucide-react';
import { DEMO_LOGINS } from '@/lib/demo/accounts';
import { useAuthStore, loginAction, logoutAction } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';

/**
 * แถบเครื่องมือโหมดเดโม่ (มุมซ้ายล่าง) — สลับบัญชีทดลองได้ทันทีโดยไม่ต้องล็อกเอาต์ + รีเซ็ตข้อมูลตัวอย่าง
 * แสดงเฉพาะ build ที่ตั้ง NEXT_PUBLIC_DEMO_MODE=1 (ดู providers.tsx)
 */
export function DemoBanner() {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const switchTo = async (username: string) => {
    setBusy(true);
    try {
      await logoutAction();
      await loginAction(username, 'demo1234');
      setOpen(false);
      // โหลดใหม่เพื่อล้างแคชข้อมูลของบัญชีก่อนหน้า (สิทธิ์/กล่องงานต่างกัน)
      window.location.assign('/dashboard');
    } catch {
      toast.error('สลับบัญชีไม่สำเร็จ');
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!confirm('ล้างข้อมูลที่ทดลองเพิ่ม/แก้/ลบไว้ทั้งหมด แล้วกลับเป็นข้อมูลตัวอย่างชุดเดิม?')) return;
    setBusy(true);
    const { resetDemoData } = await import('@/lib/demo/core');
    await import('@/lib/demo/handlers');
    await resetDemoData();
    window.location.reload();
  };

  return (
    <div className="no-print fixed bottom-4 left-4 z-[200] text-sm">
      {open && (
        <div className="mb-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-xs leading-relaxed text-gray-600">
              <b className="text-gray-900">โหมดเดโม่</b> — ข้อมูลทั้งหมดเป็นข้อมูลสมมติ เพิ่ม/แก้ไข/ลบได้เหมือนระบบจริง และจำไว้ในเครื่องนี้
            </p>
            <button onClick={() => setOpen(false)} aria-label="ปิด" className="rounded p-0.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          </div>
          <p className="mb-1 text-xs font-medium text-gray-500">สลับบัญชีทดลอง</p>
          <ul className="space-y-1">
            {DEMO_LOGINS.map((a) => (
              <li key={a.username}>
                <button onClick={() => switchTo(a.username)} disabled={busy || me?.username === a.username}
                  className="flex w-full items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1.5 text-left hover:bg-gray-50 disabled:cursor-default disabled:bg-blue-50 disabled:text-blue-700">
                  <UserRound className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.label}</span>
                    <span className="block truncate text-[11px] text-gray-500">{a.hint}</span>
                  </span>
                  {me?.username === a.username && <span className="text-[11px] font-medium">ใช้อยู่</span>}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={reset} disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RotateCcw className="h-4 w-4" />รีเซ็ตข้อมูลตัวอย่าง
          </button>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white/95 px-3 py-1.5 font-medium text-gray-700 shadow-sm backdrop-blur hover:bg-white">
        <FlaskConical className="h-4 w-4 text-amber-600" />เดโม่<ChevronUp className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
