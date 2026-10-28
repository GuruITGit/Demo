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
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { FilePicker } from '@/components/shared/file-picker';
import { uploadFiles } from '@/lib/upload';
import { URGENCY_OPTIONS } from '@/components/shared/status-badge';

const URGENCY_LEVELS = [...URGENCY_OPTIONS];

export default function NewOutgoingPage() {
  const router = useRouter();
  const { user: me } = useAuthStore();
  const [form, setForm] = useState({
    subject: '',
    body: '',
    docDate: new Date().toISOString().slice(0, 10),
    recipientName: '',
    recipientOrg: '',
    recipientAddress: '',
    urgencyLevel: 'ปกติ',
    signerId: '',
    departmentId: '',
  });
  const [files, setFiles] = useState<File[]>([]);

  const { data: users } = useQuery({
    queryKey: ['users-simple'],
    queryFn: async () => {
      const { data } = await api.get('/users/selectable');
      return (data.data ?? []) as any[];
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

  function set(k: string, v: any) { setForm((p) => ({ ...p, [k]: v })); }

  const create = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await api.post('/correspondence/outgoing', {
        ...body,
        signerId: body.signerId || undefined,
        departmentId: body.departmentId || undefined,
      });
      const doc = res.data.data ?? res.data;
      if (files.length) {
        await uploadFiles(files, { bucket: 'documents', refType: 'outgoing_document', refId: doc.id });
      }
      return doc;
    },
    onSuccess: (doc) => {
      toast.success('สร้างหนังสือส่งสำเร็จ');
      router.push(`/correspondence/outgoing/${doc.id}`);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'ไม่สามารถสร้างหนังสือส่งได้')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim()) { toast.error('กรุณาระบุเรื่อง'); return; }
    if (!form.body.trim()) { toast.error('กรุณาระบุเนื้อหา'); return; }
    if (!form.recipientName.trim()) { toast.error('กรุณาระบุชื่อผู้รับ'); return; }
    if (!form.docDate) { toast.error('กรุณาระบุวันที่หนังสือ'); return; }
    create.mutate(form);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="ส่งหนังสือใหม่" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/correspondence"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">สร้างหนังสือส่งใหม่</h1>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ข้อมูลหนังสือ</h2>

            <div>
              <Label>เรื่อง<span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" value={form.subject} onChange={(e) => set('subject', e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>วันที่หนังสือ<span className="text-red-500 ml-0.5">*</span></Label>
                <Input type="date" className="mt-1" value={form.docDate} onChange={(e) => set('docDate', e.target.value)} required />
              </div>
              <div>
                <Label>ความเร่งด่วน</Label>
                <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.urgencyLevel} onChange={(e) => set('urgencyLevel', e.target.value)}>
                  {URGENCY_LEVELS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>หน่วยงานที่ออกหนังสือ</Label>
                <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                  <option value="">เลือกหน่วยงาน</option>
                  {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
                </select>
              </div>
              <div>
                <Label>ผู้ลงนาม</Label>
                <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.signerId} onChange={(e) => set('signerId', e.target.value)}>
                  <option value="">เลือกผู้ลงนาม</option>
                  {users?.map((u: any) => <option key={u.id} value={u.id}>{u.displayName || u.fullNameTh || u.username}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>เนื้อหา<span className="text-red-500 ml-0.5">*</span></Label>
              <textarea
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={8}
                value={form.body}
                onChange={(e) => set('body', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ผู้รับหนังสือ</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ชื่อผู้รับ<span className="text-red-500 ml-0.5">*</span></Label>
                <Input className="mt-1" value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} required />
              </div>
              <div>
                <Label>หน่วยงานผู้รับ</Label>
                <Input className="mt-1" value={form.recipientOrg} onChange={(e) => set('recipientOrg', e.target.value)} />
              </div>
            </div>

            <div>
              <Label>ที่อยู่ผู้รับ</Label>
              <textarea
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={form.recipientAddress}
                onChange={(e) => set('recipientAddress', e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2 mb-4">ไฟล์แนบ</h2>
            <FilePicker value={files} onChange={setFiles} />
          </div>

          <div className="pt-2">
            <Button type="submit" loading={create.isPending}><Send className="h-4 w-4" />สร้างหนังสือส่ง</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
