'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { PeoplePicker } from '@/components/shared/people-picker';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Video, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { FilePicker } from '@/components/shared/file-picker';
import { uploadFiles } from '@/lib/upload';

const MEETING_TYPES = ['ประชุมทั่วไป', 'ประชุมคณะกรรมการ', 'ประชุมสภา', 'อบรม/สัมมนา', 'อื่นๆ'];

interface AgendaDraft { title: string; description: string }
interface Attendee { id: string; name: string }

export default function NewMeetingPage() {
  const router = useRouter();
  const { user: me } = useAuthStore();
  const [form, setForm] = useState({
    title: '',
    type: 'ประชุมทั่วไป',
    startDatetime: '',
    endDatetime: '',
    location: '',
    isOnline: false,
    meetingUrl: '',
    chairId: me?.id ?? '',
    secretaryId: '',
    departmentId: '',
  });
  const [agenda, setAgenda] = useState<AgendaDraft[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${me?.organizationId}/departments`);
      return (data.data ?? data) as any[];
    },
    enabled: !!me?.organizationId,
  });

  function set(k: string, v: any) { setForm((p) => ({ ...p, [k]: v })); }

  const addAttendee = (id: string, user?: { titleTh?: string; fullNameTh?: string; positionName?: string }) => {
    if (!id || attendees.some((a) => a.id === id)) return;
    const name = `${user?.titleTh || ''}${user?.fullNameTh || ''}`.trim() || 'ผู้ใช้';
    setAttendees((prev) => [...prev, { id, name }]);
  };

  const create = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await api.post('/meetings', {
        ...body,
        chairId: body.chairId || me?.id,
        secretaryId: body.secretaryId || undefined,
        departmentId: body.departmentId || undefined,
      });
      const m = res.data.data ?? res.data;
      // วาระการประชุม
      for (const a of agenda.filter((x) => x.title.trim())) {
        await api.post(`/meetings/${m.id}/agenda`, { title: a.title, description: a.description || undefined });
      }
      // เชิญผู้เข้าร่วม (ไม่ซ้ำกับประธาน/เลขาฯ ที่ระบบจัดการแล้ว)
      const invite = attendees.map((a) => a.id).filter((uid) => uid && uid !== (body.chairId || me?.id));
      if (invite.length) await api.post(`/meetings/${m.id}/invite`, { userIds: Array.from(new Set(invite)) });
      // ไฟล์แนบ
      if (files.length) await uploadFiles(files, { bucket: 'documents', refType: 'meeting', refId: m.id });
      return m;
    },
    onSuccess: (m) => {
      toast.success('สร้างการประชุมสำเร็จ');
      router.push(`/meetings/${m.id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('กรุณาระบุชื่อการประชุม'); return; }
    if (!form.startDatetime || !form.endDatetime) { toast.error('กรุณาระบุวันเวลาประชุม'); return; }
    if (!form.chairId) { toast.error('กรุณาเลือกประธานที่ประชุม'); return; }
    create.mutate(form);
  };

  const fieldCls = 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="flex flex-col h-full">
      <Header title="นัดประชุม" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/meetings"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">นัดประชุมใหม่</h1>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
          {/* ข้อมูลการประชุม */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ข้อมูลการประชุม</h2>

            <div>
              <Label>ชื่อการประชุม<span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" value={form.title} onChange={(e) => set('title', e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ประเภทการประชุม</Label>
                <select className={fieldCls} value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {MEETING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>หน่วยงานที่จัด</Label>
                <select className={fieldCls} value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                  <option value="">เลือกหน่วยงาน</option>
                  {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>วันเวลาเริ่ม<span className="text-red-500 ml-0.5">*</span></Label>
                <Input type="datetime-local" className="mt-1" value={form.startDatetime} onChange={(e) => set('startDatetime', e.target.value)} required />
              </div>
              <div>
                <Label>วันเวลาสิ้นสุด<span className="text-red-500 ml-0.5">*</span></Label>
                <Input type="datetime-local" className="mt-1" value={form.endDatetime} onChange={(e) => set('endDatetime', e.target.value)} required />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <button type="button" onClick={() => set('isOnline', !form.isOnline)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${form.isOnline ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isOnline ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <div className="flex items-center gap-1.5">
                <Video className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">ประชุมออนไลน์</span>
              </div>
            </div>

            {form.isOnline ? (
              <div>
                <Label>ลิงก์ประชุมออนไลน์</Label>
                <Input type="url" className="mt-1" placeholder="https://meet.google.com/..." value={form.meetingUrl} onChange={(e) => set('meetingUrl', e.target.value)} />
              </div>
            ) : (
              <div>
                <Label>สถานที่</Label>
                <Input className="mt-1" value={form.location} onChange={(e) => set('location', e.target.value)} />
              </div>
            )}
          </div>

          {/* ผู้เกี่ยวข้อง */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ผู้เกี่ยวข้อง</h2>
            <div className="grid grid-cols-2 gap-3">
              <PeoplePicker label="ประธานที่ประชุม *" value={form.chairId} onChange={(id) => set('chairId', id)} placeholder="เลือกประธาน..." allowClear={false} />
              <PeoplePicker label="เลขานุการ" value={form.secretaryId} onChange={(id) => set('secretaryId', id)} placeholder="เลือกเลขานุการ..." />
            </div>

            <div>
              <PeoplePicker
                label="เชิญผู้เข้าร่วม"
                value=""
                onChange={(id, u) => addAttendee(id, u)}
                onPickDepartment={(_deptId, users) => users.forEach((u) => addAttendee(u.id, u))}
                placeholder="ค้นหาแล้วเพิ่มผู้เข้าร่วม..."
                allowClear={false}
              />
              {attendees.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attendees.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 text-sm pl-3 pr-1.5 py-1">
                      {a.name}
                      <button
                        type="button"
                        onClick={() => setAttendees((prev) => prev.filter((x) => x.id !== a.id))}
                        className="rounded-full p-0.5 hover:bg-blue-100"
                        title="นำออก"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* วาระการประชุม */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">วาระการประชุม</h2>
            {agenda.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2 h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 space-y-1">
                  <Input placeholder="หัวข้อวาระ" value={a.title} onChange={(e) => setAgenda((prev) => prev.map((p, j) => j === i ? { ...p, title: e.target.value } : p))} />
                  <Input placeholder="รายละเอียด (ถ้ามี)" value={a.description} onChange={(e) => setAgenda((prev) => prev.map((p, j) => j === i ? { ...p, description: e.target.value } : p))} />
                </div>
                <button type="button" onClick={() => setAgenda((prev) => prev.filter((_, j) => j !== i))} className="mt-2 p-1.5 text-red-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setAgenda((prev) => [...prev, { title: '', description: '' }])} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <Plus className="h-4 w-4" />เพิ่มวาระ
            </button>
          </div>

          {/* ไฟล์แนบ */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2 mb-4">เอกสารประกอบการประชุม</h2>
            <FilePicker value={files} onChange={setFiles} />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={create.isPending}><Save className="h-4 w-4" />สร้างการประชุม</Button>
            <Link href="/meetings"><Button variant="ghost" type="button">ยกเลิก</Button></Link>
          </div>
        </form>
      </div>
    </div>
  );
}
