'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { FilePicker } from '@/components/shared/file-picker';
import { uploadFiles } from '@/lib/upload';
import { URGENCY_OPTIONS } from '@/components/shared/status-badge';

const URGENCY = [...URGENCY_OPTIONS];

export default function NewCorrespondencePage() {
  const router = useRouter();
  const { user: me } = useAuthStore();
  const [form, setForm] = useState({
    subject: '',
    body: '',
    senderOrg: '',
    senderName: '',
    docNumber: '',
    docDate: '',
    receivedAt: new Date().toISOString().slice(0, 10),
    urgencyLevel: 'ปกติ',
    receiverDeptId: '',
    assignedTo: '',
    dueDate: '',
  });
  const [files, setFiles] = useState<File[]>([]);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${me?.organizationId}/departments`);
      return (data.data ?? data) as any[];
    },
    enabled: !!me?.organizationId,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data } = await api.get('/users/selectable');
      return (data.data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await api.post('/correspondence/incoming', body);
      const doc = res.data.data ?? res.data;
      if (files.length) {
        await uploadFiles(files, { bucket: 'documents', refType: 'incoming_document', refId: doc.id });
      }
      return doc;
    },
    onSuccess: (doc) => {
      toast.success('รับหนังสือเข้าสำเร็จ');
      router.push(`/correspondence/${doc.id}`);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'ไม่สามารถบันทึกได้')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim()) { toast.error('กรุณาระบุเรื่อง'); return; }
    create.mutate(form);
  };

  const f = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [name]: e.target.value })),
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="รับหนังสือเข้า" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/correspondence"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">รับหนังสือเข้าใหม่</h1>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ข้อมูลหนังสือ</h2>

            <div>
              <Label>เรื่อง<span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" {...f('subject')} required />
            </div>

            <div>
              <Label>ความเร่งด่วน</Label>
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...f('urgencyLevel')}>
                {URGENCY.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>หน่วยงานต้นทาง</Label>
                <Input className="mt-1" placeholder="ชื่อหน่วยงานที่ส่ง" {...f('senderOrg')} />
              </div>
              <div>
                <Label>ชื่อผู้ส่ง</Label>
                <Input className="mt-1" {...f('senderName')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>เลขที่หนังสือ (ต้นเรื่อง)</Label>
                <Input className="mt-1" {...f('docNumber')} />
              </div>
              <div>
                <Label>วันที่ในหนังสือ</Label>
                <Input type="date" className="mt-1" {...f('docDate')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>วันที่รับ</Label>
                <Input type="date" className="mt-1" {...f('receivedAt')} />
              </div>
              <div>
                <Label>กำหนดตอบ</Label>
                <Input type="date" className="mt-1" {...f('dueDate')} />
              </div>
            </div>

            <div>
              <Label>รายละเอียด / ข้อความในหนังสือ</Label>
              <textarea
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
                {...f('body')}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">การมอบหมาย</h2>

            <div>
              <Label>หน่วยงานผู้รับ</Label>
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...f('receiverDeptId')}>
                <option value="">เลือกหน่วยงาน...</option>
                {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
              </select>
            </div>

            <div>
              <Label>ผู้รับผิดชอบ</Label>
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...f('assignedTo')}>
                <option value="">เลือกเจ้าหน้าที่...</option>
                {users?.map((u: any) => <option key={u.id} value={u.id}>{u.fullNameTh || u.titleTh + u.fullNameTh}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2 mb-4">ไฟล์แนบ</h2>
            <FilePicker value={files} onChange={setFiles} />
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={create.isPending}><Save className="h-4 w-4" />บันทึกการรับหนังสือ</Button>
            <Link href="/correspondence"><Button variant="outline" type="button">ยกเลิก</Button></Link>
          </div>
        </form>
      </div>
    </div>
  );
}
