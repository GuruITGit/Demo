'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { TitleSelect } from '@/components/shared/title-select';

const EMP_TYPES = ['ข้าราชการ', 'พนักงานจ้าง', 'ลูกจ้างประจำ', 'ลูกจ้างชั่วคราว', 'พนักงานราชการ'];
const GENDERS = ['', 'ชาย', 'หญิง', 'ไม่ระบุ'];

export default function NewEmployeePage() {
  const router = useRouter();
  const { user: me } = useAuthStore();
  const [form, setForm] = useState({
    title: 'นาย',
    firstNameTh: '',
    lastNameTh: '',
    firstNameEn: '',
    lastNameEn: '',
    employeeCode: '',
    nationalId: '',
    birthDate: '',
    gender: '',
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    positionId: '',
    positionName: '',
    departmentId: '',
    employeeType: 'ข้าราชการ',
    hireDate: '',
    level: '',
    salary: '',
    religion: '',
    userId: '',
  });

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data } = await api.get('/hr/positions');
      return (data.data ?? data) as any[];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', 'all'],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${me?.organizationId}/departments?includeHidden=1`);
      return (data.data ?? data) as any[];
    },
    enabled: !!me?.organizationId,
  });

  // บัญชีผู้ใช้สำหรับผูกกับพนักงาน (บัญชีที่ผูกแล้วเลือกซ้ำไม่ได้)
  const { data: selectableUsers } = useQuery({
    queryKey: ['users-selectable'],
    queryFn: async () => (await api.get('/users/selectable')).data.data as any[],
  });
  const { data: linkedEmployees } = useQuery({
    queryKey: ['hr-employees-linked'],
    queryFn: async () => (await api.get('/hr/employees', { params: { limit: 100 } })).data.data as any[],
  });
  const linkedUserIds = new Set((linkedEmployees ?? []).map((e: any) => e.userId).filter(Boolean));

  const create = useMutation({
    // ตัดฟิลด์ว่างออกก่อนส่ง — DTO ฝั่งหลังบ้าน validate ชนิดข้อมูล ('' ไม่ใช่วันที่/ตัวเลข)
    mutationFn: (body: typeof form) => {
      const payload = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== ''));
      if (!payload.hireDate) payload.hireDate = new Date().toISOString().slice(0, 10);
      return api.post('/hr/employees', payload);
    },
    onSuccess: (res) => {
      toast.success('เพิ่มพนักงานสำเร็จ');
      router.push(`/hr/${res.data.data?.id || res.data.id}`);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'ไม่สามารถบันทึกได้')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstNameTh.trim()) { toast.error('กรุณาระบุชื่อ'); return; }
    if (!form.lastNameTh.trim()) { toast.error('กรุณาระบุนามสกุล'); return; }
    if (!form.nationalId.trim()) { toast.error('กรุณาระบุเลขบัตรประชาชน'); return; }
    create.mutate(form);
  };

  const sel = (name: keyof typeof form, label: string, opts: string[], required = false) => (
    <div>
      <Label>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      <select
        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={form[name] as string}
        onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
      >
        {opts.map((o) => <option key={o} value={o}>{o || '-'}</option>)}
      </select>
    </div>
  );

  const inp = (name: keyof typeof form, label: string, type = 'text', required = false) => (
    <div>
      <Label>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      <Input type={type} className="mt-1" value={form[name] as string} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="เพิ่มพนักงาน" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/hr"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">เพิ่มพนักงานใหม่</h1>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          {/* ข้อมูลส่วนตัว */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ข้อมูลส่วนตัว</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>คำนำหน้า<span className="text-red-500 ml-0.5">*</span></Label>
                <TitleSelect value={form.title as string} onChange={(v) => setForm((p) => ({ ...p, title: v }))} />
              </div>
              {inp('firstNameTh', 'ชื่อ (ไทย)', 'text', true)}
              {inp('lastNameTh', 'สกุล (ไทย)', 'text', true)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {inp('firstNameEn', 'First Name')}
              {inp('lastNameEn', 'Last Name')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {inp('nationalId', 'เลขบัตรประชาชน (13 หลัก)', 'text', true)}
              {inp('birthDate', 'วันเกิด', 'date')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {sel('gender', 'เพศ', GENDERS)}
              {inp('phone', 'โทรศัพท์')}
            </div>
            {inp('religion', 'ศาสนา')}
            <div>
              <Label>ที่อยู่</Label>
              <textarea
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {inp('emergencyContact', 'ผู้ติดต่อฉุกเฉิน')}
              {inp('emergencyPhone', 'โทรฉุกเฉิน')}
            </div>
          </div>

          {/* ข้อมูลการทำงาน */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ข้อมูลการทำงาน</h2>
            {inp('employeeCode', 'รหัสพนักงาน')}

            <div>
              <Label>บัญชีผู้ใช้ในระบบ</Label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.userId}
                onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
              >
                <option value="">ไม่ผูกบัญชี...</option>
                {selectableUsers?.map((u: any) => (
                  <option key={u.id} value={u.id} disabled={linkedUserIds.has(u.id)}>
                    {u.titleTh || ''}{u.fullNameTh} ({u.username}){linkedUserIds.has(u.id) ? ' — ผูกแล้ว' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-0.5">ผูกกับบัญชีที่ใช้เข้าระบบ เพื่อให้ยื่นใบลา/เห็นโควตาวันลาของตัวเองได้</p>
            </div>

            <div>
              <Label>หน่วยงาน / กอง</Label>
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.departmentId} onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}>
                <option value="">เลือกหน่วยงาน...</option>
                {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
              </select>
            </div>

            <div>
              <Label>ตำแหน่ง</Label>
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.positionId} onChange={(e) => setForm((p) => ({ ...p, positionId: e.target.value }))}>
                <option value="">เลือกตำแหน่ง...</option>
                {positions?.map((p: any) => <option key={p.id} value={p.id}>{p.nameTh}</option>)}
              </select>
            </div>

            <div>
              <Label>ประเภทพนักงาน</Label>
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.employeeType} onChange={(e) => setForm((p) => ({ ...p, employeeType: e.target.value }))}>
                {EMP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {inp('hireDate', 'วันที่เริ่มงาน', 'date')}
              {inp('level', 'ระดับ/ชั้น')}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {inp('salary', 'เงินเดือน (บาท)', 'number')}
              {inp('positionName', 'ชื่อตำแหน่ง (เพิ่มเติม)')}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={create.isPending}><Save className="h-4 w-4" />บันทึก</Button>
            <Link href="/hr"><Button variant="outline" type="button">ยกเลิก</Button></Link>
          </div>
        </form>
      </div>
    </div>
  );
}
