'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { formatThaiDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Eye, FileText, Clock, ScanLine, Lock, Paperclip } from 'lucide-react';
import Link from 'next/link';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasRole } = useAuthStore();

  const { data: doc, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const { data } = await api.get(`/documents/${id}`);
      return data.data;
    },
  });

  const { data: versions } = useQuery({
    queryKey: ['document-versions', id],
    queryFn: async () => {
      const { data } = await api.get(`/documents/${id}/versions`);
      return data.data;
    },
  });

  const download = useMutation({
    mutationFn: async () => {
      const { data } = await api.get(`/documents/${id}/download`);
      return data.data;
    },
    onSuccess: (data) => {
      if (data.url) window.open(data.url, '_blank');
    },
    onError: () => toast.error('ไม่สามารถดาวน์โหลดได้'),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/documents/${id}`),
    onSuccess: () => { toast.success('ลบเอกสารสำเร็จ'); },
    onError: () => toast.error('ไม่สามารถลบได้'),
  });

  if (isLoading) return <div className="flex flex-col h-full"><Header title="รายละเอียดเอกสาร" /><div className="p-6 animate-pulse"><div className="h-40 bg-gray-100 rounded" /></div></div>;
  if (!doc) return null;

  const ACCESS: Record<string, { label: string; cls: string }> = {
    public: { label: 'สาธารณะ', cls: 'bg-green-100 text-green-700 border-green-300' },
    department: { label: 'แค่กอง', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
    private: { label: 'แค่เฉพาะบุคคล', cls: 'bg-red-100 text-red-700 border-red-300' },
    internal: { label: 'สาธารณะ', cls: 'bg-green-100 text-green-700 border-green-300' },
    confidential: { label: 'แค่กอง', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  };
  const ac = ACCESS[doc.accessLevel] || { label: doc.accessLevel, cls: 'bg-gray-100 text-gray-700 border-gray-300' };
  const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const isImg = (doc.mimeType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(doc.fileName || '');
  const isPdf = (doc.mimeType || '') === 'application/pdf' || /\.pdf$/i.test(doc.fileName || '');
  const canPreview = (isImg || isPdf) && doc.fileUrl && doc.fileUrl !== 'text://';

  return (
    <div className="flex flex-col h-full">
      <Header title="รายละเอียดเอกสาร" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/documents">
            <Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 flex-1 line-clamp-1">{doc.title}</h1>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${ac.cls}`}>
            {doc.accessLevel === 'private' && <Lock className="h-3 w-3" />}{ac.label}
          </span>
          <Button onClick={() => download.mutate()} loading={download.isPending} size="sm"><Download className="h-4 w-4" />ดาวน์โหลด</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center"><FileText className="h-6 w-6 text-blue-600" /></div>
                <div>
                  <p className="font-semibold text-gray-900">{doc.fileName || doc.title}</p>
                  {doc.fileSize && <p className="text-xs text-gray-500 mt-0.5">{formatSize(doc.fileSize)}</p>}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {doc.docNumber && <div><dt className="text-gray-500">เลขที่เอกสาร</dt><dd className="font-mono mt-0.5">{doc.docNumber}</dd></div>}
                <div><dt className="text-gray-500">หมวดหมู่</dt><dd className="mt-0.5">{doc.category?.nameTh || '-'}</dd></div>
                {doc.ownerOrg && <div><dt className="text-gray-500">ผู้สร้าง / หน่วยงานเจ้าของ</dt><dd className="mt-0.5">{doc.ownerOrg}</dd></div>}
                <div><dt className="text-gray-500">หน่วยงาน (ในระบบ)</dt><dd className="mt-0.5">{doc.department?.nameTh || '-'}</dd></div>
                <div><dt className="text-gray-500">ผู้อัปโหลด</dt><dd className="mt-0.5">{doc.creator?.fullNameTh || '-'}</dd></div>
                <div><dt className="text-gray-500 flex items-center gap-1"><Eye className="h-3.5 w-3.5" />ยอดเข้าชม</dt><dd className="mt-0.5">{doc.viewCount || 0} ครั้ง</dd></div>
                <div><dt className="text-gray-500 flex items-center gap-1"><Download className="h-3.5 w-3.5" />ยอดดาวน์โหลด</dt><dd className="mt-0.5">{doc.downloadCount || 0} ครั้ง</dd></div>
                <div><dt className="text-gray-500">วันที่อัปโหลด</dt><dd className="mt-0.5">{formatThaiDateTime(doc.createdAt)}</dd></div>
                {doc.tags && doc.tags.length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-gray-500 mb-1.5">แท็ก</dt>
                    <dd className="flex flex-wrap gap-1">
                      {doc.tags.map((tag: string) => <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{tag}</span>)}
                    </dd>
                  </div>
                )}
              </dl>
              {doc.description && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{doc.description}</p>
                </div>
              )}
            </div>

            {/* Inline preview — ดูไฟล์ในหน้าได้เลย (PDF/รูป) */}
            {canPreview && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-800">
                  <Paperclip className="h-4 w-4 text-gray-500" />ตัวอย่างเอกสาร
                </h2>
                {isImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doc.fileUrl} alt={doc.title} className="mx-auto max-h-[600px] rounded-lg border border-gray-200" />
                ) : (
                  <iframe src={doc.fileUrl} title={doc.title} className="h-[600px] w-full rounded-lg border border-gray-200" />
                )}
              </div>
            )}

            {doc.ocrText && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <ScanLine className="h-4 w-4 text-blue-600" />
                  ข้อความจาก OCR
                </h2>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {doc.ocrText}
                </pre>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {versions && versions.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Clock className="h-4 w-4" />เวอร์ชั่น</h2>
                <ul className="space-y-2">
                  {versions.map((v: any) => (
                    <li key={v.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-gray-900">v{v.versionNumber}</p>
                        {v.changeNote && <p className="text-xs text-gray-500">{v.changeNote}</p>}
                        <p className="text-xs text-gray-400">{formatThaiDateTime(v.createdAt)}</p>
                      </div>
                      {v.fileUrl && <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">ดาวน์โหลด</a>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <Button onClick={() => { if (confirm('ยืนยันการลบ?')) remove.mutate(); }} loading={remove.isPending} variant="outline" className="w-full text-red-600 border-red-300">ลบเอกสาร</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
