'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Paperclip, Download, Trash2, FileText, FileSpreadsheet, FileArchive, Image as ImageIcon,
} from 'lucide-react';
import { listFilesByRef, uploadFiles, deleteUploadedFile, formatFileSize } from '@/lib/upload';
import { isPreviewable } from '@/components/shared/file-preview';
import { formatThaiDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { Lightbox } from '@/components/shared/lightbox';

const isImageFile = (f: any) =>
  (f?.mimeType || '').toLowerCase().startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(f?.originalName || '');

/**
 * แผงแนบไฟล์ + พรีวิว ใช้ซ้ำได้ทุกโมดูล (ผูกกับ refType/refId)
 * - อัปโหลดผ่าน <label> ครอบ input (native, ใช้ได้ทุกเบราว์เซอร์)
 * - คลิกไฟล์เพื่อพรีวิว PDF/รูปในหน้า · ดาวน์โหลด/ลบได้
 */
export function AttachmentPanel({
  refType, refId, title = 'เอกสารแนบ', canEdit = true,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip',
}: {
  refType: string;
  refId: string;
  title?: string;
  canEdit?: boolean;
  accept?: string;
}) {
  const qc = useQueryClient();
  const { user: me, isAdmin } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lbIndex, setLbIndex] = useState<number | null>(null);
  const key = ['attachments', refType, refId];

  const { data: files = [] } = useQuery({
    queryKey: key,
    queryFn: () => listFilesByRef(refType, refId),
    enabled: !!refId,
  });

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    try {
      await uploadFiles(picked, { bucket: 'documents', refType, refId });
      toast.success('แนบไฟล์สำเร็จ');
      qc.invalidateQueries({ queryKey: key });
    } catch {
      toast.error('อัปโหลดไฟล์ไม่สำเร็จ');
    }
  };

  const del = useMutation({
    mutationFn: (fid: string) => deleteUploadedFile(fid),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const imageFiles = (files as any[]).filter(isImageFile);
  const lightboxImages = imageFiles.map((f) => ({ url: f.url, name: f.originalName }));
  const openImage = (f: any) => { const idx = imageFiles.findIndex((x) => x.id === f.id); if (idx >= 0) setLbIndex(idx); };

  // แผงพรีวิวด้านล่างใช้เฉพาะไฟล์ที่ไม่ใช่รูป (เช่น PDF) — รูปดูผ่านแกลเลอรี/lightbox
  const selRaw = (files as any[]).find((f) => f.id === selectedId);
  const selected = (selRaw && !isImageFile(selRaw) ? selRaw : null)
    ?? (files as any[]).find((f) => isPreviewable(f.mimeType, f.originalName) && !isImageFile(f));

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Paperclip className="h-4 w-4 text-gray-500" />{title}
          {files.length > 0 && <span className="text-gray-400 text-sm">({files.length})</span>}
        </h3>
        {canEdit && (
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shrink-0">
            <Paperclip className="h-4 w-4" />แนบไฟล์
            <input type="file" multiple className="hidden" accept={accept} onChange={onPick} />
          </label>
        )}
      </div>

      {/* แกลเลอรีรูป — thumbnail grid คลิกเพื่อซูม (lightbox) */}
      {imageFiles.length > 0 && (
        <div className="p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 border-b border-gray-100">
          {imageFiles.map((f, i) => (
            <button
              key={f.id}
              onClick={() => setLbIndex(i)}
              className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group"
              title={f.originalName}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.thumbnailUrl || f.url} alt={f.originalName} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {files.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400 text-center">ยังไม่มีไฟล์แนบ</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50/60 text-gray-500">
            <tr>
              <th className="w-10 px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">ไฟล์แนบ</th>
              <th className="px-3 py-2 text-left font-medium w-44">วันที่-เวลา</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(files as any[]).map((f, i) => {
              const active = selected?.id === f.id;
              return (
                <tr key={f.id} onClick={() => (isImageFile(f) ? openImage(f) : setSelectedId(f.id))} className={`cursor-pointer ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileTypeIcon file={f} />
                      <span className={`truncate ${active ? 'text-blue-700 font-medium' : 'text-gray-800'}`}>{f.originalName}</span>
                      <span className="text-xs text-gray-400 shrink-0">{formatFileSize(f.fileSize)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{f.createdAt ? formatThaiDateTime(f.createdAt) : '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-gray-500 hover:bg-blue-50 hover:text-blue-600" title="ดาวน์โหลด"><Download className="h-4 w-4" /></a>
                      {canEdit && (isAdmin() || f.uploadedBy === me?.id) && (
                        <button onClick={() => del.mutate(f.id)} className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600" title="ลบไฟล์"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {selected && (
        <div className="border-t border-gray-200">
          <div className="px-5 py-2 bg-blue-50/40 text-sm text-gray-700 flex items-center gap-2">
            <FileTypeIcon file={selected} />
            <span className="font-medium truncate">แสดง: {selected.originalName}</span>
          </div>
          <div className="p-3">
            {isPreviewable(selected.mimeType, selected.originalName) ? (
              (selected.mimeType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(selected.originalName) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.url} alt={selected.originalName} className="max-h-[600px] mx-auto rounded-lg border border-gray-200" />
              ) : (
                <iframe src={selected.url} title={selected.originalName} className="w-full h-[600px] rounded-lg border border-gray-200" />
              )
            ) : (
              <div className="py-10 text-center text-sm text-gray-400">
                ไฟล์ชนิดนี้ดูตัวอย่างไม่ได้
                <div className="mt-2"><a href={selected.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">ดาวน์โหลดไฟล์</a></div>
              </div>
            )}
          </div>
        </div>
      )}

      <Lightbox images={lightboxImages} index={lbIndex} onIndexChange={setLbIndex} onClose={() => setLbIndex(null)} />
    </section>
  );
}

function FileTypeIcon({ file }: { file: any }) {
  const n = (file?.originalName || '').toLowerCase();
  const m = (file?.mimeType || '').toLowerCase();
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(n)) return <ImageIcon className="h-5 w-5 text-purple-500 shrink-0" />;
  if (m === 'application/pdf' || /\.pdf$/.test(n)) return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
  if (/\.(xlsx?|csv)$/.test(n)) return <FileSpreadsheet className="h-5 w-5 text-green-600 shrink-0" />;
  if (/\.(zip|rar|7z)$/.test(n)) return <FileArchive className="h-5 w-5 text-amber-600 shrink-0" />;
  return <FileText className="h-5 w-5 text-blue-500 shrink-0" />;
}
