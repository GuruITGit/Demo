'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatThaiDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Video, MapPin, Users, Calendar, Plus, X, FileText, Play, CheckCircle, Upload } from 'lucide-react';
import Link from 'next/link';
import { ExportButton } from '@/components/shared/export-button';
import { StatusBadge } from '@/components/shared/status-badge';
import { OwnerActions } from '@/components/shared/owner-actions';
import { AttachmentList } from '@/components/shared/attachment-list';
import { FilePicker } from '@/components/shared/file-picker';
import { PeoplePicker } from '@/components/shared/people-picker';
import { uploadFiles } from '@/lib/upload';

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuthStore();
  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [showAttendeeForm, setShowAttendeeForm] = useState(false);
  const [showMinutesEdit, setShowMinutesEdit] = useState(false);
  const [agendaForm, setAgendaForm] = useState({ title: '', description: '', durationMinutes: '' });
  const [minutesText, setMinutesText] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: async () => {
      const { data } = await api.get(`/meetings/${id}`);
      return data.data;
    },
  });

  const { data: attendees } = useQuery({
    queryKey: ['meeting-attendees', id],
    queryFn: async () => {
      const { data } = await api.get(`/meetings/${id}/attendees`);
      return data.data;
    },
  });

  const { data: agenda } = useQuery({
    queryKey: ['meeting-agenda', id],
    queryFn: async () => {
      const { data } = await api.get(`/meetings/${id}/agenda`);
      return data.data;
    },
  });

  const start = useMutation({
    mutationFn: () => api.post(`/meetings/${id}/start`),
    onSuccess: () => { toast.success('เริ่มการประชุมแล้ว'); qc.invalidateQueries({ queryKey: ['meeting', id] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const finish = useMutation({
    mutationFn: () => api.post(`/meetings/${id}/finish`),
    onSuccess: () => { toast.success('สิ้นสุดการประชุมแล้ว'); qc.invalidateQueries({ queryKey: ['meeting', id] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/meetings/${id}/cancel`),
    onSuccess: () => { toast.success('ยกเลิกการประชุมสำเร็จ'); qc.invalidateQueries({ queryKey: ['meeting', id] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/meetings/${id}`),
    onSuccess: () => { toast.success('ลบการประชุมสำเร็จ'); router.push('/meetings'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const addAgenda = useMutation({
    mutationFn: (body: typeof agendaForm) => api.post(`/meetings/${id}/agenda`, {
      ...body,
      durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : undefined,
    }),
    onSuccess: () => {
      toast.success('เพิ่มวาระสำเร็จ');
      qc.invalidateQueries({ queryKey: ['meeting-agenda', id] });
      setAgendaForm({ title: '', description: '', durationMinutes: '' });
      setShowAgendaForm(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const addAttendee = useMutation({
    mutationFn: (userIds: string[]) => api.post(`/meetings/${id}/invite`, { userIds }),
    onSuccess: (_d, userIds) => {
      toast.success(userIds.length > 1 ? `เพิ่มผู้เข้าร่วม ${userIds.length} คนสำเร็จ` : 'เพิ่มผู้เข้าร่วมสำเร็จ');
      qc.invalidateQueries({ queryKey: ['meeting-attendees', id] });
      setShowAttendeeForm(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveMinutes = useMutation({
    mutationFn: (text: string) => api.patch(`/meetings/${id}/minutes`, { minutesText: text }),
    onSuccess: () => {
      toast.success('บันทึกรายงานการประชุมสำเร็จ');
      qc.invalidateQueries({ queryKey: ['meeting', id] });
      setShowMinutesEdit(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const uploadDuring = useMutation({
    mutationFn: (files: File[]) => uploadFiles(files, { bucket: 'documents', refType: 'meeting', refId: id }),
    onSuccess: () => {
      toast.success('แนบไฟล์สำเร็จ');
      qc.invalidateQueries({ queryKey: ['attachments', 'meeting', id] });
      setNewFiles([]);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading) return <div className="flex flex-col h-full"><Header title="รายละเอียดการประชุม" /><div className="p-6 animate-pulse"><div className="h-40 bg-gray-100 rounded" /></div></div>;
  if (!meeting) return null;

  // ผู้สร้าง + เลขาฯ + admin จัดการได้
  const canManage = isAdmin() || meeting.createdBy === user?.id || meeting.secretaryId === user?.id;
  const isActive = meeting.status === 'กำลังประชุม';
  const isScheduled = meeting.status === 'กำหนดการ';
  const isDone = meeting.status === 'เสร็จสิ้น' || meeting.status === 'ยกเลิก';
  const canEditAgenda = canManage && !isDone;
  const canRecord = canManage && meeting.status !== 'ยกเลิก'; // จดบันทึก/แนบไฟล์ได้จนกว่าจะยกเลิก
  const formatDatetime = (d: string) => d ? new Date(d).toLocaleString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="flex flex-col h-full">
      <Header title="รายละเอียดการประชุม" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/meetings">
            <Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 flex-1 line-clamp-1">{meeting.title}</h1>
          {meeting.isOnline && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700"><Video className="h-3 w-3" />ออนไลน์</span>}
          <StatusBadge status={meeting.status} size="lg" />
          <ExportButton size="sm" options={[{ label: 'Excel ประชุม', url: '/reports/meetings/excel', type: 'excel', filename: 'meetings.xlsx' }]} />
          <OwnerActions
            record={meeting}
            permission="meetings:delete:Meeting"
            onDelete={() => del.mutate()}
            deleting={del.isPending}
            deleteDescription={`ต้องการลบการประชุม "${meeting.title}" ใช่หรือไม่?`}
          />
        </div>

        {/* แถบควบคุมการประชุม (ผู้สร้าง/เลขาฯ/admin) */}
        {canManage && !isDone && (
          <div className={`rounded-xl border p-4 shadow-sm flex flex-wrap items-center gap-3 ${isActive ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-200'}`}>
            {isActive ? (
              <>
                <span className="flex items-center gap-2 font-semibold text-green-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />กำลังประชุมอยู่
                </span>
                <span className="text-sm text-gray-600">เริ่มเมื่อ {formatThaiDateTime(meeting.actualStart)}</span>
                <Button size="lg" className="ml-auto bg-green-600 hover:bg-green-700" onClick={() => finish.mutate()} loading={finish.isPending}>
                  <CheckCircle className="h-4 w-4" />เสร็จสิ้นการประชุม
                </Button>
              </>
            ) : isScheduled ? (
              <>
                <span className="text-sm text-gray-700">การประชุมยังไม่เริ่ม — กดเริ่มเพื่อบันทึกการประชุมแบบเรียลไทม์</span>
                <Button size="lg" className="ml-auto" onClick={() => start.mutate()} loading={start.isPending}>
                  <Play className="h-4 w-4" />เริ่มประชุม
                </Button>
              </>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">ข้อมูลการประชุม</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-gray-500">เลขที่</dt><dd className="font-mono mt-0.5">{meeting.meetingNumber}</dd></div>
                <div><dt className="text-gray-500">ประเภท</dt><dd className="mt-0.5">{meeting.type || '-'}</dd></div>
                <div><dt className="text-gray-500">ประธาน</dt><dd className="mt-0.5">{meeting.chair?.fullNameTh || '-'}</dd></div>
                <div><dt className="text-gray-500">เลขานุการ</dt><dd className="mt-0.5">{meeting.secretary?.fullNameTh || '-'}</dd></div>
                <div><dt className="text-gray-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />เริ่ม</dt><dd className="mt-0.5">{formatDatetime(meeting.startDatetime)}</dd></div>
                <div><dt className="text-gray-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />สิ้นสุด</dt><dd className="mt-0.5">{formatDatetime(meeting.endDatetime)}</dd></div>
                <div><dt className="text-gray-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />สถานที่</dt><dd className="mt-0.5">{meeting.location || (meeting.isOnline ? 'ออนไลน์' : '-')}</dd></div>
                {meeting.meetingUrl && <div><dt className="text-gray-500">ลิงก์ประชุม</dt><dd className="mt-0.5"><a href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">เข้าร่วมประชุม</a></dd></div>}
                {meeting.department && <div><dt className="text-gray-500">หน่วยงาน</dt><dd className="mt-0.5">{meeting.department.nameTh}</dd></div>}
              </dl>
            </div>

            {/* Agenda */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">วาระการประชุม</h2>
                {canEditAgenda && (
                  <Button variant="outline" size="sm" onClick={() => setShowAgendaForm(!showAgendaForm)}>
                    {showAgendaForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {showAgendaForm ? 'ยกเลิก' : 'เพิ่มวาระ'}
                  </Button>
                )}
              </div>

              {showAgendaForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <Input placeholder="หัวข้อวาระ *" value={agendaForm.title} onChange={(e) => setAgendaForm((p) => ({ ...p, title: e.target.value }))} />
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="รายละเอียด" value={agendaForm.description} onChange={(e) => setAgendaForm((p) => ({ ...p, description: e.target.value }))} />
                  <div className="flex gap-2 items-center">
                    <Input type="number" placeholder="ระยะเวลา (นาที)" className="w-40" value={agendaForm.durationMinutes} onChange={(e) => setAgendaForm((p) => ({ ...p, durationMinutes: e.target.value }))} />
                    <Button onClick={() => { if (!agendaForm.title.trim()) { toast.error('กรุณาระบุหัวข้อวาระ'); return; } addAgenda.mutate(agendaForm); }} loading={addAgenda.isPending} size="sm">บันทึก</Button>
                  </div>
                </div>
              )}

              {agenda && agenda.length > 0 ? (
                <ol className="space-y-3">
                  {agenda.map((item: any) => (
                    <li key={item.id} className="flex gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center">{item.orderNo}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.title}</p>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                        {item.durationMin && <p className="text-xs text-gray-400 mt-0.5">{item.durationMin} นาที</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-gray-400">ยังไม่มีวาระ</p>
              )}
            </div>

            {/* Minutes / notes */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><FileText className="h-4 w-4" />บันทึก / รายงานการประชุม</h2>
                {canRecord && (
                  <button onClick={() => { setMinutesText(meeting.minutesText || ''); setShowMinutesEdit(!showMinutesEdit); }} className="text-sm text-blue-600 hover:underline font-medium">
                    {showMinutesEdit ? 'ยกเลิก' : meeting.minutesText ? 'แก้ไข' : 'จดบันทึก'}
                  </button>
                )}
              </div>
              {showMinutesEdit ? (
                <div className="space-y-3">
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={10}
                    placeholder="พิมพ์บันทึก/รายงานการประชุม... (บันทึกเพิ่มได้ระหว่างประชุม)"
                    value={minutesText}
                    onChange={(e) => setMinutesText(e.target.value)}
                  />
                  <Button size="sm" onClick={() => saveMinutes.mutate(minutesText)} loading={saveMinutes.isPending}>บันทึก</Button>
                </div>
              ) : meeting.minutesText ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{meeting.minutesText}</p>
              ) : (
                <p className="text-sm text-gray-400">ยังไม่มีบันทึกการประชุม</p>
              )}
            </div>

            {canManage && !isDone && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <Button onClick={() => cancel.mutate()} loading={cancel.isPending} variant="outline" className="text-red-600 border-red-300">ยกเลิกการประชุม</Button>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {/* Attendees */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Users className="h-4 w-4" />ผู้เข้าร่วม ({attendees?.length ?? 0})</h2>
                {canEditAgenda && (
                  <button onClick={() => setShowAttendeeForm(!showAttendeeForm)} className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-medium">
                    {showAttendeeForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    {showAttendeeForm ? 'ยกเลิก' : 'เพิ่ม'}
                  </button>
                )}
              </div>

              {showAttendeeForm && (
                <div className="mb-3">
                  <PeoplePicker
                    value=""
                    placeholder="ค้นหาแล้วเพิ่มผู้เข้าร่วม..."
                    allowClear={false}
                    onChange={(uid) => {
                      if (!uid) return;
                      if (attendees?.some((a: any) => a.userId === uid)) { toast.error('ผู้ใช้นี้อยู่ในรายชื่อแล้ว'); return; }
                      addAttendee.mutate([uid]);
                    }}
                    onPickDepartment={(_deptId, users) => {
                      const toAdd = users.map((u) => u.id).filter((uid) => !attendees?.some((a: any) => a.userId === uid));
                      if (!toAdd.length) { toast.error('สมาชิกกองนี้อยู่ในรายชื่อครบแล้ว'); return; }
                      addAttendee.mutate(toAdd);
                    }}
                  />
                </div>
              )}

              {attendees && attendees.length > 0 ? (
                <ul className="space-y-2">
                  {attendees.map((a: any) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {(a.user?.fullNameTh || '?')[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.user?.fullNameTh || '-'}</p>
                        <p className="text-xs text-gray-500">{a.role || ''}{a.isConfirmed ? ' · ยืนยันแล้ว' : ''}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">ยังไม่มีผู้เข้าร่วม</p>
              )}
            </div>

            {/* Files */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <AttachmentList refType="meeting" refId={id} title="เอกสารประกอบ" />
              {canRecord && (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <FilePicker value={newFiles} onChange={setNewFiles} label="" hint="แนบเอกสารเพิ่มระหว่าง/หลังประชุมได้" />
                  {newFiles.length > 0 && (
                    <Button size="sm" onClick={() => uploadDuring.mutate(newFiles)} loading={uploadDuring.isPending}>
                      <Upload className="h-4 w-4" />อัปโหลด {newFiles.length} ไฟล์
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
