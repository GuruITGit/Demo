'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { FilePicker } from '@/components/shared/file-picker';
import { uploadFiles } from '@/lib/upload';

function countWorkdays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return 0;
  let days = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export default function NewLeavePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    totalDays: '',
    reason: '',
    contactDuring: '',
    delegateId: '',
  });
  const [files, setFiles] = useState<File[]>([]);

  const { data: types } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const { data } = await api.get('/leave/types');
      return (data.data ?? data) as any[];
    },
  });

  const { data: employees } = useQuery({
    queryKey: ['hr-employees-simple'],
    queryFn: async () => {
      const { data } = await api.get('/hr/employees', { params: { limit: 100 } });
      return (data.data ?? []) as any[];
    },
  });

  useEffect(() => {
    if (form.startDate && form.endDate) {
      const days = countWorkdays(form.startDate, form.endDate);
      setForm((p) => ({ ...p, totalDays: String(days) }));
    }
  }, [form.startDate, form.endDate]);

  const create = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await api.post('/leave/requests', {
        ...body,
        totalDays: Number(body.totalDays),
        delegateId: body.delegateId || undefined,
      });
      const reqId = res.data.data?.id || res.data.id;
      if (files.length && reqId) {
        await uploadFiles(files, { bucket: 'documents', refType: 'leave_request', refId: reqId });
      }
      return reqId;
    },
    onSuccess: (reqId: string) => {
      toast.success('ยื่นใบลาสำเร็จ');
      router.push(`/leave/${reqId}`);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'ไม่สามารถยื่นใบลาได้')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leaveTypeId) { toast.error('กรุณาเลือกประเภทการลา'); return; }
    if (!form.startDate || !form.endDate) { toast.error('กรุณาระบุวันที่ลา'); return; }
    if (!form.reason.trim()) { toast.error('กรุณาระบุเหตุผลการลา'); return; }
    if (Number(form.totalDays) <= 0) { toast.error('จำนวนวันลาไม่ถูกต้อง'); return; }
    create.mutate(form);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="ยื่นใบลา" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/leave"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">ยื่นใบลา</h1>
        </div>

        <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />ข้อมูลการลา
            </h2>

            <div>
              <Label>ประเภทการลา<span className="text-red-500 ml-0.5">*</span></Label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.leaveTypeId}
                onChange={(e) => setForm((p) => ({ ...p, leaveTypeId: e.target.value }))}
                required
              >
                <option value="">เลือกประเภทการลา...</option>
                {types?.map((t: any) => <option key={t.id} value={t.id}>{t.nameTh}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>วันที่เริ่มต้น<span className="text-red-500 ml-0.5">*</span></Label>
                <Input type="date" className="mt-1" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} required />
              </div>
              <div>
                <Label>วันที่สิ้นสุด<span className="text-red-500 ml-0.5">*</span></Label>
                <Input type="date" className="mt-1" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} required />
              </div>
            </div>

            <div>
              <Label>จำนวนวันลา (วันทำการ)<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                className="mt-1"
                value={form.totalDays}
                onChange={(e) => setForm((p) => ({ ...p, totalDays: e.target.value }))}
                required
              />
              <p className="text-xs text-gray-400 mt-0.5">ระบบคำนวณวันทำการอัตโนมัติ (ไม่รวมวันหยุดเสาร์-อาทิตย์)</p>
            </div>

            <div>
              <Label>เหตุผลการลา<span className="text-red-500 ml-0.5">*</span></Label>
              <textarea
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="ระบุเหตุผลการลา..."
                required
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ข้อมูลเพิ่มเติม</h2>

            <div>
              <Label>ผู้ปฏิบัติหน้าที่แทน</Label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.delegateId}
                onChange={(e) => setForm((p) => ({ ...p, delegateId: e.target.value }))}
              >
                <option value="">เลือกผู้ปฏิบัติหน้าที่แทน...</option>
                {employees?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.title}{emp.firstNameTh} {emp.lastNameTh}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>ช่องทางติดต่อระหว่างลา</Label>
              <Input
                className="mt-1"
                placeholder="เบอร์โทร / Line ID"
                value={form.contactDuring}
                onChange={(e) => setForm((p) => ({ ...p, contactDuring: e.target.value }))}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2 mb-4">เอกสารแนบ (ถ้ามี)</h2>
            <FilePicker
              value={files}
              onChange={setFiles}
              label="แนบเอกสาร เช่น ใบรับรองแพทย์ / หนังสือราชการ"
              hint="รองรับ PDF, Word, รูปภาพ • ขนาดไม่เกิน 10 MB"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={create.isPending}><Save className="h-4 w-4" />ยื่นใบลา</Button>
            <Link href="/leave"><Button variant="outline" type="button">ยกเลิก</Button></Link>
          </div>
        </form>
      </div>
    </div>
  );
}
