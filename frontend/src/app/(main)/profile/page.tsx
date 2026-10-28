'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { User, Building2, Save, Shield, Camera, Clock, Monitor, CalendarClock, Activity, PenLine } from 'lucide-react';
import { formatThaiDateTime } from '@/lib/utils';
import { uploadFiles } from '@/lib/upload';
import { TitleSelect } from '@/components/shared/title-select';

/** แปลง User-Agent เป็นชื่ออุปกรณ์/เบราว์เซอร์ที่อ่านง่าย */
function parseUA(ua?: string): string {
  const s = ua || '';
  if (!s) return 'ไม่ทราบอุปกรณ์';
  const os = /Windows/i.test(s) ? 'Windows'
    : /iPhone/i.test(s) ? 'iPhone'
    : /iPad/i.test(s) ? 'iPad'
    : /Android/i.test(s) ? 'Android'
    : /Mac OS X|Macintosh/i.test(s) ? 'Mac'
    : /Linux/i.test(s) ? 'Linux' : '';
  const browser = /Edg\//i.test(s) ? 'Edge'
    : /OPR\/|Opera/i.test(s) ? 'Opera'
    : /Chrome\//i.test(s) ? 'Chrome'
    : /Firefox\//i.test(s) ? 'Firefox'
    : /Safari\//i.test(s) ? 'Safari' : '';
  return [browser, os].filter(Boolean).join(' · ') || 'อุปกรณ์อื่น';
}

/** ป้ายกิจกรรม (audit action → ไทย) */
const ACTION_LABEL: Record<string, string> = {
  CREATE: 'สร้างสารบรรณ', UPDATE: 'แก้ไข', DELETE: 'ลบ',
  FORWARD: 'เสนอจ่าย/ส่งต่อ', COMPLETE: 'อนุมัติปิดงาน', RETURN_DOC: 'ตีกลับ',
  REQUEST_RETURN: 'ขอคืน', REQUEST_EDIT: 'ขอแก้ไข', RECEIVE: 'รับเอกสาร', purge: 'ล้างข้อมูล',
};
const actionLabel = (a: string) => ACTION_LABEL[a] || a;

