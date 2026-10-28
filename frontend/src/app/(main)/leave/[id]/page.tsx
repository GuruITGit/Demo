'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { formatThaiDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ExportButton } from '@/components/shared/export-button';
import { StatusBadge } from '@/components/shared/status-badge';
import { OwnerActions } from '@/components/shared/owner-actions';
import { AttachmentList } from '@/components/shared/attachment-list';
import { FilePicker } from '@/components/shared/file-picker';
import { uploadFiles } from '@/lib/upload';
import { Paperclip } from 'lucide-react';

export default function LeaveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, hasRole } = useAuthStore();
  const [comment, setComment] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const uploadMore = useMutation({
    mutationFn: () => uploadFiles(newFiles, { bucket: 'documents', refType: 'leave_request', refId: id }),
    onSuccess: () => {
      toast.success('แนบเอกสารสำเร็จ');
      setNewFiles([]);
      qc.invalidateQueries({ queryKey: ['attachments', 'leave_request', id] });
    },
    onError: () => toast.error('อัปโหลดไฟล์ไม่สำเร็จ'),
  });

  const { data: req, isLoading } = useQuery({
    queryKey: ['leave', id],
    queryFn: async () => {
      const { data } = await api.get(`/leave/requests/${id}`);
      return data.data;
    },
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/leave/requests/${id}/approve`, { comment }),
    onSuccess: () => { toast.success('อนุมัติสำเร็จ'); qc.invalidateQueries({ queryKey: ['leave', id] }); },
    onError: () => toast.error('ไม่สามารถอนุมัติได้'),
  });

  const reject = useMutation({
    mutationFn: () => api.post(`/leave/requests/${id}/reject`, { comment }),
    onSuccess: () => { toast.success('ไม่อนุมัติสำเร็จ'); qc.invalidateQueries({ queryKey: ['leave', id] }); },
    onError: () => toast.error('ไม่สามารถดำเนินการได้'),
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/leave/requests/${id}/cancel`),
    onSuccess: () => { toast.success('ยกเลิกสำเร็จ'); router.push('/leave'); },
    onError: () => toast.error('ไม่สามารถยกเลิกได้'),
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/leave/requests/${id}`),
    onSuccess: () => { toast.success('ลบคำขอลาสำเร็จ'); router.push('/leave'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading) return <div className="flex flex-col h-full"><Header title="รายละเอียดใบลา" /><div className="p-6 animate-pulse"><div className="h-40 bg-gray-100 rounded" /></div></div>;
  if (!req) return null;

  const isApprover = hasRole(['SUPER_ADMIN', 'ADMIN', 'MAYOR', 'CLERK', 'DIRECTOR', 'SECTION_HEAD']);
  const canCancel = req.status === 'รอการอนุมัติ';

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

  return (
    <div className="flex flex-col h-full">
      <Header title="รายละเอียดใบลา" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/leave">
            <Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">{req.requestNumber}</h1>
          <StatusBadge status={req.status} />
          <ExportButton size="sm" options={[{ label: 'PDF ใบลา', url: `/reports/leave/${id}/pdf`, type: 'pdf', filename: `leave_${id}.pdf` }]} />
          <OwnerActions
            record={{ createdBy: req.employee?.userId }}
            permission="leave:delete:LeaveRequest"
            onDelete={() => del.mutate()}
            deleting={del.isPending}
            deleteDescription={`ต้องการลบคำขอลา "${req.requestNumber}" ใช่หรือไม่?`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">ข้อมูลการลา</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-gray-500">ผู้ขอลา</dt><dd className="font-medium mt-0.5">{req.employee?.firstNameTh} {req.employee?.lastNameTh}</dd></div>
                <div><dt className="text-gray-500">ประเภทการลา</dt><dd className="mt-0.5">{req.leaveType?.nameTh || '-'}</dd></div>
                <div><dt className="text-gray-500">วันที่เริ่มต้น</dt><dd className="mt-0.5">{formatDate(req.startDate)}</dd></div>
                <div><dt className="text-gray-500">วันที่สิ้นสุด</dt><dd className="mt-0.5">{formatDate(req.endDate)}</dd></div>
                <div><dt className="text-gray-500">จำนวนวัน</dt><dd className="font-medium mt-0.5 text-blue-700">{req.totalDays} วัน</dd></div>
                {req.delegate && <div><dt className="text-gray-500">ผู้รักษาการแทน</dt><dd className="mt-0.5">{req.delegate?.firstNameTh} {req.delegate?.lastNameTh}</dd></div>}
                {req.contactDuring && <div><dt className="text-gray-500">ช่องทางติดต่อ</dt><dd className="mt-0.5">{req.contactDuring}</dd></div>}
              </dl>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">เหตุผล</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{req.reason || '-'}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <AttachmentList refType="leave_request" refId={id} title="เอกสารแนบ (ใบรับรองแพทย์ / หนังสือราชการ)" />
              <div className="border-t pt-4 space-y-3">
                <FilePicker value={newFiles} onChange={setNewFiles} label="แนบเอกสารเพิ่ม" />
                {newFiles.length > 0 && (
                  <Button size="sm" loading={uploadMore.isPending} onClick={() => uploadMore.mutate()}>
                    <Paperclip className="h-4 w-4" />อัปโหลด {newFiles.length} ไฟล์
                  </Button>
                )}
              </div>
            </div>

            {(isApprover || canCancel) && req.status === 'รอการอนุมัติ' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3">ดำเนินการ</h2>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="ความคิดเห็น (ถ้ามี)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {isApprover && <>
                    <Button onClick={() => approve.mutate()} loading={approve.isPending} className="bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4" />อนุมัติ</Button>
                    <Button onClick={() => reject.mutate()} loading={reject.isPending} variant="destructive"><XCircle className="h-4 w-4" />ไม่อนุมัติ</Button>
                  </>}
                  {canCancel && <Button onClick={() => cancel.mutate()} loading={cancel.isPending} variant="outline" className="text-red-600 border-red-300">ยกเลิกการลา</Button>}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">ข้อมูลเพิ่มเติม</h2>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-gray-500">วันที่ยื่น</dt><dd className="mt-0.5">{formatThaiDateTime(req.createdAt)}</dd></div>
                {req.submittedAt && <div><dt className="text-gray-500">วันที่ส่ง</dt><dd className="mt-0.5">{formatThaiDateTime(req.submittedAt)}</dd></div>}
                {req.approvedAt && <div><dt className="text-gray-500">วันที่อนุมัติ</dt><dd className="mt-0.5">{formatThaiDateTime(req.approvedAt)}</dd></div>}
                {req.currentApprover && <div><dt className="text-gray-500">ผู้อนุมัติปัจจุบัน</dt><dd className="mt-0.5 font-medium">{req.currentApprover.fullNameTh}</dd></div>}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
