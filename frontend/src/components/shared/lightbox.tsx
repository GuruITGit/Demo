'use client';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';

export type LightboxImage = { url: string; name?: string };

/**
 * Lightbox ดูรูปเต็มจอ — เลื่อนซ้าย/ขวา, ซูม, ปิดด้วย Esc/คลิกพื้นหลัง, ดาวน์โหลด
 * ควบคุมจากภายนอก: ส่ง images + index (null = ปิด)
 */
export function Lightbox({
  images, index, onIndexChange, onClose,
}: {
  images: LightboxImage[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const open = index !== null && index >= 0 && index < images.length;

  const go = useCallback((delta: number) => {
    if (index === null) return;
    const n = images.length;
    onIndexChange((index + delta + n) % n);
    setZoomed(false);
  }, [index, images.length, onIndexChange]);

  useEffect(() => { setZoomed(false); }, [index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    // กันหน้าเลื่อนพื้นหลังตอนเปิด
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [open, go, onClose]);

  if (!open || typeof document === 'undefined') return null;
  const img = images[index!];

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col" role="dialog" aria-modal="true">
      {/* แถบบน */}
      <div className="flex items-center justify-between px-4 py-3 text-white/90 shrink-0">
        <span className="text-sm truncate max-w-[60%]">{img.name || 'รูปภาพ'}</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/60">{index! + 1} / {images.length}</span>
          <button onClick={() => setZoomed((z) => !z)} className="hover:text-white" title={zoomed ? 'ย่อ' : 'ซูม'}>
            {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
          </button>
          <a href={img.url} target="_blank" rel="noopener noreferrer" download className="hover:text-white" title="ดาวน์โหลด"><Download className="h-5 w-5" /></a>
          <button onClick={onClose} className="hover:text-white" title="ปิด (Esc)"><X className="h-6 w-6" /></button>
        </div>
      </div>

      {/* พื้นที่รูป (คลิกพื้นหลังเพื่อปิด) */}
      <div className="relative flex-1 overflow-auto flex items-center justify-center p-4" onClick={onClose}>
        {images.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            title="ก่อนหน้า (←)"
          ><ChevronLeft className="h-7 w-7" /></button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.name || 'รูปภาพ'}
          onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
          className={zoomed ? 'max-w-none max-h-none cursor-zoom-out' : 'max-w-full max-h-full object-contain cursor-zoom-in'}
          style={zoomed ? { width: 'auto', height: 'auto' } : undefined}
        />
        {images.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            title="ถัดไป (→)"
          ><ChevronRight className="h-7 w-7" /></button>
        )}
      </div>
    </div>,
    document.body,
  );
}
