'use client';

import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

export type ExportOption = {
  label: string;
  url: string;
  type: 'pdf' | 'excel';
  filename?: string;
};

interface ExportButtonProps {
  options: ExportOption[];
  className?: string;
  size?: 'sm' | 'md';
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function ExportButton({ options, className, size = 'md' }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleExport(opt: ExportOption) {
    setOpen(false);
    setLoading(opt.url);
    try {
      const res = await api.get(opt.url, { responseType: 'blob' });
      const contentDisposition = res.headers['content-disposition'] as string | undefined;
      let filename = opt.filename ?? `export_${Date.now()}.${opt.type === 'pdf' ? 'pdf' : 'xlsx'}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match?.[1]) filename = match[1];
      }
      triggerDownload(res.data as Blob, filename);
      toast.success('ดาวน์โหลดสำเร็จ', `ไฟล์ ${filename} พร้อมแล้ว`);
    } catch {
      toast.error('ไม่สามารถส่งออกได้', 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  if (options.length === 1) {
    const opt = options[0];
    return (
      <button
        onClick={() => handleExport(opt)}
        disabled={busy}
        className={cn(
          'inline-flex items-center gap-2 font-medium rounded-xl transition-colors disabled:opacity-50',
          size === 'sm'
            ? 'px-3 py-1.5 text-sm'
            : 'px-4 py-2 text-sm',
          opt.type === 'pdf'
            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200',
          className,
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : opt.type === 'pdf' ? (
          <FileText className="h-4 w-4" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        {opt.label}
      </button>
    );
  }

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={cn(
          'inline-flex items-center gap-2 font-medium rounded-xl border transition-colors disabled:opacity-50',
          size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm',
          'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400',
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        ส่งออก
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[180px]">
            {options.map((opt) => (
              <button
                key={opt.url}
                onClick={() => handleExport(opt)}
                disabled={loading === opt.url}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                {loading === opt.url ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                ) : opt.type === 'pdf' ? (
                  <FileText className="h-4 w-4 text-red-500" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                )}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
