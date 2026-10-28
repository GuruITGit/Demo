'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { hubLoginAction } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

/**
 * ล็อกอินคอนโซลเจ้าของระบบ — คนละประตูกับเว็บของ อบต. โดยตั้งใจ
 * ไม่มีช่อง "รหัสองค์กร" เพราะเจ้าของระบบไม่ได้สังกัด อบต. ใด (backend รับเฉพาะบัญชี SUPER_ADMIN)
 */
export default function HubLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await hubLoginAction(username.trim(), password);
      router.replace('/hub');
    } catch (err) {
      setError(getErrorMessage(err, 'เข้าสู่ระบบไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800">
            <ShieldCheck className="h-6 w-6 text-slate-300" />
          </span>
          <h1 className="text-lg font-semibold text-white">คอนโซลผู้ดูแลระบบ</h1>
          <p className="mt-1 text-sm text-slate-400">Smart SAO · สำหรับเจ้าของระบบเท่านั้น</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-6">
          <div>
            <Label className="mb-1.5 block text-xs text-slate-300">ชื่อผู้ใช้</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="border-slate-600 bg-slate-900 text-white placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-slate-300">รหัสผ่าน</Label>
            <div className="relative">
              <Input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="border-slate-600 bg-slate-900 pr-10 text-white placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                title={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <Button type="submit" loading={loading} disabled={!username.trim() || !password} className="w-full">
            เข้าสู่ระบบ
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          เจ้าหน้าที่ อบต. ให้เข้าที่เว็บของหน่วยงานตัวเอง ไม่ใช่หน้านี้
        </p>
      </div>
    </div>
  );
}
