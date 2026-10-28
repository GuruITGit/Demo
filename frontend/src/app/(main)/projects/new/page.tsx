'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { ProposalForm, EMPTY_PROPOSAL, type Proposal } from '@/components/shared/proposal-form';

const CURRENT_YEAR = new Date().getFullYear() + 543;

export default function ProjectNewPage() {
  const router = useRouter();
  const { user: me } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    strategy: '',
    fiscalYear: CURRENT_YEAR,
    deptId: '',
    budgetAmount: 0,
    startDate: '',
    endDate: '',
  });
  const [p, setP] = useState<Proposal>(EMPTY_PROPOSAL);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${me?.organizationId}/departments`);
      return (data.data ?? data) as any[];
    },
    enabled: !!me?.organizationId,
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) { toast.error('กรุณากรอกชื่อโครงการ'); return; }
    setSaving(true);
    try {
      await api.post('/projects', {
        ...form,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        deptId: form.deptId || undefined,
        proposal: p,
      });
      toast.success('สร้างโครงการสำเร็จ');
      router.push('/projects');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="สร้างโครงการ" />
      <div className="flex-1 overflow-y-auto p-6">
        <PageHeader title="สร้างโครงการใหม่" subtitle="กรอกตามแบบฟอร์มเสนอโครงการ">
          <Link href="/projects"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" />ย้อนกลับ</Button></Link>
        </PageHeader>

        <form onSubmit={handleSubmit} className="mt-6 max-w-3xl space-y-5">
          {/* ── ข้อมูลทั่วไป (meta) ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">ข้อมูลทั่วไป</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อโครงการ <span className="text-red-500">*</span></label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="โครงการ..." required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ยุทธศาสตร์ / แผนงาน</label>
              <Input value={form.strategy} onChange={(e) => set('strategy', e.target.value)} placeholder="เช่น ยุทธศาสตร์การพัฒนาโครงสร้างพื้นฐาน" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">หน่วยงานรับผิดชอบ</label>
                <select value={form.deptId} onChange={(e) => set('deptId', e.target.value)} className="w-full h-10 border border-input bg-background px-3 rounded-md text-sm">
                  <option value="">เลือกหน่วยงาน</option>
                  {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ปีงบประมาณ (พ.ศ.)</label>
                <Input type="number" value={form.fiscalYear} onChange={(e) => set('fiscalYear', Number(e.target.value))} min={2560} max={2599} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">วันเริ่มต้น</label>
                <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">วันสิ้นสุด</label>
                <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">งบประมาณ (บาท)</label>
                <Input type="number" value={form.budgetAmount} onChange={(e) => set('budgetAmount', Number(e.target.value))} min={0} />
              </div>
            </div>
          </div>

          {/* ── เนื้อหาแบบฟอร์มโครงการ 10 หัวข้อ ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">เนื้อหาโครงการ (แบบฟอร์มเสนอโครงการ)</h3>
            <ProposalForm value={p} onChange={setP} />
          </div>

          <div className="flex gap-3 pb-6">
            <Button type="submit" disabled={saving} className="flex-1 sm:flex-none">
              <Save className="h-4 w-4 mr-1" />{saving ? 'กำลังบันทึก...' : 'สร้างโครงการ'}
            </Button>
            <Link href="/projects"><Button type="button" variant="outline">ยกเลิก</Button></Link>
          </div>
        </form>
      </div>
    </div>
  );
}
