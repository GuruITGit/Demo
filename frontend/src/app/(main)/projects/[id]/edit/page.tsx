'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { ProposalForm, normalizeProposal, type Proposal } from '@/components/shared/proposal-form';

const STATUSES = ['แผน', 'ดำเนินการ', 'เสร็จสิ้น', 'ยกเลิก'];
const d10 = (v: any) => (v ? String(v).slice(0, 10) : '');
const str = (v: any) => (v == null ? '' : String(v));

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const [form, setForm] = useState({
    title: '', description: '', strategy: '', fiscalYear: new Date().getFullYear() + 543,
    budgetAmount: '', actualAmount: '', targetGroup: '', expectedOutput: '',
    startDate: '', endDate: '', progressPct: '0', status: 'แผน', departmentId: '', projectManagerId: '',
  });
  const [proposal, setProposal] = useState<Proposal>(normalizeProposal(null));

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: async () => { const { data } = await api.get(`/projects/${id}`); return data.data; },
  });

  useEffect(() => {
    if (!project) return;
    setForm({
      title: str(project.title), description: str(project.description), strategy: str(project.strategy),
      fiscalYear: Number(project.fiscalYear) || new Date().getFullYear() + 543,
      budgetAmount: str(project.budgetAmount), actualAmount: str(project.actualAmount),
      targetGroup: str(project.targetGroup), expectedOutput: str(project.expectedOutput),
      startDate: d10(project.startDate), endDate: d10(project.endDate),
      progressPct: str(project.progressPct ?? 0), status: str(project.status) || 'แผน',
      departmentId: str(project.departmentId), projectManagerId: str(project.projectManagerId),
    });
    setProposal(normalizeProposal(project.proposal));
  }, [project]);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const { data } = await api.get(`/organizations/${me?.organizationId}/departments`); return (data.data ?? data) as any[]; },
    enabled: !!me?.organizationId,
  });
  const { data: employees } = useQuery({
    queryKey: ['employees-simple'],
    queryFn: async () => { const { data } = await api.get('/hr/employees', { params: { limit: 200 } }); return (data.data ?? []) as any[]; },
  });

  function set(k: string, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  const save = useMutation({
    mutationFn: (body: typeof form) => api.put(`/projects/${id}`, {
      ...body,
      budgetAmount: body.budgetAmount ? Number(body.budgetAmount) : 0,
      actualAmount: body.actualAmount ? Number(body.actualAmount) : null,
      progressPct: Number(body.progressPct) || 0,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      departmentId: body.departmentId || null,
      projectManagerId: body.projectManagerId || null,
      proposal,
    }),
    onSuccess: () => { toast.success('บันทึกการแก้ไขสำเร็จ'); router.push(`/projects/${id}`); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.budgetAmount) { toast.error('กรุณากรอกข้อมูลที่จำเป็น'); return; }
    save.mutate(form);
  };

  const sel = 'w-full h-10 border border-input bg-background px-3 rounded-md text-sm';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1.5';
  const ta = 'w-full border border-input bg-background px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none';

  if (isLoading) return <div className="flex flex-col h-full"><Header title="แก้ไขโครงการ" /><div className="p-6 animate-pulse"><div className="h-40 bg-gray-100 rounded" /></div></div>;

  return (
    <div className="flex flex-col h-full">
      <Header title="แก้ไขโครงการ" />
      <div className="flex-1 overflow-y-auto p-6">
        <PageHeader title="แก้ไขโครงการ" subtitle="ปรับปรุงรายละเอียดโครงการ">
          <Link href={`/projects/${id}`}><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" />ย้อนกลับ</Button></Link>
        </PageHeader>

        <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">ข้อมูลโครงการ</h3>
            <div>
              <label className={lbl}>ชื่อโครงการ <span className="text-red-500">*</span></label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} required />
            </div>
            <div>
              <label className={lbl}>ยุทธศาสตร์ / แผนงาน</label>
              <Input value={form.strategy} onChange={(e) => set('strategy', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>รายละเอียด</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className={ta} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>หน่วยงานรับผิดชอบ</label>
                <select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} className={sel}>
                  <option value="">เลือกหน่วยงาน</option>
                  {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>ผู้รับผิดชอบโครงการ</label>
                <select value={form.projectManagerId} onChange={(e) => set('projectManagerId', e.target.value)} className={sel}>
                  <option value="">เลือกผู้รับผิดชอบ</option>
                  {employees?.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.title}{emp.firstNameTh} {emp.lastNameTh}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">งบประมาณและระยะเวลา</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>งบประมาณ (บาท) <span className="text-red-500">*</span></label>
                <Input type="number" value={form.budgetAmount} onChange={(e) => set('budgetAmount', e.target.value)} min={0} step="0.01" required />
              </div>
              <div>
                <label className={lbl}>เบิกจ่ายจริง (บาท)</label>
                <Input type="number" value={form.actualAmount} onChange={(e) => set('actualAmount', e.target.value)} min={0} step="0.01" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>ปีงบประมาณ</label>
                <Input type="number" value={form.fiscalYear} onChange={(e) => set('fiscalYear', Number(e.target.value))} min={2560} max={2599} />
              </div>
              <div>
                <label className={lbl}>สถานะโครงการ</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)} className={sel}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>วันเริ่มต้น</label>
                <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>วันสิ้นสุด</label>
                <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={lbl}>ความก้าวหน้า (%)</label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={100} value={form.progressPct} onChange={(e) => set('progressPct', e.target.value)} className="flex-1" />
                <span className="text-sm font-semibold text-blue-700 w-12 text-right">{form.progressPct}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">ผลผลิตและกลุ่มเป้าหมาย</h3>
            <div>
              <label className={lbl}>กลุ่มเป้าหมาย</label>
              <Input value={form.targetGroup} onChange={(e) => set('targetGroup', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>ผลผลิตที่คาดหวัง</label>
              <textarea value={form.expectedOutput} onChange={(e) => set('expectedOutput', e.target.value)} rows={2} className={ta} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">เนื้อหาโครงการ (แบบฟอร์มเสนอโครงการ)</h3>
            <p className="text-xs text-gray-400">แก้ไขในหน้านี้ = แก้ให้ถูกต้อง (ไม่สร้างเวอร์ชันใหม่) — ถ้าต้องการเก็บประวัติให้ใช้ "อัปเดต/เปลี่ยนแผน" ในหน้ารายละเอียด</p>
            <ProposalForm value={proposal} onChange={setProposal} />
          </div>

          <div className="flex gap-3 pb-6">
            <Button type="submit" loading={save.isPending}><Save className="h-4 w-4 mr-1" />บันทึกการแก้ไข</Button>
            <Link href={`/projects/${id}`}><Button type="button" variant="ghost">ยกเลิก</Button></Link>
          </div>
        </form>
      </div>
    </div>
  );
}
