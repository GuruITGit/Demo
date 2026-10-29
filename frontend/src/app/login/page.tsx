'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { loginAction, useAuthStore } from '@/stores/auth.store';
import { DEMO_LOGINS, DEMO_PASSWORD } from '@/lib/demo/accounts';
import { api, getErrorMessage } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Brand = { nameTh?: string; logoUrl?: string } | null;

export default function LoginLanding() {
  return (
    <Suspense fallback={null}>
      <LoginLandingInner />
    </Suspense>
  );
}

function LoginLandingInner() {
  const router = useRouter();
  const params = useSearchParams();
  // หน้านี้เป็นฟอร์มเจ้าหน้าที่อย่างเดียว (เข้าผ่านปุ่ม "สำหรับเจ้าหน้าที่" = /login?staff=1)
  // เปิด /login เฉย ๆ (เช่นพิมพ์ URL เอง) → ไปหน้าบริการประชาชน · ระบบเด้งมาเพราะหมดเซสชัน/ออกจากระบบจะใส่ ?staff=1 เสมอ
  const isStaff = !!params.get('staff');
  useEffect(() => { if (!isStaff) router.replace('/citizen'); }, [isStaff, router]);
  // ล็อกอินค้างไว้แล้ว (กดปุ่ม "สำหรับเจ้าหน้าที่" จากหน้าประชาชน) → เข้าระบบเลย ไม่ต้องกรอกซ้ำ
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useEffect(() => { if (isStaff && hasHydrated && isAuthenticated) router.replace('/dashboard'); }, [isStaff, hasHydrated, isAuthenticated, router]);
  // แบรนด์ อบต. ตามโดเมนที่เปิด (multi-tenant) — เปิด sao-lamnangrong.com เห็นชื่อ+โลโก้ลำนางรอง
  const [brand, setBrand] = useState<Brand>(null);
  useEffect(() => {
    if (!isStaff) return;
    api.get('/organizations/by-host').then((r) => { if (r.data?.data?.found) setBrand(r.data.data); }).catch(() => {});
  }, [isStaff]);

  if (!isStaff) return null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-slate-50 p-5">
      {/* พื้นหลังภาพจริง จาง ๆ (วางไฟล์ที่ public/login/bg.jpg) + ทับขาวให้การ์ดเด่น */}
      <div className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/login/bg.jpg')" }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-slate-50/88 backdrop-blur-[1px]" aria-hidden="true" />
      {brand?.nameTh && (
        <div className="relative flex items-center gap-2.5 rounded-full border border-slate-200 bg-white/90 px-4 py-2 shadow-sm">
          {brand.logoUrl && <img src={brand.logoUrl} alt="" className="h-7 w-7 rounded-full object-contain" />}
          <span className="text-sm font-semibold text-slate-700">{brand.nameTh}</span>
        </div>
      )}
      <div className="relative w-full max-w-3xl cz-anim-up">
        <GovLogin onBack={() => router.push('/citizen')} onDone={() => router.push('/dashboard')} />
      </div>
    </div>
  );
}

/* ── Login เจ้าหน้าที่ ── */
function GovLogin({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) { setError('กรุณากรอก Username และ Password'); return; }
    setLoading(true); setError('');
    try { await loginAction(username.trim(), password); onDone(); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> กลับหน้าบริการประชาชน
      </button>
      <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-2">
        {/* แผงแบรนด์ สีทึบ (รองรับรูป public/login/main.jpg) */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-blue-600 p-8 text-white lg:flex">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/login/main.jpg')" }} aria-hidden="true" />
          <div className="absolute inset-0 bg-blue-950/25" aria-hidden="true" />
          <div className="relative">
            <span className="text-xl font-bold tracking-wide">Smart SAO</span>
            <h3 className="mt-6 text-xl font-bold">ระบบบริหารงานภายใน</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/85">ระบบจัดการสารบรรณภายในแบบ online</p>
          </div>
          <p className="relative text-xs text-white/70">อบต. ออนไลน์</p>
        </div>

        {/* ฟอร์ม */}
        <div className="p-8">
          <h2 className="text-lg font-semibold text-slate-900">เข้าสู่ระบบเจ้าหน้าที่</h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">ชื่อผู้ใช้</Label>
              <Input id="username" className="h-11" placeholder="username" value={username}
                onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} className="h-11 pr-10"
                  placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
              จำฉันไว้
            </label>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'กำลังเข้าระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
          {process.env.NEXT_PUBLIC_DEMO_MODE === '1' && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">เดโม่ — เลือกบัญชีทดลอง (รหัสผ่านทุกบัญชี: {DEMO_PASSWORD})</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {DEMO_LOGINS.map((a) => (
                  <button key={a.username} type="button" onClick={() => { setUsername(a.username); setPassword(DEMO_PASSWORD); setError(''); }}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs transition ${username === a.username ? 'border-amber-500 bg-white' : 'border-amber-200 bg-white/60 hover:bg-white'}`}>
                    <span className="block font-medium text-slate-800">{a.label}</span>
                    <span className="block truncate text-[11px] text-slate-500">{a.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
