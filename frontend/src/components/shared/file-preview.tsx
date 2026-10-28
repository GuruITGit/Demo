'use client';
import * as React from 'react';
import { X, Download, FileText } from 'lucide-react';

export interface PreviewableFile {
  url: string;
  originalName: string;
  mimeType?: string;
}

/** ไฟล์ที่ดูตัวอย่างในระบบได้ (รูปภาพ / PDF) */
export function isPreviewable(mimeType?: string, name?: string): boolean {
  const m = (mimeType || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (m.startsWith('image/') || m === 'application/pdf') return true;
  return /\.(png|jpe?g|gif|webp|pdf)$/.test(n);
}

function isImage(f: PreviewableFile) {
  const m = (f.mimeType || '').toLowerCase();
  return m.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(f.originalName.toLowerCase());
}

/**
 * Modal ดูตัวอย่างไฟล์ (รูป/PDF) แบบไม่ต้องดาวน์โหลดก่อน — แต่ยังดาวน์โหลดได้
 * ใช้ได้ทุกโมดูลที่มีไฟล์แนบ
 */
export function FilePreview({
  file,
  onClose,
}: {
  file: PreviewableFile | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (file) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  if (!file) return null;
  const previewable = isPreviewable(file.mimeType, file.originalName);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/80 p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="mb-3 flex items-center justify-between gap-3 text-white">
        <p className="truncate text-base font-medium">{file.originalName}</p>
        <div className="flex items-center gap-2">
          <a
            href={file.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"
          >
            <Download className="h-4 w-4" /> ดาวน์โหลด
          </a>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/15 p-2 hover:bg-white/25"
            title="ปิด (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {!previewable ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center text-gray-500">
            <FileText className="h-14 w-14 text-gray-300" />
            <p>ไฟล์ชนิดนี้ดูตัวอย่างไม่ได้</p>
            <a
              href={file.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" /> ดาวน์โหลดไฟล์
            </a>
          </div>
        ) : isImage(file) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt={file.originalName} className="max-h-full max-w-full object-contain" />
        ) : (
          <iframe src={file.url} title={file.originalName} className="h-full w-full" />
        )}
      </div>
    </div>
  );
}
