'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { formatThaiDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge, UrgencyBadge } from '@/components/shared/status-badge';
import { AttachmentList } from '@/components/shared/attachment-list';

export default function OutgoingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasRole } = useAuthStore();

  const { data: doc, isLoading } = useQuery({
    queryKey: ['outgoing', id],
    queryFn: async () => {
      const { data } = await api.get(`/correspondence/outgoing/${id}`);
      return data.data;
    },
  });

  const send = useMutation({
    mutationFn: () => api.post(`/correspondence/outgoing/${id}/send`),
    onSuccess: () => { toast.success('ส่งหนังสือสำเร็จ'); qc.invalidateQueries({ queryKey: ['outgoing', id] }); },
    onError: () => toast.error('ไม่สามารถส่งได้'),
  });

  if (isLoading) return <div className="flex flex-col h-full"><Header title="รายละเอียดหนังสือส่ง" /><div className="p-6 animate-pulse"><div className="h-40 bg-gray-100 rounded" /></div></div>;
  if (!doc) return null;

  const isStaff = hasRole(['SUPER_ADMIN', 'ADMIN', 'MAYOR', 'CLERK', 'DIRECTOR', 'SECTION_HEAD']);
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

  return (
    <div className="flex flex-col h-full">
      <Header title="รายละเอียดหนังสือส่ง" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/correspondence">
            <Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 flex-1 line-clamp-1">{doc.subject}</h1>
          {doc.urgencyLevel && <UrgencyBadge level={doc.urgencyLevel} />}
          <StatusBadge status={doc.status} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">ข้อมูลหนังสือ</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-gray-500">เลขที่หนังสือ</dt><dd className="font-mono mt-0.5">{doc.docNumber}</dd></div>
                <div><dt className="text-gray-500">วันที่หนังสือ</dt><dd className="mt-0.5">{formatDate(doc.docDate)}</dd></div>
                <div><dt className="text-gray-500">ถึง</dt><dd className="mt-0.5">{doc.recipientName || '-'}</dd></div>
                <div><dt className="text-gray-500">หน่วยงาน</dt><dd className="mt-0.5">{doc.department?.nameTh || '-'}</dd></div>
                {doc.recipientOrg && <div><dt className="text-gray-500">หน่วยงานปลายทาง</dt><dd className="mt-0.5">{doc.recipientOrg}</dd></div>}
              </dl>
              {doc.body && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{doc.body}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <dl className="space-y-3 text-sm">
                <div><dt className="text-gray-500">วันที่สร้าง</dt><dd className="mt-0.5">{formatThaiDateTime(doc.createdAt)}</dd></div>
                <div><dt className="text-gray-500">สร้างโดย</dt><dd className="mt-0.5">{doc.creator?.fullNameTh || '-'}</dd></div>
              </dl>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <AttachmentList refType="outgoing_document" refId={id} />
            </div>
            {isStaff && doc.status !== 'ส่งแล้ว' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <Button onClick={() => send.mutate()} loading={send.isPending} className="w-full"><Send className="h-4 w-4" />ยืนยันการส่ง</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
