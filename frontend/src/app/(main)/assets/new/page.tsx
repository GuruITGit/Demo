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
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';

export default function NewAssetPage() {
  const router = useRouter();
  const { user: me } = useAuthStore();
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    assetCode: '',
    serialNumber: '',
    brand: '',
    model: '',
    supplier: '',
    purchaseDate: '',
    purchasePrice: '',
    warrantyExpire: '',
    currentValue: '',
    depreciationRate: '',
    location: '',
    departmentId: '',
    custodianId: '',
    description: '',
    status: 'ใช้งาน',
  });

  const { data: categories } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: async () => {
      const { data } = await api.get('/assets/categories');
      return (data.data ?? data) as any[];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${me?.organizationId}/departments`);
      return (data.data ?? data) as any[];
    },
    enabled: !!me?.organizationId,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-simple'],
    queryFn: async () => {
      const { data } = await api.get('/hr/employees', { params: { limit: 200 } });
      return (data.data ?? []) as any[];
    },
  });

  function set(k: string, v: any) { setForm((p) => ({ ...p, [k]: v })); }

  const create = useMutation({
    mutationFn: (body: typeof form) => api.post('/assets', {
      ...body,
      purchasePrice: body.purchasePrice ? Number(body.purchasePrice) : undefined,
      currentValue: body.currentValue ? Number(body.currentValue) : undefined,
      depreciationRate: body.depreciationRate ? Number(body.depreciationRate) : undefined,
      warrantyExpire: body.warrantyExpire || undefined,
      departmentId: body.departmentId || undefined,
      custodianId: body.custodianId || undefined,
      categoryId: body.categoryId || undefined,
    }),
    onSuccess: (res) => {
      toast.success('บันทึกครุภัณฑ์สำเร็จ');
      router.push(`/assets/${res.data.data?.id || res.data.id}`);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'ไม่สามารถบันทึกได้')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('กรุณาระบุชื่อครุภัณฑ์'); return; }
    create.mutate(form);
  };

  const STATUSES = ['ใช้งาน', 'เก็บรักษา', 'ซ่อมแซม', 'ชำรุด', 'จำหน่าย'];

  return (
    <div className="flex flex-col h-full">
      <Header title="เพิ่มครุภัณฑ์" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/assets"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">เพิ่มครุภัณฑ์ใหม่</h1>
        </div>

        <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ข้อมูลพื้นฐาน</h2>

            <div>
              <Label>ชื่อครุภัณฑ์<span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ประเภท</Label>
                <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">เลือกประเภท...</option>
                  {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.nameTh}</option>)}
                </select>
              </div>
              <div>
                <Label>สถานะ</Label>
                <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>รหัสครุภัณฑ์</Label>
              <Input className="mt-1 font-mono" placeholder="ระบบจะสร้างให้อัตโนมัติ หากไม่ระบุ" value={form.assetCode} onChange={(e) => set('assetCode', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ยี่ห้อ</Label>
                <Input className="mt-1" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
              </div>
              <div>
                <Label>รุ่น</Label>
                <Input className="mt-1" value={form.model} onChange={(e) => set('model', e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Serial No.</Label>
              <Input className="mt-1 font-mono" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ข้อมูลการจัดซื้อ</h2>

            <div>
              <Label>ผู้ขาย / ผู้จัดจำหน่าย</Label>
              <Input className="mt-1" placeholder="ชื่อบริษัท/ร้านค้า" value={form.supplier} onChange={(e) => set('supplier', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>วันที่จัดซื้อ</Label>
                <Input type="date" className="mt-1" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
              </div>
              <div>
                <Label>ราคาจัดซื้อ (บาท)</Label>
                <Input type="number" className="mt-1" value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} min={0} step="0.01" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>มูลค่าปัจจุบัน (บาท)</Label>
                <Input type="number" className="mt-1" value={form.currentValue} onChange={(e) => set('currentValue', e.target.value)} min={0} step="0.01" />
              </div>
              <div>
                <Label>อัตราค่าเสื่อมราคา (%/ปี)</Label>
                <Input type="number" className="mt-1" value={form.depreciationRate} onChange={(e) => set('depreciationRate', e.target.value)} min={0} max={100} step="0.01" />
              </div>
            </div>

            <div>
              <Label>วันหมดประกัน</Label>
              <Input type="date" className="mt-1 max-w-xs" value={form.warrantyExpire} onChange={(e) => set('warrantyExpire', e.target.value)} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">สถานที่และผู้รับผิดชอบ</h2>

            <div>
              <Label>สถานที่จัดเก็บ</Label>
              <Input className="mt-1" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="เช่น ห้องสำนักงาน ชั้น 2" />
            </div>

            <div>
              <Label>หน่วยงานที่ครอบครอง</Label>
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                <option value="">เลือกหน่วยงาน</option>
                {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
              </select>
            </div>

            <div>
              <Label>ผู้รับผิดชอบ/ผู้ดูแล</Label>
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.custodianId} onChange={(e) => set('custodianId', e.target.value)}>
                <option value="">เลือกผู้รับผิดชอบ</option>
                {employees?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.title}{emp.firstNameTh} {emp.lastNameTh}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>รายละเอียดเพิ่มเติม</Label>
              <textarea className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" loading={create.isPending}><Save className="h-4 w-4" />บันทึกครุภัณฑ์</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