export default function ProfilePage() {
  const { user: storeUser, setAuth, accessToken, refreshToken } = useAuthStore();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      return data.data;
    },
  });

  // ประวัติการเข้าสู่ระบบล่าสุด (ความปลอดภัย)
  const { data: loginHistory } = useQuery({
    queryKey: ['auth', 'login-history'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me/login-history');
      return (data.data ?? data) as { id: string; ipAddress?: string; userAgent?: string; actedAt: string }[];
    },
  });

  // ── หน้าของฉัน (personal hub) ──
  const pick = (raw: any) => raw?.data ?? raw ?? [];
  const { data: activity } = useQuery({
    queryKey: ['me-activity'],
    queryFn: async () => pick((await api.get('/auth/me/activity')).data) as any[],
  });
  const { data: mySignings } = useQuery({
    queryKey: ['me-signings'],
    queryFn: async () => { try { return pick((await api.get('/correspondence/tickets/signatures/my')).data) as any[]; } catch { return []; } },
  });
  const { data: myMeetings } = useQuery({
    queryKey: ['me-meetings'],
    queryFn: async () => { try { return pick((await api.get('/meetings/my')).data) as any[]; } catch { return []; } },
  });
  const { data: myLeave } = useQuery({
    queryKey: ['me-leave'],
    queryFn: async () => { try { return pick((await api.get('/leave/requests/my')).data) as any[]; } catch { return []; } },
  });

  const [form, setForm] = useState({ titleTh: '', fullNameTh: '', fullNameEn: '', phone: '' });

  useEffect(() => {
    if (me) {
      setForm({
        titleTh: me.titleTh || '',
        fullNameTh: me.fullNameTh || '',
        fullNameEn: me.fullNameEn || '',
        phone: me.phone || '',
      });
    }
  }, [me]);

  const save = useMutation({
    mutationFn: (body: typeof form) => api.patch('/auth/me', body),
    onSuccess: async () => {
      toast.success('บันทึกข้อมูลสำเร็จ');
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      try {
        const { data } = await api.get('/auth/me');
        const updated = data.data;
        if (updated && accessToken && refreshToken) {
          setAuth({ id: updated.id, username: updated.username, email: updated.email, fullNameTh: updated.fullNameTh, fullNameEn: updated.fullNameEn, titleTh: updated.titleTh, avatarUrl: updated.avatarUrl, organizationId: updated.organizationId, departmentId: updated.departmentId, positionName: updated.positionName, roles: updated.roles, permissions: updated.permissions }, accessToken, refreshToken);
        }
      } catch {}
    },
    onError: () => toast.error('ไม่สามารถบันทึกได้'),
  });

  // อัปโหลดรูปโปรไฟล์
  const refreshMeToStore = async () => {
    try {
      const { data } = await api.get('/auth/me');
      const u = data.data;
      if (u && accessToken && refreshToken) {
        setAuth({ id: u.id, username: u.username, email: u.email, fullNameTh: u.fullNameTh, fullNameEn: u.fullNameEn, titleTh: u.titleTh, avatarUrl: u.avatarUrl, organizationId: u.organizationId, departmentId: u.departmentId, positionName: u.positionName, roles: u.roles, permissions: u.permissions }, accessToken, refreshToken);
      }
    } catch {}
  };
  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const [up] = await uploadFiles([file], { bucket: 'avatars', refType: 'avatar', refId: me?.id });
      await api.patch('/auth/me', { avatarUrl: up.url });
      return up.url;
    },
    onSuccess: async () => { toast.success('อัปเดตรูปโปรไฟล์แล้ว'); qc.invalidateQueries({ queryKey: ['auth', 'me'] }); await refreshMeToStore(); },
    onError: () => toast.error('อัปโหลดรูปไม่สำเร็จ'),
  });
  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadAvatar.mutate(f); };

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const changePw = useMutation({
    mutationFn: (body: typeof pwForm) => api.put('/auth/me/password', { currentPassword: body.currentPassword, newPassword: body.newPassword }),
    onSuccess: () => {
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: () => toast.error('รหัสผ่านปัจจุบันไม่ถูกต้อง'),
  });

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    if (pwForm.newPassword.length < 8) { toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    changePw.mutate(pwForm);
  };

  // "กำลังจะถึง" = นัดประชุม + การลา (อนุมัติแล้ว) เรียงตามวันที่
  const todayStart = new Date(new Date().toDateString());
  const agenda = [
    ...(myMeetings || []).map((m: any) => ({ id: 'mt-' + m.id, kind: 'ประชุม' as const, date: m.startDatetime, title: m.title, sub: m.isOnline ? 'ออนไลน์' : (m.location || '') })),
    ...(myLeave || [])
      .filter((l: any) => l.status === 'อนุมัติแล้ว' && (l.endDate || l.startDate) && new Date(l.endDate || l.startDate) >= todayStart)
      .map((l: any) => ({ id: 'lv-' + l.id, kind: 'ลา' as const, date: l.startDate || l.endDate, title: (l.leaveType?.nameTh || l.leaveTypeName || 'การลา'), sub: l.endDate && l.startDate !== l.endDate ? `ถึง ${formatThaiDateTime(l.endDate)}` : '' })),
  ].filter((x) => x.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 8);

  if (!me) return <div className="flex flex-col h-full"><Header title="โปรไฟล์" /><div className="p-6"><div className="animate-pulse h-40 bg-gray-100 rounded-xl" /></div></div>;

  return (
    <div className="flex flex-col h-full">
      <Header title="โปรไฟล์" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <PageHeader title="ข้อมูลส่วนตัว" subtitle="จัดการข้อมูลส่วนตัวและรหัสผ่าน" />

        {/* Profile header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex items-center gap-4">
          <label className="relative w-16 h-16 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center text-2xl font-bold text-white shrink-0 cursor-pointer group" title="เปลี่ยนรูปโปรไฟล์">
            {me.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={me.avatarUrl} alt="รูปโปรไฟล์" className="w-full h-full object-cover" />
              : <span>{me.fullNameTh?.charAt(0)}</span>}
            <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="h-5 w-5 text-white" />
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} disabled={uploadAvatar.isPending} />
          </label>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{me.titleTh}{me.fullNameTh}</h2>
            <p className="text-sm text-gray-500">{me.positionName}</p>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-400">{me.department?.nameTh}</span>
              {me.roles?.map((r: string) => (
                <span key={r} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{r}</span>
              ))}
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-400">เข้าสู่ระบบล่าสุด</p>
            <p className="text-xs text-gray-600">{me.lastLoginAt ? formatThaiDateTime(me.lastLoginAt) : '-'}</p>
            <p className="text-xs text-gray-400 mt-1">{me.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Edit profile */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900 text-sm">แก้ไขข้อมูลส่วนตัว</h3>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="space-y-3">
              <div>
                <Label>คำนำหน้า</Label>
                <TitleSelect value={form.titleTh} onChange={(v) => setForm((p) => ({ ...p, titleTh: v }))} />
              </div>
              <div>
                <Label>ชื่อ-สกุล (ภาษาไทย)</Label>
                <Input className="mt-1" value={form.fullNameTh} onChange={(e) => setForm((p) => ({ ...p, fullNameTh: e.target.value }))} required />
              </div>
              <div>
                <Label>Full Name (English)</Label>
                <Input className="mt-1" value={form.fullNameEn} onChange={(e) => setForm((p) => ({ ...p, fullNameEn: e.target.value }))} />
              </div>
              <div>
                <Label>เบอร์โทรศัพท์</Label>
                <Input className="mt-1" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <Button type="submit" loading={save.isPending}><Save className="h-4 w-4" />บันทึก</Button>
            </form>
          </div>

          {/* Change password */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900 text-sm">เปลี่ยนรหัสผ่าน</h3>
            </div>
            <form onSubmit={handlePwSubmit} className="space-y-3">
              <div>
                <Label>รหัสผ่านปัจจุบัน</Label>
                <Input type="password" className="mt-1" value={pwForm.currentPassword} onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))} required />
              </div>
              <div>
                <Label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</Label>
                <Input type="password" className="mt-1" value={pwForm.newPassword} onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))} required />
              </div>
              <div>
                <Label>ยืนยันรหัสผ่านใหม่</Label>
                <Input type="password" className="mt-1" value={pwForm.confirmPassword} onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))} required />
              </div>
              <Button type="submit" loading={changePw.isPending}><Shield className="h-4 w-4" />เปลี่ยนรหัสผ่าน</Button>
            </form>
          </div>
        </div>

        {/* Account info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">ข้อมูลบัญชี</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">ชื่อผู้ใช้</p>
              <p className="font-mono font-medium text-gray-900">{me.username}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">อีเมล</p>
              <p className="text-gray-900">{me.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">สร้างบัญชีเมื่อ</p>
              <p className="text-gray-900">{formatThaiDateTime(me.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">สถานะ</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${me.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {me.isActive ? 'ใช้งาน' : 'ระงับ'}
              </span>
            </div>
          </div>
        </div>

        {/* ประวัติการเข้าสู่ระบบ (ความปลอดภัย) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900 text-sm">ประวัติการเข้าสู่ระบบล่าสุด</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">ถ้าพบการเข้าใช้ที่ไม่ใช่คุณ ควรเปลี่ยนรหัสผ่านทันที</p>
          {!loginHistory ? (
            <p className="text-sm text-gray-400">กำลังโหลด...</p>
          ) : loginHistory.length === 0 ? (
            <p className="text-sm text-gray-400">ยังไม่มีประวัติการเข้าสู่ระบบ</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {loginHistory.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3 py-2 text-sm">
                  <Monitor className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-800">
                      {parseUA(h.userAgent)}
                      {i === 0 && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">ล่าสุด</span>}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">{h.ipAddress || 'ไม่ทราบ IP'}</p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{formatThaiDateTime(h.actedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* หน้าของฉัน: กำลังจะถึง + กิจกรรมล่าสุด */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-4 w-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900 text-sm">กำลังจะถึง</h3>
            </div>
            {agenda.length === 0 ? (
              <p className="text-sm text-gray-400">ไม่มีนัดประชุม/การลาที่กำลังจะถึง</p>
            ) : (
              <div className="space-y-2">
                {agenda.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${a.kind === 'ประชุม' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{a.kind}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-800 truncate">{a.title}</p>
                      <p className="text-xs text-gray-400">{formatThaiDateTime(a.date)}{a.sub ? ` · ${a.sub}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900 text-sm">กิจกรรมล่าสุดของฉัน</h3>
            </div>
            {!activity || activity.length === 0 ? (
              <p className="text-sm text-gray-400">ยังไม่มีกิจกรรม</p>
            ) : (
              <div className="space-y-2">
                {activity.slice(0, 8).map((a: any) => (
                  <div key={a.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-800"><span className="font-medium">{actionLabel(a.action)}</span>{a.resourceTitle ? <span className="text-gray-600"> · {a.resourceTitle}</span> : ''}</p>
                      <p className="text-xs text-gray-400">{formatThaiDateTime(a.actedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ประวัติการลงนามของฉัน */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <PenLine className="h-4 w-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900 text-sm">ประวัติการลงนามของฉัน</h3>
          </div>
          {!mySignings || mySignings.length === 0 ? (
            <p className="text-sm text-gray-400">ยังไม่มีประวัติการลงนาม</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {mySignings.slice(0, 10).map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 py-2 text-sm">
                  <PenLine className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-800 truncate">{s.subject}</p>
                    <p className="text-xs text-gray-400"><span className="font-mono">{s.ticketNumber}</span> · {actionLabel(s.action)}</p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{formatThaiDateTime(s.signedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
