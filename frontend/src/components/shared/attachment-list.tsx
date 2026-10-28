'use client';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Trash2, Paperclip, Eye } from 'lucide-react';
import { listFilesByRef, deleteUploadedFile, formatFileSize, type UploadedFile } from '@/lib/upload';
import { useAuthStore } from '@/stores/auth.store';
import { ConfirmDialog } from './confirm-dialog';
import { FilePreview, isPreviewable, type PreviewableFile } from './file-preview';

/**
 * แสดงรายการไฟล์แนบของรายการหนึ่ง พร้อมดาวน์โหลด/ลบ
 * ลบได้เฉพาะ admin หรือผู้อัปโหลดไฟล์เอง
 */
export function AttachmentList({
  refType,
  refId,
  canUploadMore,
  title = 'ไฟล์แนบ',
}: {
  refType: string;
  refId: string;
  canUploadMore?: React.ReactNode;
  title?: string;
}) {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const user = useAuthStore((s) => s.user);
  const [toDelete, setToDelete] = React.useState<UploadedFile | null>(null);
  const [preview, setPreview] = React.useState<PreviewableFile | null>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['attachments', refType, refId],
    queryFn: () => listFilesByRef(refType, refId),
    enabled: !!refId,
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteUploadedFile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', refType, refId] });
      setToDelete(null);
    },
  });

  const canDelete = (f: UploadedFile) => isAdmin() || (!!user && (f as any).uploadedBy === user.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Paperclip className="h-4 w-4 text-gray-500" />
          {title} {files.length > 0 && <span className="text-gray-400">({files.length})</span>}
        </h3>
        {canUploadMore}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">กำลังโหลด...</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-gray-400">ยังไม่มีไฟล์แนบ</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
              <FileText className="h-5 w-5 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">{f.originalName}</p>
                <p className="text-xs text-gray-400">{formatFileSize(f.fileSize)}</p>
              </div>
              {isPreviewable((f as any).mimeType, f.originalName) && (
                <button
                  onClick={() => setPreview({ url: f.url, originalName: f.originalName, mimeType: (f as any).mimeType })}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                  title="ดูตัวอย่าง"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                title="ดาวน์โหลด / เปิดไฟล์"
              >
                <Download className="h-4 w-4" />
              </a>
              {canDelete(f) && (
                <button
                  onClick={() => setToDelete(f)}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="ลบไฟล์"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        loading={del.isPending}
        title="ลบไฟล์แนบ"
        description={`ต้องการลบไฟล์ "${toDelete?.originalName}" ใช่หรือไม่?`}
        confirmText="ลบไฟล์"
      />

      <FilePreview file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
