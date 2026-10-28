'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { formatThaiDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { ExportButton } from '@/components/shared/export-button';
import Link from 'next/link';
import { StatusBadge, UrgencyBadge } from '@/components/shared/status-badge';
import { AttachmentList } from '@/components/shared/attachment-list';

export default function IncomingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasRole } = useAuthStore();
  const [closeNote, setCloseNote] = useState('');

  const { data: doc, isLoading } = useQuery({
    queryKey: ['incoming', id],
    queryFn: async () => {
      const { data } = await api.get(`/correspondence/incoming/${id}`);
      return data.data;
    },
  });

  const { data: workflow } = useQuery({
    queryKey: ['incoming-workflow', id],
    queryFn: async () => {
      const { data } = await api.get(`/correspondence/incoming/${id}/workflow`);
      return data.data;
    },
  });

  const close = useMutation({
    mutationFn: () => api.post(`/correspondence/incoming/${id}/close`, { note: closeNote }),
    onSuccess: () => { toast.success('ปิดงานสำเร็จ'); qc.invalidateQueries({ queryKey: ['incoming', id] }); setCloseNote(''); },
    onError: () => toast.error('ไม่สามารถปิดงานได้'),
  });

  if (isLoading) return <div className="flex flex-col h-full"><Header title="รายละเอียดหนังสือเข้า" /><div className="p-6 animate-pulse"><div className="h-40 bg-gray-100 rounded" /></div></div>;
  if (!doc) return null;

  const isStaff = hasRole(['SUPER_ADMIN', 'ADMIN', 'MAYOR', 'CLERK', 'DIRECTOR', 'SECTION_HEAD']);
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

  return (
    <div className="flex flex-col h-full">
      <Header title="รายละเอียดหนังสือเข้า" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/correspondence">
            <Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 flex-1 line-clamp-1">{doc.subject}</h1>
          <UrgencyBadge level={doc.urgencyLevel} />
          <StatusBadge status={doc.status} />
          <ExportButton size="sm" options={[{ label: 'PDF หนังสือรับ', url: `/reports/correspondence/incoming/${id}/pdf`, type: 'pdf', filename: `incoming_${id}.pdf` }]} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">ข้อมูลหนังสือ</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-gray-500">เลขรับ</dt><dd className="font-mono mt-0.5">{doc.receiveNumber}</dd></div>
                <div><dt className="text-gray-500">เลขที่หนังสือ</dt><dd className="font-mono mt-0.5">{doc.docNumber || '-'}</dd></div>
                <div><dt className="text-gray-500">ต้นเรื่อง</dt><dd className="mt-0.5">{doc.senderOrg || '-'}</dd></div>
                <div><dt className="text-gray-500">วันที่รับ</dt><dd className="mt-0.5">{formatDate(doc.receivedAt)}</dd></div>
                <div><dt className="text-gray-500">หน่วยรับ</dt><dd className="mt-0.5">{doc.receiverDept?.nameTh || '-'}</dd></div>
                {doc.assignedUser && <div><dt className="text-gray-500">มอบหมายให้</dt><dd className="mt-0.5">{doc.assignedUser.fullNameTh}</dd></div>}
                {doc.dueDate && <div><dt className="text-gray-500">กำหนดส่ง</dt><dd className={`mt-0.5 ${new Date(doc.dueDate) < new Date() && doc.status !== 'เสร็จสิ้น' ? 'text-red-600 font-medium' : ''}`}>{formatDate(doc.dueDate)}</dd></div>}
              </dl>
              {doc.actionNote && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1.5">คำสั่งการ</p>
                  <p className="text-sm text-gray-700">{doc.actionNote}</p>
                </div>
              )}
            </div>

            {isStaff && doc.status !== 'เสร็จสิ้น' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3">ดำเนินการ</h2>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder="บันทึกผลการดำเนินงาน..." value={closeNote} onChange={(e) => setCloseNote(e.target.value)} />
                <Button onClick={() => close.mutate()} loading={close.isPending} className="mt-3 bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4" />ปิดงาน</Button>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <AttachmentList refType="incoming_document" refId={id} />
            </div>
            {workflow && workflow.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-4">ประวัติการดำเนินการ</h2>
                <ol className="relative border-l border-gray-200 space-y-4 ml-3">
                  {workflow.map((log: any) => (
                    <li key={log.id} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-blue-400 border-2 border-white" />
                      <p className="text-sm font-medium text-gray-900">{log.stepName}</p>
                      <p className="text-xs text-gray-500">{log.action}</p>
                      {log.note && <p className="text-xs text-gray-500 italic mt-0.5">"{log.note}"</p>}
                      {log.actor && <p className="text-xs text-gray-400">โดย {log.actor.fullNameTh}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{formatThaiDateTime(log.actedAt)}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
