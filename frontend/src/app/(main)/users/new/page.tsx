'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { TitleSelect } from '@/components/shared/title-select';

export default function NewUserPage() {
  const router = useRouter();
  const { user: me, hasRole } = useAuthStore();

  if (!hasRole(['SUPER_ADMIN', 'ADMIN'])) {
    router.replace('/dashboard');
    return null;
  }

  const [form, setForm] = useState({
    titleTh: 'นาย', fullNameTh: '', username: '', phone: '',
    password: '', positionName: '', email: '', departmentId: '',
  });
  const [roleId, setRoleId] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments', 'all'],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${me?.organizationId}/departments?includeHidden=1`);
      return (data.data ?? data) as any[];
    },
    enabled: !!me?.organizationId,
  });

  // ระบบสิทธิ์ใหม่ = เลือกบทบาท (role-based) — ปรับสิทธิ์เฉพาะคนได้ภายหลังในหน้าแก้ไข
  const { data: roles } = useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => (await api.get('/users/roles/list')).data.data as { id: string; name: string; nameTh: string }[],
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(
        Object.entries(form)
          .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
          .filter(([, v]) => v !== '' && v !== null && v !== undefined),
      );
      const res = await api.post('/users', payload);
      return res.data.data?.id ?? (res.data as any).id;
    },
    onSuccess: async (userId) => {
      if (roleId) {
        try { await api.put(`/users/${userId}/role`, { roleId }); } catch {}
      }
      toast.success('สร้างผู้ใช้สำเร็จ');
      router.push(`/users/${userId}`);
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const msg = data?.error?.message || data?.message;
      toast.error(typeof msg === 'string' && msg ? msg : 'ไม่สามารถสร้างผู้ใช้ได้ กรุณาตรวจสอบข้อมูล');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullNameTh.trim()) { toast.error('กรุณาระบุชื่อ-สกุล'); return; }
    if (!form.username.trim()) { toast.error('กรุณาระบุชื่อผู้ใช้'); return; }
    if (form.password.length < 8) { toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    const emailTrimmed = form.email.trim();
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      toast.error('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }
    create.mutate();
  };


  return (
    <div className="flex flex-col h-full">
      <Header title="เพิ่มผู้ใช้" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/users"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">เพิ่มผู้ใช้ใหม่</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
          {/* ข้อมูลพื้นฐาน */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm">ข้อมูลพื้นฐาน</h2>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>คำนำหน้า</Label>
                <TitleSelect value={form.titleTh} onChange={(v) => setForm(p => ({ ...p, titleTh: v }))} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-3">
                <Label>ชื่อ-สกุล<span className="text-red-500 ml-0.5">*</span></Label>
                <Input className="mt-1" value={form.fullNameTh} onChange={e => setForm(p => ({ ...p, fullNameTh: e.target.value }))} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ชื่อผู้ใช้<span className="text-red-500 ml-0.5">*</span></Label>
                <Input className="mt-1" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
              </div>
              <div>
                <Label>รหัสผ่าน<span className="text-red-500 ml-0.5">*</span></Label>
                <Input type="password" className="mt-1" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ตำแหน่ง <span className="text-xs text-gray-400">(พิมพ์อิสระ)</span></Label>
                <Input className="mt-1" placeholder="เช่น ผู้อำนวยการกองช่าง" value={form.positionName} onChange={e => setForm(p => ({ ...p, positionName: e.target.value }))} />
              </div>
              <div>
                <Label>เบอร์โทรศัพท์</Label>
                <Input className="mt-1" placeholder="0812345678" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>กอง/ส่วน</Label>
                <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.departmentId} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))}>
                  <option value="">เลือกกอง...</option>
                  {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
                </select>
              </div>
              <div>
                <Label>อีเมล <span className="text-xs text-gray-400">(ไม่จำเป็น)</span></Label>
                <Input type="email" className="mt-1" placeholder="ถ้าไม่ใส่จะสร้างให้อัตโนมัติ" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>

            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              ระบบจะสร้างข้อมูลพนักงาน (เมนูบุคลากร) พร้อมโควตาวันลาผูกกับบัญชีนี้ให้อัตโนมัติ — แก้ไขรายละเอียด เช่น เลขบัตรประชาชน ได้ภายหลังในเมนูบุคลากร
            </p>
          </div>

          {/* บทบาท/สิทธิ์ (ระบบใหม่ = role-based) */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
              <ShieldCheck className="h-4 w-4 text-blue-500" />บทบาท/สิทธิ์
            </h2>
            <div>
              <Label>บทบาท</Label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">— ยังไม่กำหนดบทบาท —</option>
                {roles?.filter((r) => r.name !== 'SUPER_ADMIN').map((r) => (
                  <option key={r.id} value={r.id}>{r.nameTh || r.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-500">
                สิทธิ์การใช้งานกำหนดตาม “บทบาท” — จัดการบทบาท/สิทธิ์ได้ที่ ตั้งค่าระบบ › บทบาท/สิทธิ์
                · ปรับสิทธิ์เฉพาะบุคคล (เพิ่ม/ลดจากบทบาท) ได้ภายหลังในหน้าแก้ไขผู้ใช้
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={create.isPending}><Save className="h-4 w-4" />สร้างผู้ใช้</Button>
            <Link href="/users"><Button type="button" variant="outline">ยกเลิก</Button></Link>
          </div>
        </form>
      </div>
    </div>
  );
}
