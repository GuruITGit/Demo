'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { DocEditor, useDocHistory } from './DocEditor';
import { renderFileToImages } from './ticket-helpers';
import { makeItem, type DocContext, type DocItem, type DocLayout, type DocPage } from './types';

/**
 * เซ็นเอกสารตอนสร้างสารบรรณ (ยังไม่ได้บันทึกเรื่อง) — เปิดไฟล์ที่แนบในหน้าสร้าง แล้วลาก "ลายเซ็นของฉัน" ไปวาง
 * ผลลัพธ์เป็น layout v2 ส่งไปพร้อมคำขอสร้างเรื่อง (overlayLayout)
 */
export function SignDocModal({ file, ctx, initial, onDone, onClose }: {
  file: File | null;
  ctx: DocContext;
  initial: DocLayout | null;
  onDone: (layout: DocLayout) => void;
  onClose: () => void;
}) {
  const meId = useAuthStore((s) => s.user?.id);
  const history = useDocHistory();
  const [pages, setPages] = useState<DocPage[]>([{ src: 'blank' }]);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let url = '';
    (async () => {
      let imgs: string[] = [];
      if (file) {
        url = URL.createObjectURL(file);
        try { imgs = await renderFileToImages(url, file.type === 'application/pdf' || /\.pdf$/i.test(file.name)); } catch { imgs = []; }
        // รูป: แปลงเป็น data URL (object URL จะถูกปล่อยตอนปิดหน้าต่าง)
        if (imgs.length === 1 && imgs[0] === url) {
          imgs = [await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); })];
        }
      }
      if (cancelled) return;
      setImages(imgs);
      setPages(imgs.length ? imgs.map((_, i) => ({ src: 'attachment' as const, srcPage: i })) : [{ src: 'blank' }]);
      // ตราเลขรับ + กองที่เกี่ยวข้อง วางให้ตั้งต้น (แก้/ย้ายได้)
      history.reset(initial?.items?.length ? initial.items : [
        { ...makeItem('stampMain', 0, 70, 2), id: 'stampMain' },
      ] as DocItem[]);
      setLoading(false);
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const signed = history.items.some((it) => it.type === 'signature' && it.props?.ownerId === meId);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      <DocEditor
        pages={pages} attachmentImages={images} history={history} ctx={ctx} ticketTools canvasRef={canvasRef}
        header={(
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">เซ็นเอกสาร (ผู้ลงรับ)</p>
            <p className="truncate text-xs text-gray-500">{file?.name || 'หน้าเปล่า'}{loading ? ' · กำลังเปิดเอกสาร...' : ''}</p>
          </div>
        )}
        actions={(
          <>
            {!signed && <span className="text-xs text-amber-700">กด &quot;ลายเซ็นของฉัน&quot; ทางซ้าย แล้วลากไปวาง</span>}
            <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              <X className="h-4 w-4" />ยกเลิก
            </button>
            <button onClick={() => onDone({ version: 2, pages, items: history.items })} disabled={!signed || loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              <Check className="h-4 w-4" />เซ็นเสร็จแล้ว
            </button>
          </>
        )}
      />
    </div>
  );
}
