'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/water-api';
import { useWaterAuthStore } from '@/stores/water-auth.store';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

/** ล็อกอินเว็บประปา — human-designed เข้าชุดกับ /login (2-col แผงฟ้า + ฟอร์ม) */
export default function PrapaLoginPage() {
  const router = useRouter();
  const setAuth = useWaterAuthStore((s) => s.setAuth);
  const [orgCode, setOrgCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOrgCode(localStorage.getItem('prapa-org') || '');
    setUsername(localStorage.getItem('prapa-user') || '');
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgCode.trim() || !username.trim() || !password) return;
    setLoading(true);
    try {
      const { data } = await api.post('/water/auth/login', { orgCode: orgCode.trim(), username: username.trim(), password });
      const d = data.data;
      setAuth(d.user, d.accessToken);
      localStorage.setItem('prapa-org', orgCode.trim());
      localStorage.setItem('prapa-user', username.trim());
      router.replace('/prapa');
    } catch (err) {
      toast.error(getErrorMessage(err, 'เข้าระบบไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-5">
      <div className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/login/prapa-bg.jpg')" }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-slate-50/88 backdrop-blur-[1px]" aria-hidden="true" />

      <div className="relative w-full max-w-3xl cz-anim-up">
        <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-2">
          {/* แผงแบรนด์ สีฟ้า + โลโก้ประปา */}
          <div className="hidden flex-col items-center justify-center gap-6 bg-sky-600 p-8 text-white lg:flex">
            <div className="rounded-2xl bg-white px-7 py-6 shadow-lg">
              <img src="/prapa/logo.png" alt="ระบบบริหารจัดการประปา" className="w-full max-w-[230px]" />
            </div>
            <p className="text-xs text-white/70">อบต. ออนไลน์ · บริหารจัดการ เก็บค่าน้ำ และรายงานครบวงจร</p>
          </div>

          {/* ฟอร์ม */}
          <div className="p-8">
            {/* โลโก้บนมือถือ (แผงซ้ายซ่อน) */}
            <img src="/prapa/logo.png" alt="ระบบบริหารจัดการประปา" className="mx-auto mb-6 w-full max-w-[210px] lg:hidden" />
            <h2 className="text-lg font-semibold text-slate-900">เข้าสู่ระบบประปา</h2>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="org" className="block text-sm font-medium text-slate-700">รหัสองค์กร</label>
                <input id="org" className={inputCls} placeholder="รหัสองค์กร" value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value)} autoFocus={!orgCode} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="user" className="block text-sm font-medium text-slate-700">ชื่อผู้ใช้</label>
                <input id="user" className={inputCls} placeholder="ชื่อผู้ใช้" value={username}
                  onChange={(e) => setUsername(e.target.value)} autoFocus={!!orgCode && !username} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pass" className="block text-sm font-medium text-slate-700">รหัสผ่าน</label>
                <div className="relative">
                  <input id="pass" type={show ? 'text' : 'password'} className={`${inputCls} pr-10`} placeholder="••••••••"
                    value={password} autoFocus={!!orgCode && !!username} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-sky-600" />
                จำฉันไว้
              </label>
              <button type="submit" disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'กำลังเข้าระบบ...' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
